import type { Ingredient, Product } from "@/types";

export type AccuracyLabel =
  | "実入力"
  | "未設定"
  | "レジ連動";

export type GrossProfitLossResult = {
  costDiff: number;
  baseCost: number;
  currentCost: number;
  monthlySales?: number;
  loss?: number;
  accuracyLabel: AccuracyLabel;
};

export type FormatResult = {
  display: string;
  color: "danger" | "success" | "neutral";
};

export const getMonthlySales = (product: Product): number | undefined => {
  const explicitSales = firstPositiveNumber(
    product.monthlySales,
    product.monthlySalesCount,
    product.salesCount,
    product.soldCount,
    product.monthlyQuantity,
    product.monthlyOrderCount
  );
  if (explicitSales !== undefined) return explicitSales;
  return undefined;
};

export const getAccuracyLabel = (product: Product): AccuracyLabel => {
  // 将来: posSourceId があり POS連携ON なら 'レジ連動'
  if (
    firstPositiveNumber(
      product.monthlySales,
      product.monthlySalesCount,
      product.salesCount,
      product.soldCount,
      product.monthlyQuantity,
      product.monthlyOrderCount
    ) !== undefined
  ) {
    return "実入力";
  }
  return "未設定";
};

export const getGrossProfitLoss = (product: Product): GrossProfitLossResult => {
  const monthlySales = getMonthlySales(product);
  const baseCost = product.baseCost;
  const currentCost = product.currentCost;
  const costDiff = currentCost - baseCost;
  const loss = monthlySales === undefined ? undefined : costDiff * monthlySales;

  return {
    costDiff,
    baseCost,
    currentCost,
    monthlySales,
    loss,
    accuracyLabel: getAccuracyLabel(product),
  };
};

export const formatGrossProfitLoss = (loss: number | undefined): FormatResult => {
  if (loss === undefined) {
    return {
      display: "未設定",
      color: "neutral",
    };
  }
  if (loss > 0) {
    return {
      display: `-${loss.toLocaleString()}円`,
      color: "danger",
    };
  } else if (loss < 0) {
    return {
      display: `+${Math.abs(loss).toLocaleString()}円改善`,
      color: "success",
    };
  }
  return {
    display: "±0円",
    color: "neutral",
  };
};

export const formatBreakdown = (
  costDiff: number,
  monthlySales: number | undefined
): string => {
  const sign = costDiff >= 0 ? "+" : "";
  if (monthlySales === undefined) {
    return `(${sign}${costDiff}円 × 月間販売数 未設定)`;
  }
  return `(${sign}${costDiff}円 × ${monthlySales.toLocaleString()}食)`;
};

export const formatSalesCount = (monthlySales: number | undefined): string => {
  return monthlySales === undefined ? "未設定" : `${monthlySales.toLocaleString()}食`;
};

export const formatMoney = (value: number | undefined): string => {
  return value === undefined ? "—" : `${value.toLocaleString()}円`;
};

function firstPositiveNumber(...values: Array<number | undefined>): number | undefined {
  return values.find((value) => value !== undefined && value > 0);
}

export const getProductsUsingChangedIngredients = (
  products: Product[],
  changedIngredients: Ingredient[]
): Product[] => {
  const changedIds = new Set(
    changedIngredients.flatMap((ingredient) => [
      ingredient.id,
      ingredient.uniqueId,
      ingredient.myCatalogId,
    ])
  );

  return products.filter((product) => {
    const ingredientIds = product.ingredients ?? [];
    const usageIds = (product.ingredientUsages ?? []).flatMap((usage) => [
      usage.ingredientId,
      usage.uniqueId,
    ]);
    return [...ingredientIds, ...usageIds].some((id) => id && changedIds.has(id));
  });
};
