"use client";

import { useState } from "react";
import Input from "./ui/Input";
import Button from "./ui/Button";
import SupplierSelect from "./SupplierSelect";
import { toKatakana } from "@/lib/textUtils";
import { generateKanaFromName } from "@/lib/kanaUtils";

type AddData = {
  ingredientName: string;
  ingredientNameKana: string;
  unit: string;
  currentPrice: number;
  supplier: string;
  supplierKana?: string;
  category?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: AddData) => Promise<void>;
  suppliers?: string[];
};

const UNITS = ["kg", "g", "個", "L", "缶", "パック", "本", "枚"];
const CATEGORY_OPTIONS = ["未分類", "野菜", "肉", "魚介", "調味料", "米・パン", "加工食品", "その他"];

export default function AddIngredientModal({ isOpen, onClose, onAdd, suppliers = [] }: Props) {
  const [ingredientName, setIngredientName] = useState("");
  const [ingredientNameKana, setIngredientNameKana] = useState("");
  const [unit, setUnit] = useState("kg");
  const [currentPrice, setCurrentPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [supplierKana, setSupplierKana] = useState("");
  const [category, setCategory] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const reset = () => {
    setIngredientName("");
    setIngredientNameKana("");
    setUnit("kg");
    setCurrentPrice("");
    setSupplier("");
    setSupplierKana("");
    setCategory("");
    setShowAdvanced(false);
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientName || !currentPrice) {
      setError("食材名と価格は必須です");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const finalKana = ingredientNameKana.trim()
        ? toKatakana(ingredientNameKana.trim())
        : generateKanaFromName(ingredientName.trim());
      const finalSupplierKana = supplierKana.trim()
        ? toKatakana(supplierKana.trim())
        : generateKanaFromName(supplier.trim());
      const finalCategory = category || "未分類";

      await onAdd({
        ingredientName,
        ingredientNameKana: finalKana,
        unit,
        currentPrice: Number(currentPrice),
        supplier,
        supplierKana: finalSupplierKana || undefined,
        category: finalCategory,
      });
      reset();
      onClose();
    } catch (err: unknown) {
      const fe = err as { message?: string };
      setError(fe.message || "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* z-index 200: ボトムナビ(100)より上 */
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center"
      style={{ zIndex: 200 }}
      onClick={handleClose}
    >
      <form
        id="add-ingredient-form"
        onSubmit={handleSubmit}
        className="w-full max-w-[480px] bg-white rounded-t-2xl flex flex-col"
        style={{ maxHeight: "90svh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── ヘッダー(固定) ───────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-lg font-bold">新しい食材を追加</h2>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-close.svg" alt="閉じる" width={20} height={20} />
          </button>
        </div>

        {/* ── スクロール可能なフォーム領域 ─────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {/* ── メインフィールド ── */}
          <Input
            label="食材名 *"
            type="text"
            value={ingredientName}
            onChange={(e) => setIngredientName(e.target.value)}
            placeholder="例: 豚バラスライス"
            required
          />

          {/* 価格セクション */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">旧単価</span>
              <span className="text-sm text-gray-400">—</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">現在単価</span>
              <span className="text-sm text-gray-400">—</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">新単価 (初期価格) (円) *</label>
            <input
              type="number"
              inputMode="numeric"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              placeholder="例: 580"
              min="0"
              required
              className="w-full rounded-xl border-2 border-primary px-4 py-3 text-[16px] font-bold outline-none focus:ring-2 focus:ring-primary bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">仕入先 (任意)</label>
            <SupplierSelect
              value={supplier}
              onChange={setSupplier}
              suppliers={suppliers}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">単位</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
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
            <div className="space-y-3 pb-1">
              <Input
                label="商品名カナ（カタカナ）"
                type="text"
                value={ingredientNameKana}
                onChange={(e) => setIngredientNameKana(e.target.value)}
                onBlur={(e) => setIngredientNameKana(toKatakana(e.target.value))}
                placeholder="未入力の場合は自動生成"
              />
              <Input
                label="取引先名カナ（カタカナ）"
                type="text"
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
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
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
        </div>

        {/* ── 登録ボタン(sticky footer) ─────────────── */}
        <div
          className="shrink-0 px-6 pt-3 bg-white border-t border-gray-100"
          style={{
            paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "登録中..." : "食材を追加"}
          </Button>
        </div>
      </form>
    </div>
  );
}
