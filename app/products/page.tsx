"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getProducts } from "@/lib/firestore";
import { seedProducts } from "@/lib/seedData";
import {
  formatGrossProfitLoss,
  formatSalesCount,
  getGrossProfitLoss,
} from "@/lib/grossProfitLoss";
import type { Product } from "@/types";

const COLOR_MAP = {
  danger: "#D93025",
  success: "#0F9D58",
  neutral: "#555555",
} as const;

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  const companyId = user?.uid ?? "";

  const fetchProducts = async () => {
    if (!companyId) return;
    const data = await getProducts(companyId);
    setProducts(data);
  };

  useEffect(() => {
    if (!companyId) return;
    let ignore = false;
    getProducts(companyId)
      .then((data) => { if (!ignore) setProducts(data); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [companyId]);

  const filtered = products.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.includes(q) || p.nameKana.includes(q);
  });

  const handleSeed = async () => {
    if (!companyId) return;
    setSeeding(true);
    setSeedMsg("");
    try {
      const count = await seedProducts(companyId);
      await fetchProducts();
      setSeedMsg(`✅ ${count}件投入しました`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setSeedMsg(`❌ ${e.message ?? "失敗しました"}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 font-medium"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-arrow-right.svg"
              alt=""
              width={16}
              height={16}
              style={{ filter: "brightness(0) opacity(0.5)", transform: "rotate(180deg)" }}
            />
            戻る
          </Link>
          <h1 className="text-xl font-bold">原価影響メニュー</h1>
        </div>

        {/* データ空(ローディング完了後)のみ表示 */}
        {!loading && products.length === 0 && (
          <div className="space-y-1">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="w-full py-3 text-sm text-gray-600 border border-dashed border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
            >
              {seeding ? "投入中..." : "🌱 デモデータを投入(初回のみ)"}
            </button>
            {seedMsg && <p className="text-xs text-center text-gray-500">{seedMsg}</p>}
          </div>
        )}

        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-search.svg"
            alt=""
            width={18}
            height={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="商品名で検索..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 pl-10 text-[16px] outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="rounded-xl bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
          商品リストは参照専用です。編集は食材マスタで行います。
        </div>

        <p className="text-sm text-gray-500 font-medium">
          原価影響メニュー ({filtered.length}件)
        </p>

        {loading ? (
          <p className="text-center text-sm text-gray-400 py-8">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">
            {searchQuery
              ? "該当する商品がありません"
              : "商品がありません。シードデータを投入してください。"}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((product) => {
              const {
                baseCost,
                currentCost,
                monthlySales,
                loss,
                accuracyLabel,
              } = getGrossProfitLoss(product);
              const { display, color } = formatGrossProfitLoss(loss);
              return (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="block bg-white rounded-2xl shadow-sm p-4 active:opacity-70 transition-opacity"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-bold text-gray-900 leading-tight">
                      {product.name}
                    </p>
                    <p
                      className="text-base font-bold whitespace-nowrap"
                      style={{ color: COLOR_MAP[color] }}
                    >
                      {display}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-gray-400">
                      基準 {baseCost}円 → 現在 {currentCost}円
                    </p>
                    <p className="text-xs" style={{ color: "#666666" }}>
                      {accuracyLabel}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    月間販売数 {formatSalesCount(monthlySales)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
