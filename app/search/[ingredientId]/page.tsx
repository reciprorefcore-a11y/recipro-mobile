"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  addPriceHistory,
  getIngredient,
  getIngredients,
  updateIngredient,
} from "@/lib/firestore";
import { formatDaysAgo } from "@/lib/utils";
import type { Ingredient } from "@/types";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import SupplierSelect from "@/components/SupplierSelect";
import { toKatakana } from "@/lib/textUtils";

const UNITS = ["kg", "g", "個", "L", "ml", "本", "袋", "ケース", "パック", "枚", "cc"];

type EditMode = "main" | "advanced";

export default function IngredientDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const ingredientId = params.ingredientId as string;

  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [mode, setMode] = useState<EditMode>("main");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suppliers, setSuppliers] = useState<string[]>([]);

  const [newPrice, setNewPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [spec, setSpec] = useState("");
  const [unit, setUnit] = useState("kg");
  const [isActive, setIsActive] = useState(true);

  const [ingredientName, setIngredientName] = useState("");
  const [ingredientNameKana, setIngredientNameKana] = useState("");
  const [myCatalogId, setMyCatalogId] = useState("");
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
    setMyCatalogId(item.myCatalogId ?? "");
    setSupplierKana(item.supplierKana ?? "");
    setCategory(item.category ?? "");
  };

  useEffect(() => {
    if (!companyId || !ingredientId) return;
    let ignore = false;
    Promise.all([
      getIngredient(companyId, ingredientId),
      getIngredients(companyId),
    ]).then(([data, all]) => {
      if (ignore) return;
      setIngredient(data);
      if (data) syncForm(data);
      const names = Array.from(
        new Set(all.map((i) => i.supplier).filter((s): s is string => !!s))
      );
      setSuppliers(names);
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [companyId, ingredientId]);

  const handleMainSave = async (e: React.FormEvent) => {
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

      await updateIngredient(companyId, ingredient.id, {
        ingredientName: ingredientName.trim(),
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

  const handleAdvancedSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredient || !companyId) return;
    if (!ingredientName.trim()) {
      setError("商品名を入力してください");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateIngredient(companyId, ingredient.id, {
        ingredientName: ingredientName.trim(),
        ingredientNameKana: toKatakana(ingredientNameKana.trim()),
        supplierKana: toKatakana(supplierKana.trim()),
        category: category.trim(),
      });
      router.push("/search");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  const handleOpenAdvanced = () => {
    if (window.confirm("マスタ情報を変更しますか？")) {
      setError("");
      setMode("advanced");
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
            onClick={() => (mode === "advanced" ? setMode("main") : router.push("/search"))}
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
          <h1 className="text-xl font-bold">
            {mode === "advanced" ? "詳細設定" : "食材編集"}
          </h1>
        </div>

        {mode === "main" ? (
          <MainEditView
            ingredient={ingredient}
            ingredientName={ingredientName}
            newPrice={newPrice}
            supplier={supplier}
            spec={spec}
            unit={unit}
            isActive={isActive}
            saving={saving}
            error={error}
            suppliers={suppliers}
            onIngredientNameChange={setIngredientName}
            onNewPriceChange={setNewPrice}
            onSupplierChange={setSupplier}
            onSpecChange={setSpec}
            onUnitChange={setUnit}
            onActiveChange={setIsActive}
            onSubmit={handleMainSave}
            onOpenAdvanced={handleOpenAdvanced}
          />
        ) : (
          <AdvancedEditView
            ingredient={ingredient}
            ingredientName={ingredientName}
            ingredientNameKana={ingredientNameKana}
            supplierKana={supplierKana}
            category={category}
            saving={saving}
            error={error}
            onIngredientNameChange={setIngredientName}
            onIngredientNameKanaChange={setIngredientNameKana}
            onSupplierKanaChange={setSupplierKana}
            onCategoryChange={setCategory}
            onSubmit={handleAdvancedSave}
          />
        )}
      </div>
    </main>
  );
}

function MainEditView({
  ingredient,
  ingredientName,
  newPrice,
  supplier,
  spec,
  unit,
  isActive,
  saving,
  error,
  suppliers,
  onIngredientNameChange,
  onNewPriceChange,
  onSupplierChange,
  onSpecChange,
  onUnitChange,
  onActiveChange,
  onSubmit,
  onOpenAdvanced,
}: {
  ingredient: Ingredient;
  ingredientName: string;
  newPrice: string;
  supplier: string;
  spec: string;
  unit: string;
  isActive: boolean;
  saving: boolean;
  error: string;
  suppliers: string[];
  onIngredientNameChange: (value: string) => void;
  onNewPriceChange: (value: string) => void;
  onSupplierChange: (value: string) => void;
  onSpecChange: (value: string) => void;
  onUnitChange: (value: string) => void;
  onActiveChange: (value: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onOpenAdvanced: () => void;
}) {
  return (
    <>
      <Card>
        <p className="text-xs text-gray-500">
          最終更新: {formatDaysAgo(ingredient.updatedAt)}
        </p>
      </Card>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="商品名"
            value={ingredientName}
            onChange={(e) => onIngredientNameChange(e.target.value)}
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
              onChange={(e) => onNewPriceChange(e.target.value)}
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
            <label className="block text-sm font-medium mb-1">仕入先</label>
            <SupplierSelect
              value={supplier}
              onChange={onSupplierChange}
              suppliers={suppliers}
            />
          </div>
          <Input
            label="規格"
            value={spec}
            onChange={(e) => onSpecChange(e.target.value)}
            placeholder="例: 1kg袋"
          />
          <div>
            <label className="block text-sm font-medium mb-1">単位</label>
            <select
              value={unit}
              onChange={(e) => onUnitChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
            >
              {UNITS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-gray-900">有効</span>
              <span className="block text-xs text-gray-500">
                無効にするとCSVエクスポートから除外されます
              </span>
            </span>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => onActiveChange(e.target.checked)}
              className="h-5 w-5 accent-[#E85D2C]"
            />
          </label>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">{error}</p>
          )}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "保存中..." : "保存"}
          </Button>
        </form>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onOpenAdvanced}
          className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          詳細設定
        </button>
      </div>
    </>
  );
}

function AdvancedEditView({
  ingredient,
  ingredientName,
  ingredientNameKana,
  supplierKana,
  category,
  saving,
  error,
  onIngredientNameChange,
  onIngredientNameKanaChange,
  onSupplierKanaChange,
  onCategoryChange,
  onSubmit,
}: {
  ingredient: Ingredient;
  ingredientName: string;
  ingredientNameKana: string;
  supplierKana: string;
  category: string;
  saving: boolean;
  error: string;
  onIngredientNameChange: (value: string) => void;
  onIngredientNameKanaChange: (value: string) => void;
  onSupplierKanaChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <>
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
        この変更はレシプロ連携に影響します。内容を確認のうえ編集してください
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="商品名"
            value={ingredientName}
            onChange={(e) => onIngredientNameChange(e.target.value)}
            required
          />
          <Input
            label="商品名カナ (カタカナ)"
            value={ingredientNameKana}
            onChange={(e) => onIngredientNameKanaChange(e.target.value)}
            onBlur={(e) => onIngredientNameKanaChange(toKatakana(e.target.value))}
            placeholder="例: ブタバラスライス"
          />
          <Input
            label="取引先名カナ (カタカナ)"
            value={supplierKana}
            onChange={(e) => onSupplierKanaChange(e.target.value)}
            onBlur={(e) => onSupplierKanaChange(toKatakana(e.target.value))}
            placeholder="例: タカセブッサン"
          />
          <Input
            label="カテゴリ"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
          />

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">{error}</p>
          )}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "保存中..." : "詳細設定を保存"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-bold text-gray-900">編集不可項目</h2>
        <dl className="mt-3 space-y-2.5">
          <ReadonlyRow label="Firestore ID" value={ingredient.id} />
          <ReadonlyRow label="uniqueId" value={ingredient.uniqueId} />
          <ReadonlyRow label="companyId" value={ingredient.companyId} />
          <ReadonlyRow label="smaregiCode" value={ingredient.smaregiCode} />
          <ReadonlyRow label="smaregiDept" value={ingredient.smaregiDept} />
          <ReadonlyRow label="globalCategory" value={ingredient.globalCategory} />
          <ReadonlyRow label="globalCategoryId" value={ingredient.globalCategoryId} />
        </dl>
      </Card>
    </>
  );
}

function ReadonlyRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-sm text-gray-500">{label}</dt>
      <dd className="min-w-0 break-all text-right text-sm font-medium text-gray-700">
        {value || "未設定"}
      </dd>
    </div>
  );
}

function toRequiredNumber(value: string, label: string) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return { error: `${label}は0以上の数値で入力してください`, value: 0 };
  }
  return { error: "", value: num };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "保存に失敗しました";
}
