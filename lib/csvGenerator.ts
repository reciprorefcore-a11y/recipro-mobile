import type { Ingredient, PendingIngredient } from "@/types";

const COLUMNS = [
  "［マイカタログID］",
  "［食品小分類コード］",
  "［食品大分類名］",
  "［食品中分類名］",
  "［食品小分類名］",
  "［商品システムコード］",
  "［商品名］",
  "［規格］",
  "［入数単位］",
  "［単価］",
  "［旧単価］",
  "［取引先名］",
  "［単価変更日］",
  "［自社管理入数］",
  "［自社管理入数単位］",
  "［発注単価］",
  "［発注単位］",
  "［マイカタログ単価］",
  "［マイカタログ旧単価］",
  "［マイカタログ単位］",
  "［マイカタログ変更日］",
  "［食品大分類コード］",
  "［食品中分類コード］",
  "［取引先名カナ］",
  "［商品名カナ］",
  "［入数］",
] as const;

function escapeCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getInputQuantity(item: Ingredient): string {
  const v = [
    item.irisu,
    item.inputQuantity,
    item.packQuantity,
    item.caseQuantity,
    item.lotQuantity,
    item.countPerUnit,
    item.quantity,
  ].find((x) => x !== undefined && x !== "");
  return v !== undefined ? String(v) : "";
}

export function buildCsvRows(ingredients: Ingredient[]): string[][] {
  return ingredients
    .filter((i) => i.isActive && i.myCatalogId)
    .map((item) => [
      item.myCatalogId ?? "",
      "",
      "",
      "",
      "",
      item.smaregiCode ?? "",
      item.ingredientName ?? "",
      item.spec ?? "",
      item.unit ?? "",
      String(item.currentPrice ?? ""),
      String(item.oldPrice ?? ""),
      item.supplier ?? "",
      "",
      item.inputQuantity !== undefined ? String(item.inputQuantity) : "",
      item.inputQuantityUnit ?? "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      item.supplierKana ?? "",
      item.ingredientNameKana ?? "",
      getInputQuantity(item),
    ]);
}

export function generateCsvString(ingredients: Ingredient[]): string {
  const header = COLUMNS.join(",");
  const rows = buildCsvRows(ingredients);
  const lines = rows.map((row) => row.map(escapeCell).join(","));
  return [header, ...lines].join("\r\n");
}

export type ReceiptCsvInput = {
  myCatalogId: string;
  ingredientName: string;
  ingredientNameKana?: string;
  unit: string;
  currentPrice: number;
  oldPrice?: number;
  supplier?: string;
  supplierKana?: string;
  spec?: string;
};

export function generateReceiptCsvString(items: ReceiptCsvInput[]): string {
  const header = COLUMNS.join(",");
  const rows = items.map((item) => [
    item.myCatalogId,
    "",
    "",
    "",
    "",
    "",
    item.ingredientName ?? "",
    item.spec ?? "",
    item.unit ?? "",
    String(item.currentPrice ?? ""),
    String(item.oldPrice ?? ""),
    item.supplier ?? "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    item.supplierKana ?? "",
    item.ingredientNameKana ?? "",
    "",
  ]);
  const lines = rows.map((row) => row.map(escapeCell).join(","));
  return [header, ...lines].join("\r\n");
}

export function generateNewIngredientsCsvString(pending: PendingIngredient[]): string {
  const header = COLUMNS.join(",");
  const rows = pending.map((item) => [
    "",
    "",
    "",
    "",
    "",
    "",
    item.ingredientName ?? "",
    item.spec ?? "",
    item.unit ?? "",
    String(item.currentPrice ?? ""),
    "",
    item.supplier ?? "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    item.supplierKana ?? "",
    item.ingredientNameKana ?? "",
    "",
  ]);
  const lines = rows.map((row) => row.map(escapeCell).join(","));
  return [header, ...lines].join("\r\n");
}
