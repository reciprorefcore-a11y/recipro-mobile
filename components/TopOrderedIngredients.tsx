"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getOrders, getIngredients } from "@/lib/firestore";
import Card from "./ui/Card";

type RankedItem = {
  ingredientName: string;
  orderCount: number;
  totalAmount: number;
};

function formatAmount(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export default function TopOrderedIngredients() {
  const { user } = useAuth();
  const [items, setItems] = useState<RankedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      getOrders(user.uid, 100),
      getIngredients(user.uid),
    ]).then(([orders, ingredients]) => {
      const priceMap = new Map<string, number>(
        ingredients.map((ing) => [ing.id, ing.currentPrice ?? 0])
      );

      const aggregated = new Map<string, { orderCount: number; totalAmount: number }>();

      for (const order of orders) {
        for (const item of order.items) {
          const price = priceMap.get(item.ingredientId) ?? 0;
          const amount = item.quantity * price;
          const existing = aggregated.get(item.ingredientName);
          if (existing) {
            existing.orderCount += 1;
            existing.totalAmount += amount;
          } else {
            aggregated.set(item.ingredientName, { orderCount: 1, totalAmount: amount });
          }
        }
      }

      const ranked: RankedItem[] = Array.from(aggregated.entries())
        .map(([ingredientName, v]) => ({ ingredientName, ...v }))
        .sort((a, b) => b.totalAmount - a.totalAmount || b.orderCount - a.orderCount)
        .slice(0, 5);

      setItems(ranked);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  if (loading) return null;

  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm font-medium text-gray-700 mb-2">発注数が多い食材</p>
        <p className="text-sm text-gray-400 py-1">発注データがまだありません</p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-sm font-medium text-gray-700 mb-3">発注数が多い食材（累計金額）</p>
      <div className="divide-y divide-gray-100">
        {items.map((item, i) => (
          <div
            key={item.ingredientName}
            className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-gray-400 w-4 shrink-0">{i + 1}.</span>
              <p className="font-medium text-gray-900 truncate">{item.ingredientName}</p>
            </div>
            <div className="text-right shrink-0 ml-2">
              {item.totalAmount > 0 && (
                <p className="text-sm font-bold text-gray-800">{formatAmount(item.totalAmount)}</p>
              )}
              <p className="text-xs text-gray-400">発注 {item.orderCount}回</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
