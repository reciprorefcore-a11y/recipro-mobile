"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "./ui/Card";
import Input from "./ui/Input";
import Button from "./ui/Button";
import {
  getGrossProfitLoss,
  formatGrossProfitLoss,
  formatBreakdown,
} from "@/lib/grossProfitLoss";
import type { Product } from "@/types";

type Props = {
  product: Product;
  onMonthlySalesUpdate?: (sales: number) => Promise<void>;
};

const COLOR_MAP = {
  danger: "#D93025",
  success: "#0F9D58",
  neutral: "#555555",
} as const;

export default function GrossProfitLossCard({
  product,
  onMonthlySalesUpdate,
}: Props) {
  const router = useRouter();
  const { costDiff, monthlySales, loss, accuracyLabel } =
    getGrossProfitLoss(product);
  const { display, color } = formatGrossProfitLoss(loss);
  const breakdown = formatBreakdown(costDiff, monthlySales);

  const isLoss = loss !== undefined && loss > 0;
  const isImprovement = loss !== undefined && loss < 0;

  const [modalOpen, setModalOpen] = useState(false);
  const [salesInput, setSalesInput] = useState(
    product.monthlySalesCount
      ? String(product.monthlySalesCount)
      : product.monthlySales
      ? String(product.monthlySales)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [inputError, setInputError] = useState("");

  const handleSalesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(salesInput);
    if (!Number.isFinite(val) || val <= 0) {
      setInputError("1以上の整数を入力してください");
      return;
    }
    setInputError("");
    setSaving(true);
    try {
      const sales = Math.floor(val);
      await onMonthlySalesUpdate?.(sales);
      setSalesInput(String(sales));
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className={isLoss ? "border-l-4 border-[#D93025]" : isImprovement ? "border-l-4 border-[#0F9D58]" : "border-l-4 border-gray-300"}>
        <p className="text-sm font-semibold text-gray-500 mb-1">推定粗利損失</p>
        <p
          className="text-4xl font-bold leading-tight"
          style={{ color: COLOR_MAP[color] }}
        >
          {display}
          <span className="text-base font-normal text-gray-500 ml-1">/ 月</span>
        </p>
        <p className="text-sm text-gray-500 mt-1">{breakdown}</p>
        <p className="text-xs mt-1" style={{ color: "#666666" }}>
          {accuracyLabel}
        </p>

        <div className="grid grid-cols-1 gap-2 mt-4 sm:grid-cols-3">
          {onMonthlySalesUpdate && (
            <button
              onClick={() => setModalOpen(true)}
              className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              月間販売数を変更
            </button>
          )}
          <button
            onClick={() => router.push("/search")}
            className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            食材を見直す
          </button>
          <button
            onClick={() => router.push("/recipes")}
            className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            レシピを編集
          </button>
        </div>
      </Card>

      {modalOpen && (
        /* z-index 200: ボトムナビ(100)より上 */
        <div
          className="fixed inset-0 bg-black/50 flex items-end justify-center"
          style={{ zIndex: 200 }}
          onClick={() => setModalOpen(false)}
        >
          <form
            onSubmit={handleSalesSubmit}
            className="w-full max-w-[480px] bg-white rounded-t-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold">月間販売数を変更</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <Input
                label="月間販売数 (食)"
                type="number"
                value={salesInput}
                onChange={(e) => setSalesInput(e.target.value)}
                placeholder="例: 800"
                min="1"
              />
              {inputError && (
                <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">
                  {inputError}
                </p>
              )}
            </div>
            <div
              className="px-6 pt-2 border-t border-gray-100"
              style={{
                paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
              }}
            >
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
