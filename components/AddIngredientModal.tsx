"use client";

import { useState } from "react";
import Input from "./ui/Input";
import Button from "./ui/Button";

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
};

const UNITS = ["kg", "g", "個", "L", "缶", "パック", "本", "枚"];

export default function AddIngredientModal({ isOpen, onClose, onAdd }: Props) {
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
        ingredientNameKana,
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
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="w-full max-w-[480px] bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
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

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="食材名 *"
            type="text"
            value={ingredientName}
            onChange={(e) => setIngredientName(e.target.value)}
            placeholder="例: 豚バラスライス"
            required
          />
          <Input
            label="ひらがな *"
            type="text"
            value={ingredientNameKana}
            onChange={(e) => setIngredientNameKana(e.target.value)}
            placeholder="例: ぶたばらすらいす"
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
          <Input
            label="仕入先 (任意)"
            type="text"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="例: 田中精肉店"
          />

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "登録中..." : "食材を追加"}
          </Button>
        </form>
      </div>
    </div>
  );
}
