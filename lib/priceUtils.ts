export function toTaxExcluded(priceInclTax: number): number {
  return Math.round(priceInclTax / 1.1);
}

export function applyPriceMode(
  inputPrice: number,
  priceMode: "taxIncluded" | "taxExcluded"
): number {
  if (priceMode === "taxIncluded") {
    return toTaxExcluded(inputPrice);
  }
  return inputPrice;
}
