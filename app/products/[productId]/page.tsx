"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getProduct, updateProduct } from "@/lib/firestore";
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

  const handleMonthlySalesUpdate = async (sales: number) => {
    if (!product || !companyId) return;
    await updateProduct(companyId, product.id, { monthlySales: sales });
    setProduct((prev) => (prev ? { ...prev, monthlySales: sales } : prev));
  };

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

        <GrossProfitLossCard
          product={product}
          onMonthlySalesUpdate={handleMonthlySalesUpdate}
        />

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
      </div>
    </main>
  );
}
