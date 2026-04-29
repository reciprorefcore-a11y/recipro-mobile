"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getProduct } from "@/lib/firestore";
import type { Product } from "@/types";
import Card from "@/components/ui/Card";
import GrossProfitLossCard from "@/components/GrossProfitLossCard";

export default function ProductDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const productId = params.productId as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const companyId = user?.uid ?? "";

  useEffect(() => {
    if (!companyId || !productId) return;
    getProduct(companyId, productId)
      .then((data) => setProduct(data))
      .finally(() => setLoading(false));
  }, [companyId, productId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        読み込み中...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-500">商品が見つかりません</p>
          <Link href="/products" className="text-primary underline text-sm">
            一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">

        <div className="flex items-center gap-3">
          <Link
            href="/products"
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
          <h1 className="text-xl font-bold">{product.name}</h1>
        </div>

        <GrossProfitLossCard product={product} />

        <Card>
          <dl className="space-y-2.5">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">商品名</dt>
              <dd className="font-medium text-gray-900">{product.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">販売単価</dt>
              <dd className="font-medium text-gray-900">
                {product.price.toLocaleString()}円
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">基準原価</dt>
              <dd className="font-medium text-gray-900">
                {product.baseCost.toLocaleString()}円
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">現在原価</dt>
              <dd className="font-medium text-gray-900">
                {product.currentCost.toLocaleString()}円
              </dd>
            </div>
            {product.monthlySales != null && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">月間販売数</dt>
                <dd className="font-medium text-gray-900">
                  {product.monthlySales.toLocaleString()}食
                </dd>
              </div>
            )}
            {product.monthlyRevenue != null && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">月間売上</dt>
                <dd className="font-medium text-gray-900">
                  {product.monthlyRevenue.toLocaleString()}円
                </dd>
              </div>
            )}
            {product.category && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">カテゴリ</dt>
                <dd className="font-medium text-gray-900">{product.category}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-gray-900">使用食材一覧</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              参照専用
            </span>
          </div>
          {product.ingredientUsages && product.ingredientUsages.length > 0 ? (
            <div className="mt-3 space-y-2">
              {product.ingredientUsages.map((usage) => (
                <div
                  key={`${usage.ingredientId}-${usage.ingredientName}`}
                  className="rounded-xl bg-gray-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900">{usage.ingredientName}</p>
                    {usage.currentPrice != null && (
                      <p className="text-sm font-semibold text-gray-700">
                        {usage.currentPrice.toLocaleString()}円
                      </p>
                    )}
                  </div>
                  {usage.quantity != null && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      使用量 {usage.quantity}
                      {usage.unit ?? ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              使用食材データは未登録です。
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
