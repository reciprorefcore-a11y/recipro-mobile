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

type MonthOption = {
  label: string;
  year: number;
  month: number; // 0-based
};

function buildMonthOptions(): MonthOption[] {
  const options: MonthOption[] = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      label: i === 0 ? "今月" : i === 1 ? "先月" : `${d.getMonth() + 1}月`,
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return options;
}

function calcRanking(
  orders: Order[],
  ingredients: Ingredient[],
  year: number,
  month: number
): RankedItem[] {
  const priceMap = new Map(ingredients.map((i) => [i.id, i.currentPrice ?? 0]));
  const supplierMap = new Map(
    ingredients.filter((i) => i.supplier).map((i) => [i.id, i.supplier!])
  );
  const aggregated = new Map<string, RankedItem>();

  for (const order of orders) {
    const ts = order.createdAt as { toDate?: () => Date } | undefined;
    const d = ts?.toDate?.();
    if (!d || d.getFullYear() !== year || d.getMonth() !== month) continue;

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

  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [selectedIdx, setSelectedIdx] = useState(0);

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

  const selected = monthOptions[selectedIdx];
  const ranked = useMemo(
    () => calcRanking(orders, ingredients, selected.year, selected.month),
    [orders, ingredients, selected]
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

        {/* 月選択タブ */}
        <div className="flex border-b border-gray-100 px-4 gap-4">
          {monthOptions.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className="py-3 text-sm font-medium transition-colors relative shrink-0"
              style={{ color: selectedIdx === idx ? "#E85D2C" : "#9CA3AF" }}
            >
              {opt.label}
              {selectedIdx === idx && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: "#E85D2C" }}
                />
              )}
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
