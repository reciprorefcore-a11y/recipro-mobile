"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { AiWorkflowResult } from "@/types";
import AiWorkflowPanel from "@/components/AiWorkflowPanel";

export default function RecipesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiWorkflowResult | null>(null);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/ai/workflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId: user.uid,
          source: "menu",
        }),
      });

      if (response.status === 429) {
        setError("本日の解析上限に達しました");
        return;
      }
      if (!response.ok) {
        setError("AI解析に失敗しました。再度お試しください");
        return;
      }

      setResult((await response.json()) as AiWorkflowResult);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-text">レシピ</h1>

        {loading ? (
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4 text-center">
            <span className="mx-auto block h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900">
                AIがメニューと食材を解析しています
              </h2>
              <p className="text-sm text-gray-600">原価と損失を計算中です</p>
              <p className="text-sm text-gray-500">そのままお待ちください</p>
            </div>
          </section>
        ) : result ? (
          <AiWorkflowPanel
            result={result}
            onConfirm={() => undefined}
            onRevise={() => setResult(null)}
          />
        ) : (
          <section className="bg-white rounded-2xl shadow-sm p-8 flex flex-col items-center gap-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-recipe.svg"
              alt=""
              width={48}
              height={48}
              className="opacity-30"
            />
            <div>
              <p className="font-semibold text-text">AIでメニュー生成</p>
              <p className="mt-1 text-sm text-sub-text">
                AIがメニュー候補、使用食材、原価影響、改善候補をまとめて解析します。
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
            >
              AIでメニュー生成
            </button>
          </section>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
