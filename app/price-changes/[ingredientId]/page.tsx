"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  getIngredient,
  getOrders,
  getPriceHistoryByIngredient,
} from "@/lib/firestore";
import type { Ingredient, Order, PriceHistory } from "@/types";

type MonthStat = {
  label: string;    // "今月" | "先月" | "前々月"
  yearMonth: string; // "2026-06"
  amount: number;
  count: number;
};

function getYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(yearMonth: string, thisMonth: string): string {
  const diff = monthDiff(yearMonth, thisMonth);
  if (diff === 0) return "今月";
  if (diff === 1) return "先月";
  if (diff === 2) return "前々月";
  return yearMonth;
}

function monthDiff(past: string, current: string): number {
  const [py, pm] = past.split("-").map(Number);
  const [cy, cm] = current.split("-").map(Number);
  return (cy - py) * 12 + (cm - pm);
}

function formatAmount(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function formatDate(ts: { toDate?: () => Date } | undefined): string {
  if (!ts?.toDate) return "—";
  const d = ts.toDate();
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function calcPct(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

export default function IngredientDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const ingredientId = typeof params.ingredientId === "string" ? params.ingredientId : "";

  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [monthStats, setMonthStats] = useState<MonthStat[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [lastOrderDate, setLastOrderDate] = useState<string>("—");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !ingredientId) return;

    const thisMonth = getYearMonth(new Date());

    Promise.all([
      getIngredient(user.uid, ingredientId),
      getOrders(user.uid, 200),
      getPriceHistoryByIngredient(user.uid, ingredientId),
    ]).then(([ing, orders, history]) => {
      setIngredient(ing);
      setPriceHistory(history);

      // 発注データを月別集計
      const priceMap = new Map([[ingredientId, ing?.currentPrice ?? 0]]);
      const byMonth = new Map<string, { amount: number; count: number; lastDate?: Date }>();

      for (const order of orders) {
        for (const item of order.items) {
          if (item.ingredientId !== ingredientId) continue;
          const orderDate = (order.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date();
          const ym = getYearMonth(orderDate);
          const price = priceMap.get(item.ingredientId) ?? 0;
          const amount = item.quantity * price;
          const existing = byMonth.get(ym);
          if (existing) {
            existing.amount += amount;
            existing.count += 1;
            if (!existing.lastDate || orderDate > existing.lastDate) {
              existing.lastDate = orderDate;
            }
          } else {
            byMonth.set(ym, { amount, count: 1, lastDate: orderDate });
          }
        }
      }

      // 今月・先月・前々月の統計
      const stats: MonthStat[] = [0, 1, 2].map((offset) => {
        const d = new Date();
        d.setMonth(d.getMonth() - offset);
        const ym = getYearMonth(d);
        const data = byMonth.get(ym);
        return {
          label: getMonthLabel(ym, thisMonth),
          yearMonth: ym,
          amount: data?.amount ?? 0,
          count: data?.count ?? 0,
        };
      });
      setMonthStats(stats);

      // 最終発注日
      const allDates = Array.from(byMonth.values())
        .map((v) => v.lastDate)
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime());
      if (allDates[0]) {
        const d = allDates[0];
        setLastOrderDate(`${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`);
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, ingredientId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex justify-center">
        <div className="w-full max-w-[480px] px-4 py-6 space-y-3 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-40 bg-gray-200 rounded-xl" />
          <div className="h-24 bg-gray-200 rounded-xl" />
        </div>
      </main>
    );
  }

  if (!ingredient) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-500">食材が見つかりません</p>
          <button
            onClick={() => router.back()}
            className="text-sm text-primary underline"
          >
            戻る
          </button>
        </div>
      </main>
    );
  }

  const thisMonthStat = monthStats[0];
  const lastMonthStat = monthStats[1];
  const amountPct = thisMonthStat && lastMonthStat
    ? calcPct(thisMonthStat.amount, lastMonthStat.amount)
    : null;
  const maxBarAmount = Math.max(...monthStats.map((s) => s.amount), 1);

  const recentHistory = priceHistory.slice(0, 5);
  const pricePct = recentHistory.length >= 2
    ? calcPct(recentHistory[0].price, recentHistory[1].price)
    : null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[480px] mx-auto px-4 py-6 space-y-4">

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700 text-xl font-light leading-none"
          >
            ‹
          </button>
          <h1 className="text-lg font-bold text-gray-900 truncate">
            {ingredient.ingredientName}
          </h1>
        </div>

        {/* 今月・前月比較カード */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-sm font-medium text-gray-500">今月の発注実績</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-xs text-orange-600 mb-1">今月</p>
              <p className="text-xl font-bold text-gray-900">
                {thisMonthStat?.amount ? formatAmount(thisMonthStat.amount) : "—"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {thisMonthStat?.count ?? 0}回発注
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">先月</p>
              <p className="text-xl font-bold text-gray-700">
                {lastMonthStat?.amount ? formatAmount(lastMonthStat.amount) : "—"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {lastMonthStat?.count ?? 0}回発注
              </p>
            </div>
          </div>
          {amountPct !== null && (lastMonthStat?.amount ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              <span
                className="text-sm font-bold"
                style={{ color: amountPct > 0 ? "#D93025" : amountPct < 0 ? "#0F9D58" : "#555" }}
              >
                {amountPct > 0 ? "+" : ""}{amountPct.toFixed(1)}%
                {amountPct > 0 ? " ⬆" : amountPct < 0 ? " ⬇" : ""}
              </span>
              <span className="text-xs text-gray-400">前月比</span>
            </div>
          )}
        </div>

        {/* 月別バーグラフ */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-sm font-medium text-gray-500">月別累計金額</p>
          <div className="space-y-2.5">
            {monthStats.map((stat) => {
              const barPct = maxBarAmount > 0 ? (stat.amount / maxBarAmount) * 100 : 0;
              return (
                <div key={stat.yearMonth} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="w-12">{stat.label}</span>
                    <span className="font-medium text-gray-800">
                      {stat.amount > 0 ? formatAmount(stat.amount) : "—"}
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${barPct}%`,
                        background: stat.label === "今月"
                          ? "linear-gradient(90deg, #E85D2C, #f59e0b)"
                          : "#d1d5db",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 価格推移 */}
        {recentHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-sm font-medium text-gray-500">価格推移</p>
            <div className="space-y-2">
              {recentHistory.map((h, i) => {
                const pct = i < recentHistory.length - 1
                  ? calcPct(h.price, recentHistory[i + 1].price)
                  : null;
                return (
                  <div key={h.id ?? i} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{formatDate(h.recordedAt as never)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        ¥{h.price.toLocaleString("ja-JP")}/{ingredient.unit}
                      </span>
                      {pct !== null && (
                        <span
                          className="text-xs font-semibold"
                          style={{ color: pct > 0 ? "#D93025" : pct < 0 ? "#0F9D58" : "#888" }}
                        >
                          {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                          {pct > 0 ? "↑" : pct < 0 ? "↓" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {pricePct !== null && recentHistory.length >= 2 && (
              <p className="text-xs text-gray-400 border-t border-gray-100 pt-2">
                最新価格: ¥{recentHistory[0].price.toLocaleString()}/{ingredient.unit}
                （前回比 {pricePct > 0 ? "+" : ""}{pricePct.toFixed(1)}%）
              </p>
            )}
          </div>
        )}

        {/* 仕入先・最終発注 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <p className="text-sm font-medium text-gray-500">基本情報</p>
          {[
            { label: "仕入先", value: ingredient.supplier },
            { label: "最終発注日", value: lastOrderDate },
            { label: "現在価格", value: `¥${ingredient.currentPrice.toLocaleString()} /${ingredient.unit}` },
            { label: "規格", value: ingredient.spec },
          ].filter((r) => r.value).map((r) => (
            <div key={r.label} className="flex justify-between gap-3">
              <span className="text-sm text-gray-400 shrink-0">{r.label}</span>
              <span className="text-sm font-medium text-gray-800 text-right">{r.value}</span>
            </div>
          ))}
        </div>

        {/* アクションボタン */}
        <div className="flex gap-3 pb-4">
          <button
            onClick={() => router.push("/order")}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: "#E85D2C" }}
          >
            再発注する
          </button>
          <button
            onClick={() => router.push(`/search?q=${encodeURIComponent(ingredient.ingredientName)}`)}
            className="flex-1 py-3 rounded-xl text-sm font-bold border"
            style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
          >
            食材を編集
          </button>
        </div>

      </div>
    </main>
  );
}
