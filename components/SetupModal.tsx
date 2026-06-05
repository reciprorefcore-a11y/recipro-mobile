"use client";

import { useRouter } from "next/navigation";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  completedSteps: {
    ingredientMaster: boolean;
    menuImport: boolean;
    confirmation: boolean;
    costEstimation?: boolean;
  };
  onResumeClick?: () => void;
};

const STEPS = [
  { key: "ingredientMaster" as const, label: "食材マスター作成", stepNum: 1 },
  { key: "confirmation" as const, label: "商品リスト確認", stepNum: 3 },
  // menuImport（メニュー取り込み）は 2026/06 より UI 非表示。将来再有効化可能。
];

const TOTAL = STEPS.length;

export default function SetupModal({ isOpen, onClose, completedSteps }: Props) {
  const router = useRouter();

  if (!isOpen) return null;

  const completedCount = STEPS.filter((s) => completedSteps[s.key] ?? false).length;
  const remaining = TOTAL - completedCount;
  const firstIncomplete = STEPS.find((s) => !(completedSteps[s.key] ?? false))?.stepNum ?? 1;

  const goToStep = (stepNum: number) => {
    onClose();
    router.push(`/onboarding?step=${stepNum}`);
  };

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#333", margin: 0 }}>
            初期設定（あと{remaining}ステップ）
          </h2>
          <p style={{ fontSize: "13px", color: "#666", marginTop: "6px", marginBottom: 0 }}>
            初期設定を完了すると、価格変動追跡が使えるようになります。
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {STEPS.map((s) => {
            const done = completedSteps[s.key] ?? false;
            return (
              <button
                type="button"
                key={s.key}
                onClick={() => goToStep(s.stepNum)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  backgroundColor: done ? "#FFF5F0" : "#F7F7F7",
                  border: done ? "1px solid #F3E2D8" : "1px solid #eee",
                  minHeight: "56px",
                  width: "100%",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    backgroundColor: done ? "#0F9D58" : "#ddd",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: "bold",
                    flexShrink: 0,
                  }}
                >
                  {done ? "✓" : ""}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: done ? "bold" : "normal",
                    color: done ? "#E85D2C" : "#666",
                    flex: 1,
                  }}
                >
                  {s.label}
                </span>
                <span style={{ color: "#ccc", fontSize: "18px", lineHeight: 1 }}>›</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            type="button"
            onClick={() => goToStep(firstIncomplete)}
            style={{
              width: "100%",
              minHeight: "52px",
              backgroundColor: "#E85D2C",
              color: "#fff",
              fontWeight: "bold",
              fontSize: "16px",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
            }}
          >
            続きから始める
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              minHeight: "48px",
              backgroundColor: "#fff",
              color: "#555",
              fontWeight: "bold",
              fontSize: "15px",
              border: "1.5px solid #ddd",
              borderRadius: "12px",
              cursor: "pointer",
            }}
          >
            あとで
          </button>
        </div>
      </div>
    </div>
  );
}
