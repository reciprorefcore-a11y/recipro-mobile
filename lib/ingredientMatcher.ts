import type { Ingredient } from "@/types";

export const KNOWN_SUPPLIERS = [
  "高瀬物産",
  "プレコフーズ",
  "八百熊",
  "TORISEI",
  "ビセラル",
  "中山酒店",
  "榎本酒類",
  "菅野製麺所",
];

export type SupplierMatchResult =
  | { status: "empty" }
  | { status: "exact"; matched: string }
  | { status: "partial"; candidates: string[] }
  | { status: "unknown" };

function normalize(s: string): string {
  return s.replace(/[\s　]/g, "").toLowerCase();
}

export function matchSupplier(supplierName?: string): SupplierMatchResult {
  if (!supplierName || supplierName.trim() === "") {
    return { status: "empty" };
  }
  const trimmed = supplierName.trim();

  const exact = KNOWN_SUPPLIERS.find((s) => s === trimmed);
  if (exact) return { status: "exact", matched: exact };

  const normInput = normalize(trimmed);
  const normExact = KNOWN_SUPPLIERS.find((s) => normalize(s) === normInput);
  if (normExact) return { status: "exact", matched: normExact };

  const partial = KNOWN_SUPPLIERS.filter(
    (s) => normalize(s).includes(normInput) || normInput.includes(normalize(s))
  );
  if (partial.length > 0) return { status: "partial", candidates: partial };

  return { status: "unknown" };
}

export type CsvPreviewWarning = {
  ingredientName: string;
  issue: string;
};

export type CsvPreviewStats = {
  total: number;
  existing: number;
  newItems: number;
  warnings: CsvPreviewWarning[];
};

export function buildCsvPreviewStats(ingredients: Ingredient[]): CsvPreviewStats {
  const active = ingredients.filter((i) => i.isActive);
  let existing = 0;
  let newItems = 0;
  const warnings: CsvPreviewWarning[] = [];

  for (const ing of active) {
    if (ing.myCatalogId) {
      existing++;
    } else {
      newItems++;
    }

    const result = matchSupplier(ing.supplier);
    if (result.status === "unknown") {
      warnings.push({
        ingredientName: ing.ingredientName,
        issue: `取引先「${ing.supplier}」が未登録`,
      });
    } else if (result.status === "partial") {
      warnings.push({
        ingredientName: ing.ingredientName,
        issue: `取引先「${ing.supplier}」が曖昧 → 候補: ${result.candidates.join(", ")}`,
      });
    }
  }

  return { total: active.length, existing, newItems, warnings };
}
