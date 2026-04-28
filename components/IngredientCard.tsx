import Link from "next/link";
import type { Ingredient } from "@/types";
import { getDaysAgo, formatDaysAgo } from "@/lib/utils";

type Props = {
  ingredient: Ingredient;
};

export default function IngredientCard({ ingredient }: Props) {
  const days = getDaysAgo(ingredient.updatedAt);
  const isWarning = days >= 7;
  const isFresh = days <= 3;

  return (
    <Link
      href={`/search/${ingredient.id}`}
      className={`block bg-white rounded-2xl shadow-sm p-4 active:opacity-70 transition-opacity ${
        isWarning ? "border-l-4 border-warning" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-bold text-gray-900 leading-tight">
          {ingredient.ingredientName}
        </p>
        <p className="text-base font-semibold text-gray-700 whitespace-nowrap">
          {ingredient.currentPrice.toLocaleString()}円
          <span className="text-sm font-normal text-gray-500">/{ingredient.unit}</span>
        </p>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        {ingredient.supplier ? (
          <p className="text-xs text-gray-400">{ingredient.supplier}</p>
        ) : (
          <span />
        )}
        <p
          className={`text-xs font-medium flex items-center gap-1 ${
            isWarning ? "text-warning" : isFresh ? "text-success" : "text-gray-400"
          }`}
        >
          {isWarning && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icons/icon-warning.svg" alt="" width={12} height={12} />
          )}
          {formatDaysAgo(ingredient.updatedAt)}
        </p>
      </div>
    </Link>
  );
}
