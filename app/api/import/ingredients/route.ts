import { verifyIdToken, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import iconv from "iconv-lite";
import { parseReciproXlsx, type XlsxRow } from "@/lib/xlsxImporter";

// CSVをパース (csvGenerator.ts のカラム順に準拠)
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
  // ── 認証チェック ──────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    console.warn("[import/ingredients] Authorization header missing");
    return Response.json(
      { error: "ログインが必要です。再ログインしてお試しください。" },
      { status: 401 }
    );
  }

  const user = await verifyIdToken(token);
  if (!user) {
    console.warn("[import/ingredients] verifyIdToken returned null. Token prefix:", token.slice(0, 20));
    return Response.json(
      { error: "認証に失敗しました。再ログインしてお試しください。" },
      { status: 401 }
    );
  }

  // ── リクエストのパース ────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    console.error("[import/ingredients] formData parse error:", e);
    return Response.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const file = formData.get("file");
  const preview = formData.get("preview") === "true";

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "ファイルが見つかりません" }, { status: 400 });
  }

  const fileName = file instanceof File ? file.name : "file";
  const isXlsx = /\.(xlsx|xls)$/i.test(fileName);

  // ── ファイルのパース ──────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer();
  let rows: XlsxRow[];

  try {
    if (isXlsx) {
      rows = await parseReciproXlsx(Buffer.from(arrayBuffer));
    } else {
      const csvText = iconv.decode(Buffer.from(arrayBuffer), "Shift_JIS");
      rows = parseCsvText(csvText);
    }
  } catch (e) {
    console.error("[import/ingredients] parse error:", e);
    return Response.json(
      { error: `ファイルの解析に失敗しました: ${e instanceof Error ? e.message : "不明なエラー"}` },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return Response.json({ error: "有効なデータが含まれていません。ファイル形式を確認してください。" }, { status: 400 });
  }

  // 取引先を集計
  const supplierMap = new Map<string, string | undefined>();
  for (const row of rows) {
    if (row.supplier && !supplierMap.has(row.supplier)) {
      supplierMap.set(row.supplier, row.supplierKana);
    }
  }
  const suppliers = [...supplierMap.entries()].map(([name, nameKana]) => ({ name, nameKana }));

  // ── プレビューモード (保存なし) ──────────────────────────
  if (preview) {
    return Response.json({
      total: rows.length,
      supplierCount: suppliers.length,
      suppliers: suppliers.map((s) => s.name),
    });
  }

  // ── Firestoreへ保存 ───────────────────────────────────────
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

  const existingSnap = await ingredientsCol.get();
  const existingByMyCatalogId = new Map<string, string>();
  for (const d of existingSnap.docs) {
    const mid = d.data().myCatalogId as string | undefined;
    if (mid) existingByMyCatalogId.set(mid, d.id);
  }

  const existingSupplierSnap = await suppliersCol.get();
  const existingSupplierNames = new Set(
    existingSupplierSnap.docs.map((d) => d.data().name as string)
  );

  let added = 0, updated = 0, skipped = 0;
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
    const docId = name.replace(/[^\w　-鿿]/g, "_").slice(0, 50);
    if (existingSupplierNames.has(name)) {
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

  console.log(`[import/ingredients] companyId=${companyId} added=${added} updated=${updated} skipped=${skipped} suppliers=${suppliers.length}`);

  return Response.json({
    added,
    updated,
    skipped,
    supplierCount: suppliers.length,
    newSupplierCount: newSuppliers.length,
    suppliers: suppliers.map((s) => s.name),
  });
}
