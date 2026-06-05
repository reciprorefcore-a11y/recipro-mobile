"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getOrders, getIngredients } from "@/lib/firestore";
import type { Order, Ingredient } from "@/types";

type RankedItem = {
  ingredientId: string;
  ingredientName: string;
  supplier?: string;
  orderCount: number;
  totalAmount: number;
};

type PeriodOption = {
  value: "week" | "month" | "quarter" | "all";
  label: string;
};

const PERIODS: PeriodOption[] = [
  { value: "week", label: "今週" },
  { value: "month", label: "今月" },
  { value: "quarter", label: "3ヶ月" },
  { value: "all", label: "全期間" },
];

function isInPeriod(d: Date, period: PeriodOption["value"]): boolean {
  const now = new Date();
  if (period === "week") {
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 7);
    return d >= cutoff;
  }
  if (period === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (period === "quarter") {
    const cutoff = new Date(now);
    cutoff.setMonth(now.getMonth() - 3);
    return d >= cutoff;
  }
  return true; // all
}

function calcRanking(
  orders: Order[],
  ingredients: Ingredient[],
  period: PeriodOption["value"]
): RankedItem[] {
  const priceMap = new Map(ingredients.map((i) => [i.id, i.currentPrice ?? 0]));
  const supplierMap = new Map(
    ingredients.filter((i) => i.supplier).map((i) => [i.id, i.supplier!])
  );
  const aggregated = new Map<string, RankedItem>();

  for (const order of orders) {
    const ts = order.createdAt as { toDate?: () => Date } | undefined;
    const d = ts?.toDate?.();
    if (!d || !isInPeriod(d, period)) continue;

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

  return Array.from(aggregated.values())
    .sort((a, b) => b.totalAmount - a.totalAmount || b.orderCount - a.orderCount)
    .slice(0, 10);
}

function formatAmount(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export default function OrderAnalyticsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption["value"]>("month");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getOrders(user.uid, 200),
      getIngredients(user.uid),
    ]).then(([o, i]) => {
      setOrders(o);
      setIngredients(i);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const ranked = useMemo(
    () => calcRanking(orders, ingredients, selectedPeriod),
    [orders, ingredients, selectedPeriod]
  );
  const maxAmount = Math.max(...ranked.map((i) => i.totalAmount), 1);
  const totalAmount = ranked.reduce((s, i) => s + i.totalAmount, 0);

  return (
    <main className="min-h-screen bg-white">
      <div className="w-full max-w-[480px] mx-auto">

        {/* ヘッダー */}
        <div
          className="flex items-center gap-3 px-4 border-b border-gray-100 shrink-0"
          style={{ height: "52px" }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ‹
          </button>
          <h1 className="text-base font-semibold text-gray-900 flex-1">発注金額分析</h1>
        </div>

        {/* 期間タブ */}
        <div className="flex gap-2 px-4 py-3 border-b border-gray-100">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setSelectedPeriod(p.value)}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={
                selectedPeriod === p.value
                  ? { backgroundColor: "#C8602A", color: "#fff" }
                  : { backgroundColor: "#fff", color: "#4B5563", border: "1px solid #E5E7EB" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 合計金額サマリー */}
        {!loading && totalAmount > 0 && (
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs text-gray-400">累計発注金額</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{formatAmount(totalAmount)}</p>
          </div>
        )}

        {/* ランキングリスト */}
        {loading ? (
          <div className="px-4 py-6 space-y-5 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-gray-100 rounded w-40" />
                  <div className="h-4 bg-gray-100 rounded w-16" />
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : ranked.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-gray-400">この月の発注データがありません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {ranked.map((item, i) => {
              const barPct = (item.totalAmount / maxAmount) * 100;
              return (
                <button
                  key={item.ingredientId}
                  type="button"
                  onClick={() => router.push(`/price-changes/${item.ingredientId}`)}
                  className="w-full text-left px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="text-xs font-medium text-gray-300 w-4 shrink-0 mt-0.5 tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate leading-snug">
                          {item.ingredientName}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.orderCount}回発注
                          {item.supplier && ` · ${item.supplier}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-800 shrink-0 ml-3 tabular-nums">
                      {item.totalAmount > 0 ? formatAmount(item.totalAmount) : "—"}
                    </span>
                  </div>
                  {/* バーグラフ */}
                  <div className="ml-6 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: "#E85D2C",
                        opacity: Math.max(0.25, 1 - i * 0.08),
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="h-8" /> {/* ボトムナビ分の余白 */}
      </div>
    </main>
  );
}
