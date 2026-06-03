"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getIngredients } from "@/lib/firestore";
import { buildCsvPreviewStats, type CsvPreviewStats } from "@/lib/ingredientMatcher";

type Phase =
  | { name: "idle" }
  | { name: "loading" }
  | { name: "preview"; stats: CsvPreviewStats }
  | { name: "downloading" }
  | { name: "error"; message: string };

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export default function CsvDownloadButton() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  const handleOpen = async () => {
    if (!user) return;
    setPhase({ name: "loading" });
    try {
      const ingredients = await getIngredients(user.uid);
      const stats = buildCsvPreviewStats(ingredients);
      setPhase({ name: "preview", stats });
    } catch {
      setPhase({ name: "error", message: "食材データの取得に失敗しました" });
    }
  };

  const handleDownload = async () => {
    if (phase.name !== "preview" || !user) return;
    setPhase({ name: "downloading" });
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/csv/ingredients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("CSV生成に失敗しました");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ingredient_master_${todayString()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setPhase({ name: "idle" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "エラーが発生しました";
      setPhase({ name: "error", message: msg });
    }
  };

  const handleClose = () => setPhase({ name: "idle" });

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={phase.name === "loading" || phase.name === "downloading"}
        className="w-full py-2.5 text-sm font-medium border rounded-xl transition-colors hover:opacity-80 disabled:opacity-50"
        style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
      >
        {phase.name === "loading" ? "読み込み中..." : "CSVエクスポート"}
      </button>

      {phase.name === "error" && (
        <p className="text-xs text-red-500 text-center mt-1">{phase.message}</p>
      )}

      {phase.name === "preview" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
          onClick={handleClose}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              backgroundColor: "#fff",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 16px + 60px)",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-text">CSVエクスポート確認</h2>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-sub-text">合計食材数</span>
                <span className="font-semibold text-text">{phase.stats.total}件</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sub-text">既存（マイカタログIDあり）</span>
                <span className="font-semibold text-green-600">{phase.stats.existing}件</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sub-text">新規登録</span>
                <span className="font-semibold text-blue-600">{phase.stats.newItems}件</span>
              </div>
            </div>

            {phase.stats.warnings.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-amber-700">
                  ⚠️ 警告 ({phase.stats.warnings.length}件)
                </p>
                <ul className="space-y-1">
                  {phase.stats.warnings.slice(0, 5).map((w, i) => (
                    <li key={i} className="text-xs text-amber-600">
                      {w.ingredientName}: {w.issue}
                    </li>
                  ))}
                  {phase.stats.warnings.length > 5 && (
                    <li className="text-xs text-amber-500">
                      ...他{phase.stats.warnings.length - 5}件
                    </li>
                  )}
                </ul>
              </div>
            )}

            <p className="text-xs text-sub-text">
              ファイル名: ingredient_master_{todayString()}.csv (Shift-JIS)
            </p>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleClose}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-sub-text hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "#E85D2C" }}
              >
                ダウンロード
              </button>
            </div>
          </div>
        </div>
      )}

      {phase.name === "downloading" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <div className="bg-white rounded-2xl px-8 py-6">
            <p className="text-sm text-text">CSV生成中...</p>
          </div>
        </div>
      )}
    </>
  );
}
