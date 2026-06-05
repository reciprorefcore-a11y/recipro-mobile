"use client";

import { useState } from "react";
import Input from "./ui/Input";
import Button from "./ui/Button";
import SupplierSelect from "./SupplierSelect";
import { toKatakana } from "@/lib/textUtils";

type AddData = {
  ingredientName: string;
  ingredientNameKana: string;
  unit: string;
  currentPrice: number;
  supplier: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: AddData) => Promise<void>;
  suppliers?: string[];
};

const UNITS = ["kg", "g", "個", "L", "缶", "パック", "本", "枚"];

export default function AddIngredientModal({ isOpen, onClose, onAdd, suppliers = [] }: Props) {
  const [ingredientName, setIngredientName] = useState("");
  const [ingredientNameKana, setIngredientNameKana] = useState("");
  const [unit, setUnit] = useState("kg");
  const [currentPrice, setCurrentPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const reset = () => {
    setIngredientName("");
    setIngredientNameKana("");
    setUnit("kg");
    setCurrentPrice("");
    setSupplier("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientName || !ingredientNameKana || !currentPrice) {
      setError("食材名・ひらがな・価格は必須です");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onAdd({
        ingredientName,
        ingredientNameKana: toKatakana(ingredientNameKana),
        unit,
        currentPrice: Number(currentPrice),
        supplier,
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
      {/* form でラップし、flex-col で header/scroll/footer を分離 */}
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
          <Input
            label="食材名 *"
            type="text"
            value={ingredientName}
            onChange={(e) => setIngredientName(e.target.value)}
            placeholder="例: 豚バラスライス"
            required
          />
          <Input
            label="読みがな (カタカナ) *"
            type="text"
            value={ingredientNameKana}
            onChange={(e) => setIngredientNameKana(e.target.value)}
            onBlur={(e) => setIngredientNameKana(toKatakana(e.target.value))}
            placeholder="例: ブタバラスライス"
            required
          />
          <div>
            <label className="block text-sm font-medium mb-1">単位 *</label>
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
          <Input
            label="初期価格 (円) *"
            type="number"
            value={currentPrice}
            onChange={(e) => setCurrentPrice(e.target.value)}
            placeholder="例: 580"
            min="0"
            required
          />
          <div>
            <label className="block text-sm font-medium mb-1">仕入先 (任意)</label>
            <SupplierSelect
              value={supplier}
              onChange={setSupplier}
              suppliers={suppliers}
            />
          </div>

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
