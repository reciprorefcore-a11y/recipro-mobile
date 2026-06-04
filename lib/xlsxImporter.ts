export type XlsxRow = {
  myCatalogId: string;
  ingredientName: string;
  ingredientNameKana?: string;
  spec?: string;
  unit: string;
  currentPrice: number;
  oldPrice?: number;
  supplier?: string;
  supplierKana?: string;
  globalCategory?: string;
  globalCategoryId?: string;
  category?: string;
  smaregiCode?: string;
  irisu?: string;
};

const SHEET_NAME = "データ入力シート";

// Recipro入力シートのカラム位置 (0-based)
const COL = {
  MY_CATALOG_ID: 0,      // ［マイカタログID］
  FOOD_LARGE_NAME: 2,    // ［食品大分類名］
  FOOD_SMALL_NAME: 4,    // ［食品小分類名］
  SMAREGI_CODE: 5,       // ［商品システムコード］
  INGREDIENT_NAME: 6,    // ［商品名］
  SPEC: 7,               // ［規格］
  UNIT: 8,               // ［入数単位］
  CURRENT_PRICE: 9,      // ［単価］
  OLD_PRICE: 10,         // ［旧単価］
  SUPPLIER: 11,          // ［取引先名］
  PRICE2: 17,            // ［単価］(2列目)
  OLD_PRICE2: 18,        // ［旧単価］(2列目)
  UNIT2: 19,             // ［単位］
  FOOD_LARGE_CODE: 21,   // ［食品大分類コード］
  SUPPLIER_KANA: 23,     // ［取引先名カナ］
  INGREDIENT_NAME_KANA: 24, // ［商品名カナ］
  IRISU: 25,             // ［入数］
};

function str(row: (string | number | boolean | null | undefined)[], idx: number): string {
  const v = row[idx];
  if (v == null) return "";
  return String(v).trim();
}

function num(row: (string | number | boolean | null | undefined)[], idx: number): number | undefined {
  const v = row[idx];
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// dynamic importを使用してVercel環境でのバンドル問題を回避
export async function parseReciproXlsx(buffer: Buffer): Promise<XlsxRow[]> {
  const XLSX = (await import("xlsx")).default ?? await import("xlsx");

  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sheet =
    workbook.Sheets[SHEET_NAME] ??
    workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  type RawRow = (string | number | boolean | null | undefined)[];
  const allRows: RawRow[] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  // ヘッダー行を探す: 先頭から最初に myCatalogId が数値の行がデータ開始行
  let dataStart = 1;
  for (let i = 0; i < Math.min(allRows.length, 5); i++) {
    const row = allRows[i];
    const v = row[COL.MY_CATALOG_ID];
    if (v != null && !isNaN(Number(v)) && String(v).trim() !== "") {
      dataStart = i;
      break;
    }
  }

  const results: XlsxRow[] = [];

  for (let i = dataStart; i < allRows.length; i++) {
    const row = allRows[i];
    const myCatalogId = str(row, COL.MY_CATALOG_ID);
    const ingredientName = str(row, COL.INGREDIENT_NAME);

    if (!myCatalogId || !ingredientName) continue;
    if (isNaN(Number(myCatalogId))) continue;

    results.push({
      myCatalogId,
      ingredientName,
      ingredientNameKana: str(row, COL.INGREDIENT_NAME_KANA) || undefined,
      spec: str(row, COL.SPEC) || undefined,
      unit: str(row, COL.UNIT) || str(row, COL.UNIT2) || "個",
      currentPrice: num(row, COL.CURRENT_PRICE) ?? num(row, COL.PRICE2) ?? 0,
      oldPrice: num(row, COL.OLD_PRICE) ?? num(row, COL.OLD_PRICE2),
      supplier: str(row, COL.SUPPLIER) || undefined,
      supplierKana: str(row, COL.SUPPLIER_KANA) || undefined,
      globalCategory: str(row, COL.FOOD_LARGE_NAME) || undefined,
      globalCategoryId: str(row, COL.FOOD_LARGE_CODE) || undefined,
      category: str(row, COL.FOOD_SMALL_NAME) || undefined,
      smaregiCode: str(row, COL.SMAREGI_CODE) || undefined,
      irisu: str(row, COL.IRISU) || undefined,
    });
  }

  return results;
}
