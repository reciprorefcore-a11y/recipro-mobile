"use client";

import { useState } from "react";
import type { AiWorkflowResult } from "@/types";

type Props = {
  result: AiWorkflowResult;
  onConfirm: () => void;
  onRevise: () => void;
};

export default function AiWorkflowPanel({ result, onConfirm, onRevise }: Props) {
  const [showResult, setShowResult] = useState(false);

  if (!showResult) {
    return (
      <section className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-primary">確認</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">
            AIが{result.menuCandidates.length}商品を読み取りました
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            使用食材も自動で予測されています。
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-500">使用食材の予測概要</p>
          <p className="mt-1 text-sm text-gray-700">{result.usageSummary}</p>
        </div>

        <div className="space-y-2">
          {result.menuCandidates.slice(0, 8).map((menu, index) => (
            <div
              key={`${menu.name}-${index}`}
              className="rounded-xl border border-gray-100 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-gray-900">{menu.name}</p>
                <p className="text-xs text-gray-500">
                  信頼度 {Math.round(menu.confidence * 100)}%
                </p>
              </div>
              {menu.ingredients.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  使用食材: {menu.ingredients.slice(0, 4).join("、")}
                  {menu.ingredients.length > 4 ? "…" : ""}
                </p>
              )}
            </div>
          ))}
          {result.menuCandidates.length > 8 && (
            <p className="text-xs text-gray-500">
              ほか {result.menuCandidates.length - 8} 商品があります
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setShowResult(true);
              onConfirm();
            }}
            className="min-h-12 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
          >
            この内容で確認する
          </button>
          <button
            type="button"
            onClick={onRevise}
            className="min-h-12 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700"
          >
            修正する
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
      <div className="rounded-xl border-l-4 border-[#D93025] bg-red-50 px-4 py-3">
        <p className="text-sm font-semibold" style={{ color: "#D93025" }}>推定損失額</p>
        <p className="mt-1 text-3xl font-bold" style={{ color: "#D93025" }}>
          {formatLoss(result.estimatedMonthlyLoss)} / 月
        </p>
        <p className="mt-2 text-sm" style={{ color: "#D93025" }}>
          現在のメニュー構成では、月間 {formatLoss(result.estimatedMonthlyLoss)} の損失が見込まれます。
        </p>
      </div>

      <ResultList title="損失の主な原因" items={result.lossCauses} />
      <ResultList title="原価率が高いメニュー" items={result.highCostMenus} />
      <ImprovementList title="価格改定候補" items={result.priceChangeCandidates} />
      <ImprovementList title="食材変更候補" items={result.ingredientChangeCandidates} />

      <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
        レシプロで価格・レシピを調整できます。
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => window.open("https://recipro.jp/", "_blank", "noopener,noreferrer")}
          className="min-h-12 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
        >
          レシプロで修正する
        </button>
        <button
          type="button"
          onClick={onRevise}
          className="min-h-12 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700"
        >
          あとで確認する
        </button>
      </div>
    </section>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="text-sm text-gray-600">
              ・{item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-500">該当項目はありません</p>
      )}
    </div>
  );
}

function ImprovementList({
  title,
  items,
}: {
  title: string;
  items: { title: string; description: string; impact?: number }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {items.length > 0 ? (
        <div className="mt-2 space-y-2">
          {items.map((item, index) => (
            <div key={`${item.title}-${index}`} className="rounded-xl bg-gray-50 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                {item.impact != null && (
                  <p className="text-xs font-bold text-green-700">
                    {item.impact.toLocaleString()}円
                  </p>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-500">該当項目はありません</p>
      )}
    </div>
  );
}

function formatLoss(value: number | undefined) {
  if (value === undefined) return "未設定";
  return `-${Math.abs(value).toLocaleString()}円`;
}
