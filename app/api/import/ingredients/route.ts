import { verifyIdToken, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import iconv from "iconv-lite";
import { parseReciproXlsx, type XlsxRow } from "@/lib/xlsxImporter";

// CSVをパース (既存の /api/csv/import と同じロジック)
function parseCsvText(text: string): XlsxRow[] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        cells.push(current); current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    rows.push(cells);
  }

  const c = (row: string[], idx: number) => (row[idx] ?? "").trim();
  const optNum = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : undefined; };

  // ヘッダー行スキップ
  return rows.slice(1).flatMap((row) => {
    const myCatalogId = c(row, 0);
    const ingredientName = c(row, 6);
    if (!myCatalogId || !ingredientName) return [];
    return [{
      myCatalogId,
      ingredientName,
      ingredientNameKana: c(row, 24) || undefined,
      spec: c(row, 7) || undefined,
      unit: c(row, 8) || "個",
      currentPrice: optNum(c(row, 9)) ?? 0,
      oldPrice: optNum(c(row, 10)),
      supplier: c(row, 11) || undefined,
      supplierKana: c(row, 23) || undefined,
      smaregiCode: c(row, 5) || undefined,
      irisu: c(row, 25) || undefined,
    }];
  });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await verifyIdToken(token);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const file = formData.get("file");
  const preview = formData.get("preview") === "true";

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "ファイルが見つかりません" }, { status: 400 });
  }

  const fileName = file instanceof File ? file.name : "file";
  const isXlsx = /\.(xlsx|xls)$/i.test(fileName);

  const arrayBuffer = await file.arrayBuffer();

  let rows: XlsxRow[];
  try {
    if (isXlsx) {
      rows = parseReciproXlsx(Buffer.from(arrayBuffer));
    } else {
      const csvText = iconv.decode(Buffer.from(arrayBuffer), "Shift_JIS");
      rows = parseCsvText(csvText);
    }
  } catch (e) {
    console.error("parse error", e);
    return Response.json({ error: "ファイルの解析に失敗しました" }, { status: 400 });
  }

  if (rows.length === 0) {
    return Response.json({ error: "有効なデータが含まれていません" }, { status: 400 });
  }

  // 取引先一覧を集計
  const supplierMap = new Map<string, string | undefined>();
  for (const row of rows) {
    if (row.supplier && !supplierMap.has(row.supplier)) {
      supplierMap.set(row.supplier, row.supplierKana);
    }
  }
  const suppliers = [...supplierMap.entries()].map(([name, nameKana]) => ({ name, nameKana }));

  // プレビューモード: パースのみで保存しない
  if (preview) {
    return Response.json({
      total: rows.length,
      supplierCount: suppliers.length,
      suppliers: suppliers.map((s) => s.name),
    });
  }

  // 実際の保存処理
  const companyId = user.uid;
  const db = getAdminDb();
  const ingredientsCol = db
    .collection("companies")
    .doc(companyId)
    .collection("ingredients");
  const suppliersCol = db
    .collection("companies")
    .doc(companyId)
    .collection("suppliers");

  // 既存食材をmyCatalogIdでインデックス化
  const existingSnap = await ingredientsCol.get();
  const existingByMyCatalogId = new Map<string, string>();
  for (const d of existingSnap.docs) {
    const mid = d.data().myCatalogId as string | undefined;
    if (mid) existingByMyCatalogId.set(mid, d.id);
  }

  // 既存取引先をインデックス化
  const existingSupplierSnap = await suppliersCol.get();
  const existingSupplierNames = new Set(
    existingSupplierSnap.docs.map((d) => d.data().name as string)
  );

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const now = FieldValue.serverTimestamp();

  for (const row of rows) {
    if (!row.myCatalogId || !row.ingredientName) { skipped++; continue; }

    const data: Record<string, unknown> = {
      myCatalogId: row.myCatalogId,
      ingredientName: row.ingredientName,
      companyId,
      ...(row.ingredientNameKana && { ingredientNameKana: row.ingredientNameKana }),
      ...(row.smaregiCode && { smaregiCode: row.smaregiCode }),
      ...(row.spec && { spec: row.spec }),
      unit: row.unit,
      currentPrice: row.currentPrice,
      ...(row.oldPrice !== undefined && { oldPrice: row.oldPrice }),
      ...(row.supplier && { supplier: row.supplier }),
      ...(row.supplierKana && { supplierKana: row.supplierKana }),
      ...(row.globalCategory && { globalCategory: row.globalCategory }),
      ...(row.globalCategoryId && { globalCategoryId: row.globalCategoryId }),
      ...(row.category && { category: row.category }),
      ...(row.irisu && { irisu: row.irisu }),
      isActive: true,
      updatedAt: now,
    };

    const existingId = existingByMyCatalogId.get(row.myCatalogId);
    if (existingId) {
      await ingredientsCol.doc(existingId).update(data);
      updated++;
    } else {
      const uniqueId = `${companyId.slice(0, 8)}_recipro_${row.myCatalogId}`;
      await ingredientsCol.add({ ...data, uniqueId, createdAt: now });
      added++;
    }
  }

  // 取引先マスタを upsert
  const newSuppliers: string[] = [];
  for (const { name, nameKana } of suppliers) {
    const docId = name.replace(/[^a-zA-Z0-9぀-鿿]/g, "_");
    if (existingSupplierNames.has(name)) {
      // usageCount をインクリメント
      await suppliersCol.doc(docId).update({
        usageCount: FieldValue.increment(1),
        updatedAt: now,
      });
    } else {
      await suppliersCol.doc(docId).set({
        name,
        nameKana: nameKana ?? null,
        companyId,
        usageCount: 1,
        createdAt: now,
        updatedAt: now,
      });
      newSuppliers.push(name);
    }
  }

  return Response.json({
    added,
    updated,
    skipped,
    supplierCount: suppliers.length,
    newSupplierCount: newSuppliers.length,
    suppliers: suppliers.map((s) => s.name),
  });
}
