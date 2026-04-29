import type { Ingredient, Product } from "@/types";

export type AccuracyLabel =
  | "実入力"
  | "推定(売上ベース)"
  | "推定(デフォルト)"
  | "レジ連動";

export type GrossProfitLossResult = {
  costDiff: number;
  monthlySales: number;
  loss: number;
  accuracyLabel: AccuracyLabel;
};

export type FormatResult = {
  display: string;
  color: "danger" | "success" | "neutral";
};

export const getMonthlySales = (product: Product): number => {
  if (product.monthlySales && product.monthlySales > 0) {
    return product.monthlySales;
  }
  if (
    product.monthlyRevenue &&
    product.monthlyRevenue > 0 &&
    product.price > 0
  ) {
    return Math.floor(product.monthlyRevenue / product.price);
  }
  return 800;
};

export const getAccuracyLabel = (product: Product): AccuracyLabel => {
  // 将来: posSourceId があり POS連携ON なら 'レジ連動'
  if (product.monthlySales && product.monthlySales > 0) return "実入力";
  if (
    product.monthlyRevenue &&
    product.monthlyRevenue > 0 &&
    product.price > 0
  )
    return "推定(売上ベース)";
  return "推定(デフォルト)";
};

export const getGrossProfitLoss = (product: Product): GrossProfitLossResult => {
  const monthlySales = getMonthlySales(product);
  const costDiff = product.currentCost - product.baseCost;
  const loss = costDiff * monthlySales;

  return {
    costDiff,
    monthlySales,
    loss,
    accuracyLabel: getAccuracyLabel(product),
  };
};

export const formatGrossProfitLoss = (loss: number): FormatResult => {
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
  monthlySales: number
): string => {
  const sign = costDiff >= 0 ? "+" : "";
  return `(${sign}${costDiff}円 × ${monthlySales.toLocaleString()}食)`;
};

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
