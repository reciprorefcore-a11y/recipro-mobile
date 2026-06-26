"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  addPriceHistory,
  getIngredient,
  getSuppliers,
  addSupplierToMaster,
  updateIngredient,
} from "@/lib/firestore";
import { formatDaysAgo } from "@/lib/utils";
import { toKatakana } from "@/lib/textUtils";
import { generateKanaFromName } from "@/lib/kanaUtils";
import type { Ingredient } from "@/types";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import SupplierSelect from "@/components/SupplierSelect";

const UNITS = ["kg", "g", "個", "L", "ml", "本", "袋", "ケース", "パック", "枚", "cc"];
const CATEGORY_OPTIONS = ["未分類", "野菜", "肉", "魚介", "調味料", "米・パン", "加工食品", "その他"];

export default function IngredientDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const ingredientId = params.ingredientId as string;

  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // メインフィールド
  const [newPrice, setNewPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [spec, setSpec] = useState("");
  const [unit, setUnit] = useState("kg");
  const [isActive, setIsActive] = useState(true);
  const [ingredientName, setIngredientName] = useState("");

  // 詳細設定フィールド
  const [ingredientNameKana, setIngredientNameKana] = useState("");
  const [supplierKana, setSupplierKana] = useState("");
  const [category, setCategory] = useState("");

  const companyId = user?.uid ?? "";

  const syncForm = (item: Ingredient) => {
    setNewPrice("");
    setSupplier(item.supplier ?? "");
    setSpec(item.spec ?? "");
    setUnit(item.unit || "kg");
    setIsActive(item.isActive);
    setIngredientName(item.ingredientName);
    setIngredientNameKana(item.ingredientNameKana ?? "");
    setSupplierKana(item.supplierKana ?? "");
    setCategory(item.category ?? "");
  };

  const handleAddNewSupplier = async (name: string) => {
    if (!companyId) return;
    await addSupplierToMaster(companyId, name);
    const updated = await getSuppliers(companyId);
    setSuppliers(updated.map((s) => s.name));
  };

  useEffect(() => {
    if (!companyId || !ingredientId) return;
    let ignore = false;
    Promise.all([
      getIngredient(companyId, ingredientId),
      getSuppliers(companyId),
    ]).then(([data, masterList]) => {
      if (ignore) return;
      setIngredient(data);
      if (data) syncForm(data);
      const masterNames = masterList.map((s) => s.name);
      // Include ingredient's current supplier even if it's not yet in master
      const allNames =
        data?.supplier && !masterNames.includes(data.supplier)
          ? [...masterNames, data.supplier]
          : masterNames;
      setSuppliers(allNames);
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, [companyId, ingredientId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredient || !companyId) return;

    if (!ingredientName.trim()) {
      setError("商品名を入力してください");
      return;
    }

    const parsedNewPrice = newPrice.trim() ? Number(newPrice) : null;
    if (parsedNewPrice !== null && (!Number.isFinite(parsedNewPrice) || parsedNewPrice < 0)) {
      setError("新単価は0以上の数値で入力してください");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const priceChanged = parsedNewPrice !== null && parsedNewPrice !== ingredient.currentPrice;

      // カナ自動生成（空の場合のみ）
      const finalKana = ingredientNameKana.trim()
        ? toKatakana(ingredientNameKana.trim())
        : generateKanaFromName(ingredientName.trim());
      const finalSupplierKana = supplierKana.trim()
        ? toKatakana(supplierKana.trim())
        : generateKanaFromName(supplier.trim());
      const finalCategory = category.trim() || "未分類";

      await updateIngredient(companyId, ingredient.id, {
        ingredientName: ingredientName.trim(),
        ingredientNameKana: finalKana,
        supplierKana: finalSupplierKana,
        category: finalCategory,
        ...(priceChanged ? {
          currentPrice: parsedNewPrice!,
          oldPrice: ingredient.currentPrice,
        } : {}),
        supplier: supplier.trim(),
        spec: spec.trim(),
        unit,
        isActive,
      });

      if (priceChanged) {
        await addPriceHistory(companyId, {
          ingredientId: ingredient.id,
          ingredientName: ingredientName.trim(),
          price: parsedNewPrice!,
          oldPrice: ingredient.currentPrice,
          source: "manual",
        });
      }

      router.push("/search");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/search")}
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
          </button>
          <h1 className="text-xl font-bold">食材編集</h1>
        </div>

        <Card>
          <p className="text-xs text-gray-500">
            最終更新: {formatDaysAgo(ingredient.updatedAt)}
          </p>
        </Card>

        <Card>
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="商品名"
              value={ingredientName}
              onChange={(e) => setIngredientName(e.target.value)}
              required
            />

            {/* 価格セクション */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">旧単価</span>
                <span className="text-sm text-gray-400 font-medium">
                  {ingredient.oldPrice != null ? `¥${ingredient.oldPrice.toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">現在単価</span>
                <span className="text-sm text-gray-600 font-semibold">
                  ¥{ingredient.currentPrice.toLocaleString()}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                新単価 (円)
                <span className="ml-1 text-xs text-gray-400 font-normal">— 変更する場合のみ入力</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder={`現在: ¥${ingredient.currentPrice.toLocaleString()}`}
                min="0"
                className="w-full rounded-xl border-2 border-primary px-4 py-3 text-[16px] font-bold outline-none focus:ring-2 focus:ring-primary bg-white"
              />
              {newPrice && Number(newPrice) !== ingredient.currentPrice && Number.isFinite(Number(newPrice)) && (
                <p className="mt-1 text-xs font-medium" style={{
                  color: Number(newPrice) > ingredient.currentPrice ? "#D93025" : "#0F9D58"
                }}>
                  {Number(newPrice) > ingredient.currentPrice ? "▲" : "▼"}{" "}
                  {Math.abs(((Number(newPrice) - ingredient.currentPrice) / ingredient.currentPrice) * 100).toFixed(1)}% 変動
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">取引先</label>
              <SupplierSelect
                value={supplier}
                onChange={setSupplier}
                suppliers={suppliers}
                onAddNew={handleAddNewSupplier}
              />
            </div>
            <Input
              label="規格"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="例: 1kg袋"
            />
            <div>
              <label className="block text-sm font-medium mb-1">単位</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* ── 詳細設定（折りたたみ） ── */}
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="w-full flex items-center justify-between py-2 border-t border-gray-100 text-xs text-gray-500 hover:text-gray-700"
            >
              <span>詳細設定（カナ・カテゴリ）</span>
              <span>{showAdvanced ? "▲" : "▼"}</span>
            </button>

            {showAdvanced && (
              <div className="space-y-3">
                <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                  レシプロ連携に影響します。未入力の場合は保存時に自動生成されます
                </p>
                <Input
                  label="商品名カナ（カタカナ）"
                  value={ingredientNameKana}
                  onChange={(e) => setIngredientNameKana(e.target.value)}
                  onBlur={(e) => setIngredientNameKana(toKatakana(e.target.value))}
                  placeholder="未入力の場合は自動生成"
                />
                <Input
                  label="取引先名カナ（カタカナ）"
                  value={supplierKana}
                  onChange={(e) => setSupplierKana(e.target.value)}
                  onBlur={(e) => setSupplierKana(toKatakana(e.target.value))}
                  placeholder="未入力の場合は自動生成"
                />
                <div>
                  <label className="block text-sm font-medium mb-1">カテゴリ</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c === "未分類" ? "" : c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">{error}</p>
            )}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "保存中..." : "保存"}
            </Button>
          </form>
        </Card>

      </div>
    </main>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "保存に失敗しました";
}
