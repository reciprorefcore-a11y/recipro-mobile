"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getOrders, getIngredients } from "@/lib/firestore";
import Card from "./ui/Card";

type RankedItem = {
  ingredientId: string;
  ingredientName: string;
  supplier?: string;
  orderCount: number;
  totalAmount: number;
};

function getEmoji(name: string): string {
  if (/豚|牛|鶏|肉|ラム|ベーコン|ハム|ソーセージ|焼き鳥/.test(name)) return "🥩";
  if (/鮭|サーモン|マグロ|魚|エビ|海老|蟹|かに|タコ|イカ|貝|ホタテ|サバ|アジ|ブリ/.test(name)) return "🐟";
  if (/キャベツ|レタス|ほうれん|ネギ|葱|ニラ|小松菜|水菜|菜/.test(name)) return "🥬";
  if (/玉ねぎ|ごぼう|人参|にんじん|大根|じゃがいも|芋|かぼちゃ|ブロッコリー/.test(name)) return "🧅";
  if (/米|ご飯|パン|小麦|麺|うどん|そば|パスタ|ライス/.test(name)) return "🍚";
  if (/牛乳|チーズ|乳|バター|クリーム|ヨーグルト/.test(name)) return "🧀";
  if (/醤油|味噌|酢|砂糖|塩|油|調味|ソース|ドレッシング|みりん|出汁|だし/.test(name)) return "🧂";
  if (/卵|たまご|玉子/.test(name)) return "🥚";
  if (/豆腐|豆|納豆|おから/.test(name)) return "🫘";
  if (/きのこ|しいたけ|えのき|なめこ|マッシュルーム/.test(name)) return "🍄";
  return "📦";
}

function formatAmount(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export default function TopOrderedIngredients() {
  const { user } = useAuth();
  const router = useRouter();
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

  const maxAmount = Math.max(...items.map((i) => i.totalAmount), 1);

  return (
    <Card>
      <p className="text-sm font-medium text-gray-700 mb-3">発注数が多い食材（累計金額）</p>
      <div className="space-y-3">
        {items.map((item) => {
          const pct = maxAmount > 0 ? (item.totalAmount / maxAmount) * 100 : 0;
          return (
            <button
              key={item.ingredientId}
              type="button"
              onClick={() => router.push(`/price-changes/${item.ingredientId}`)}
              className="w-full text-left rounded-xl p-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg leading-none">{getEmoji(item.ingredientName)}</span>
                <span className="font-medium text-gray-900 text-sm truncate flex-1">
                  {item.ingredientName}
                </span>
                {item.totalAmount > 0 && (
                  <span className="text-sm font-bold text-gray-800 shrink-0">
                    {formatAmount(item.totalAmount)}
                  </span>
                )}
              </div>
              {/* バーグラフ */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: "linear-gradient(90deg, #E85D2C, #f59e0b)",
                  }}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>発注 {item.orderCount}回</span>
                {item.supplier && <span>· {item.supplier}</span>}
                <span className="ml-auto">詳細 ›</span>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
