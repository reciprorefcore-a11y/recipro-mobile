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

  const isLoss = loss > 0;
  const title = isLoss ? "推定粗利損失" : loss < 0 ? "粗利改善" : "粗利損失";

  const [modalOpen, setModalOpen] = useState(false);
  const [salesInput, setSalesInput] = useState(
    product.monthlySales ? String(product.monthlySales) : ""
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
      await onMonthlySalesUpdate?.(Math.floor(val));
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className={isLoss ? "border-l-4 border-[#D93025]" : loss < 0 ? "border-l-4 border-[#0F9D58]" : ""}>
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        <p
          className="text-3xl font-bold leading-tight"
          style={{ color: COLOR_MAP[color] }}
        >
          {display}
          <span className="text-base font-normal text-gray-500 ml-1">/ 月</span>
        </p>
        <p className="text-sm text-gray-500 mt-1">{breakdown}</p>
        <p className="text-xs mt-1" style={{ color: "#666666" }}>
          {accuracyLabel}
        </p>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setModalOpen(true)}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            月間販売数を変更
          </button>
          <button
            onClick={() => router.push("/search")}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            食材を見直す
          </button>
          <button
            onClick={() => router.push(`/products/${product.id}`)}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            レシピを編集
          </button>
        </div>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="w-full max-w-[480px] bg-white rounded-t-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">月間販売数を変更</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSalesSubmit} className="space-y-3">
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
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "保存中..." : "保存"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
