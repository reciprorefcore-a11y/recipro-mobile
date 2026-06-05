"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getIngredients, getRecentPriceHistory } from "@/lib/firestore";
import type { Ingredient, PriceHistory } from "@/types";

type SortKey = "pct-desc" | "pct-asc" | "count-desc" | "name" | "date-desc";
type Period = "week" | "month" | "quarter" | "all";

type PriceChangeItem = {
  id: string;
  ingredientName: string;
  supplier?: string;
  oldPrice: number;
  currentPrice: number;
  pct: number;
  changeCount: number;
  updatedAt?: string;
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "pct-desc", label: "価格上昇順" },
  { value: "pct-asc", label: "価格下降順" },
  { value: "count-desc", label: "変更回数順" },
  { value: "name", label: "五十音順" },
  { value: "date-desc", label: "最終更新順" },
];

const PERIOD_OPTIONS: { value: Period; label: string; days: number }[] = [
  { value: "week", label: "今週", days: 7 },
  { value: "month", label: "今月", days: 30 },
  { value: "quarter", label: "3ヶ月", days: 90 },
  { value: "all", label: "全期間", days: 9999 },
];

const PAGE_SIZE = 10;

function filterByPeriod(updatedAt: string | undefined, days: number): boolean {
  if (days >= 9999) return true;
  if (!updatedAt) return false;
  return new Date(updatedAt) >= new Date(Date.now() - days * 86400 * 1000);
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export default function PriceChangesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("pct-desc");
  const [period, setPeriod] = useState<Period>("month");
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getIngredients(user.uid),
      getRecentPriceHistory(user.uid, 365),
    ])
      .then(([ings, hist]) => {
        setIngredients(ings);
        setHistory(hist);
      })
      .finally(() => setLoading(false));
  }, [user]);

  // ingredientId → 変更回数
  const countMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of history) {
      m.set(h.ingredientId, (m.get(h.ingredientId) ?? 0) + 1);
    }
    return m;
  }, [history]);

  const periodDays = PERIOD_OPTIONS.find((o) => o.value === period)!.days;

  const allItems: PriceChangeItem[] = useMemo(() => {
    return ingredients
      .filter(
        (i) =>
          i.isActive &&
          i.oldPrice != null &&
          i.oldPrice > 0 &&
          filterByPeriod(i.updatedAt, periodDays)
      )
      .map((i) => ({
        id: i.id,
        ingredientName: i.ingredientName,
        supplier: i.supplier,
        oldPrice: i.oldPrice!,
        currentPrice: i.currentPrice,
        pct: ((i.currentPrice - i.oldPrice!) / i.oldPrice!) * 100,
        changeCount: countMap.get(i.id) ?? 0,
        updatedAt: i.updatedAt,
      }));
  }, [ingredients, periodDays, countMap]);

  const sorted = useMemo(() => {
    const items = [...allItems];
    switch (sort) {
      case "pct-desc":  return items.sort((a, b) => b.pct - a.pct);
      case "pct-asc":   return items.sort((a, b) => a.pct - b.pct);
      case "count-desc":return items.sort((a, b) => b.changeCount - a.changeCount);
      case "name":      return items.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName, "ja"));
      case "date-desc": return items.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    }
  }, [allItems, sort]);

  const displayed = sorted.slice(0, displayCount);

  const pctColor = (pct: number) =>
    pct > 0 ? "#D93025" : pct < 0 ? "#0F9D58" : "#888";

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex justify-center">
        <div className="w-full max-w-[480px] px-4 py-6 space-y-3 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4" style={{ paddingBottom: 80 }}>

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 font-medium"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-arrow-right.svg" alt="" width={16} height={16}
              style={{ filter: "brightness(0) opacity(0.5)", transform: "rotate(180deg)" }} />
            戻る
          </button>
          <h1 className="text-xl font-bold">価格変動食材リスト</h1>
        </div>

        {/* 並び替え + 期間フィルタ */}
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setSort(opt.value); setDisplayCount(PAGE_SIZE); }}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                style={{
                  backgroundColor: sort === opt.value ? "#E85D2C" : "#fff",
                  color: sort === opt.value ? "#fff" : "#555",
                  borderColor: sort === opt.value ? "#E85D2C" : "#ddd",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setPeriod(opt.value); setDisplayCount(PAGE_SIZE); }}
                className="flex-1 py-1.5 rounded-full text-xs font-medium border transition-colors"
                style={{
                  backgroundColor: period === opt.value ? "#E85D2C" : "#fff",
                  color: period === opt.value ? "#fff" : "#555",
                  borderColor: period === opt.value ? "#E85D2C" : "#ddd",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 件数 */}
        <p className="text-sm text-gray-500 font-medium">
          {sorted.length}件の価格変動があります
        </p>

        {/* リスト */}
        {sorted.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-gray-400 text-sm">この期間に価格変動した食材がありません</p>
            <p className="text-xs text-gray-400">
              食材の旧単価が設定されると表示されます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((item) => (
              <Link
                key={item.id}
                href={`/search/${item.id}`}
                className="block bg-white rounded-xl shadow-sm p-4 space-y-2 hover:bg-orange-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{item.ingredientName}</p>
                    {item.supplier && (
                      <p className="text-xs text-gray-400 mt-0.5">仕入先: {item.supplier}</p>
                    )}
                  </div>
                  <span
                    className="shrink-0 text-lg font-bold"
                    style={{ color: pctColor(item.pct) }}
                  >
                    {item.pct > 0 ? "+" : ""}{item.pct.toFixed(1)}% {item.pct > 0 ? "↑" : item.pct < 0 ? "↓" : "→"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">前回: ¥{item.oldPrice.toLocaleString()}</span>
                  <span className="text-gray-300">→</span>
                  <span className="font-semibold" style={{ color: pctColor(item.pct) }}>
                    今回: ¥{item.currentPrice.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>変更回数: {item.changeCount}回</span>
                  <span>最終更新: {formatDate(item.updatedAt)}</span>
                </div>
              </Link>
            ))}

            {displayCount < sorted.length && (
              <button
                type="button"
                onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
                className="w-full py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                もっと見る ({sorted.length - displayCount}件)
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
