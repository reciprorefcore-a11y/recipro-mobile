"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getIngredient, updateIngredientPrice, addPriceHistory } from "@/lib/firestore";
import { formatDaysAgo } from "@/lib/utils";
import type { Ingredient } from "@/types";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

export default function IngredientDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const ingredientId = params.ingredientId as string;

  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const companyId = user?.uid ?? "";

  useEffect(() => {
    if (!companyId || !ingredientId) return;
    getIngredient(companyId, ingredientId)
      .then((data) => setIngredient(data))
      .finally(() => setLoading(false));
  }, [companyId, ingredientId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredient || !companyId) return;
    const price = Number(newPrice);
    if (isNaN(price) || price <= 0) {
      setError("有効な価格を入力してください");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateIngredientPrice(companyId, ingredient.id, price);
      await addPriceHistory(companyId, {
        ingredientId: ingredient.id,
        ingredientName: ingredient.ingredientName,
        price,
      });
      router.push("/search");
    } catch (err: unknown) {
      const fe = err as { message?: string };
      setError(fe.message || "保存に失敗しました");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        読み込み中...
      </div>
    );
  }

  if (!ingredient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-500">食材が見つかりません</p>
          <Link href="/search" className="text-primary underline text-sm">
            一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 font-medium"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-arrow-right.svg" alt="" width={16} height={16}
              style={{ filter: "brightness(0) opacity(0.5)", transform: "rotate(180deg)" }} />
            戻る
          </Link>
          <h1 className="text-xl font-bold">{ingredient.ingredientName}</h1>
        </div>

        {/* 食材情報カード */}
        <Card>
          <dl className="space-y-2.5">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">食材名</dt>
              <dd className="font-medium text-gray-900">{ingredient.ingredientName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">単位</dt>
              <dd className="font-medium text-gray-900">{ingredient.unit}</dd>
            </div>
            {ingredient.supplier && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">仕入先</dt>
                <dd className="font-medium text-gray-900">{ingredient.supplier}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">最終更新</dt>
              <dd className="font-medium text-gray-600">
                {formatDaysAgo(ingredient.updatedAt)}
              </dd>
            </div>
          </dl>
        </Card>

        {/* 現在価格 */}
        <Card>
          <p className="text-sm text-gray-500 mb-1">現在の価格</p>
          <p className="text-3xl font-bold text-gray-900">
            {ingredient.currentPrice.toLocaleString()}円
            <span className="text-base font-normal text-gray-500">/{ingredient.unit}</span>
          </p>
        </Card>

        {/* 価格更新フォーム */}
        <Card>
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="新しい価格 (円)"
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder={`例: ${ingredient.currentPrice}`}
              min="0"
              required
            />
            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">{error}</p>
            )}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "保存中..." : "価格を保存"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
