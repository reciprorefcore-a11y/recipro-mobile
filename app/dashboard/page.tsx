"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getOrders, getIngredients } from "@/lib/firestore";

type RankedItem = {
  ingredientId: string;
  ingredientName: string;
  supplier?: string;
  orderCount: number;
  totalAmount: number;
};

function formatAmount(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<RankedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      getOrders(user.uid, 200),
      getIngredients(user.uid),
    ]).then(([orders, ingredients]) => {
      const priceMap = new Map<string, number>(
        ingredients.map((ing) => [ing.id, ing.currentPrice ?? 0])
      );
      const supplierMap = new Map<string, string>(
        ingredients.filter((ing) => ing.supplier).map((ing) => [ing.id, ing.supplier!])
      );

      const aggregated = new Map<string, RankedItem>();

      for (const order of orders) {
        for (const item of order.items) {
          const price = priceMap.get(item.ingredientId) ?? 0;
          const amount = item.quantity * price;
          const existing = aggregated.get(item.ingredientId);
          if (existing) {
            existing.orderCount += 1;
            existing.totalAmount += amount;
          } else {
            aggregated.set(item.ingredientId, {
              ingredientId: item.ingredientId,
              ingredientName: item.ingredientName,
              supplier: supplierMap.get(item.ingredientId),
              orderCount: 1,
              totalAmount: amount,
            });
          }
        }
      }

      const ranked = Array.from(aggregated.values())
        .sort((a, b) => b.totalAmount - a.totalAmount || b.orderCount - a.orderCount)
        .slice(0, 10);

      setItems(ranked);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const maxAmount = Math.max(...items.map((i) => i.totalAmount), 1);

  return (
    <main className="min-h-screen bg-white">
      <div className="w-full max-w-[480px] mx-auto">
        {/* ヘッダー */}
        <div
          className="flex items-center gap-3 px-4 border-b border-gray-100"
          style={{ height: "52px" }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ‹
          </button>
          <h1 className="text-base font-semibold text-gray-900">発注数が多い食材</h1>
        </div>

        {loading ? (
          <div className="px-4 py-6 space-y-4 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-100 rounded w-40" />
                  <div className="h-4 bg-gray-100 rounded w-20" />
                </div>
                <div className="h-2 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-gray-400">発注データがまだありません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((item, i) => {
              const barPct = (item.totalAmount / maxAmount) * 100;
              return (
                <button
                  key={item.ingredientId}
                  type="button"
                  onClick={() => router.push(`/price-changes/${item.ingredientId}`)}
                  className="w-full text-left px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="text-xs font-medium text-gray-300 w-4 shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.ingredientName}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.orderCount}回発注
                          {item.supplier && ` · ${item.supplier}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      {item.totalAmount > 0 ? (
                        <span className="text-sm font-semibold text-gray-800">
                          {formatAmount(item.totalAmount)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  </div>
                  <div className="ml-6 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: i === 0 ? "#E85D2C" : "#F97316",
                        opacity: 1 - i * 0.07,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
