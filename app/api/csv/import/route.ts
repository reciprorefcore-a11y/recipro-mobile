import { verifyIdToken, getAdminDb } from "@/lib/firebaseAdmin";
import iconv from "iconv-lite";
import { FieldValue } from "firebase-admin/firestore";

// カラムインデックス → フィールド名マッピング (csvGenerator.ts の COLUMNS に準拠)
const COL_MY_CATALOG_ID = 0;
const COL_SMAREGI_CODE = 5;
const COL_INGREDIENT_NAME = 6;
const COL_SPEC = 7;
const COL_UNIT = 8;
const COL_CURRENT_PRICE = 9;
const COL_OLD_PRICE = 10;
const COL_SUPPLIER = 11;
const COL_INPUT_QUANTITY = 13;
const COL_INPUT_QUANTITY_UNIT = 14;
const COL_SUPPLIER_KANA = 23;
const COL_INGREDIENT_NAME_KANA = 24;
const COL_IRISU = 25;

function parseCsv(text: string): string[][] {
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
        if (inQuote && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === "," && !inQuote) {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    rows.push(cells);
  }
  return rows;
}

function cell(row: string[], idx: number): string {
  return (row[idx] ?? "").trim();
}

function optStr(value: string): string | undefined {
  return value || undefined;
}

function optNum(value: string): number | undefined {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
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

  const file = formData.get("csv");
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "CSVファイルが見つかりません" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const csvText = iconv.decode(Buffer.from(arrayBuffer), "Shift_JIS");
  const rows = parseCsv(csvText);

  if (rows.length < 2) {
    return Response.json({ error: "CSVにデータが含まれていません" }, { status: 400 });
  }

  // 1行目はヘッダー（スキップ）
  const dataRows = rows.slice(1);

  const companyId = user.uid;
  const db = getAdminDb();
  const ingredientsCol = db
    .collection("companies")
    .doc(companyId)
    .collection("ingredients");

  // 既存食材をmyCatalogIdでインデックス化
  const existingSnap = await ingredientsCol.get();
  const existingByMyCatalogId = new Map<string, string>(); // myCatalogId → docId
  for (const d of existingSnap.docs) {
    const mid = d.data().myCatalogId as string | undefined;
    if (mid) existingByMyCatalogId.set(mid, d.id);
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;

  const now = FieldValue.serverTimestamp();

  for (const row of dataRows) {
    const myCatalogId = cell(row, COL_MY_CATALOG_ID);
    const ingredientName = cell(row, COL_INGREDIENT_NAME);

    if (!myCatalogId || !ingredientName) {
      skipped++;
      continue;
    }

    const data: Record<string, unknown> = {
      myCatalogId,
      ingredientName,
      companyId,
      smaregiCode: optStr(cell(row, COL_SMAREGI_CODE)),
      spec: optStr(cell(row, COL_SPEC)),
      unit: cell(row, COL_UNIT) || "個",
      currentPrice: optNum(cell(row, COL_CURRENT_PRICE)) ?? 0,
      oldPrice: optNum(cell(row, COL_OLD_PRICE)),
      supplier: optStr(cell(row, COL_SUPPLIER)),
      inputQuantity: optStr(cell(row, COL_INPUT_QUANTITY)),
      inputQuantityUnit: optStr(cell(row, COL_INPUT_QUANTITY_UNIT)),
      supplierKana: optStr(cell(row, COL_SUPPLIER_KANA)),
      ingredientNameKana: optStr(cell(row, COL_INGREDIENT_NAME_KANA)),
      irisu: optStr(cell(row, COL_IRISU)),
      isActive: true,
      updatedAt: now,
    };

    // undefined値を除去してFirestoreに保存
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );

    const existingId = existingByMyCatalogId.get(myCatalogId);
    if (existingId) {
      await ingredientsCol.doc(existingId).update(cleanData);
      updated++;
    } else {
      const uniqueId = `${companyId.slice(0, 8)}_recipro_${myCatalogId}`;
      await ingredientsCol.add({ ...cleanData, uniqueId, createdAt: now });
      added++;
    }
  }

  return Response.json({ added, updated, skipped });
}
