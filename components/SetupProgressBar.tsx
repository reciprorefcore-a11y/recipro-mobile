"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  completedSteps: {
    ingredientMaster: boolean;
    menuImport: boolean;
    confirmation: boolean;
    costEstimation?: boolean;
  };
  onImportClick: () => void;
};

const TOTAL_STEPS = 4;

export default function SetupProgressBar({ completedSteps, onImportClick }: Props) {
  const completedCount = [
    completedSteps.ingredientMaster,
    completedSteps.menuImport,
    completedSteps.confirmation,
    completedSteps.costEstimation ?? false,
  ].filter(Boolean).length;

  const [showComplete, setShowComplete] = useState(false);
  const [hidden, setHidden] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const initial = isInitialMount.current;
    isInitialMount.current = false;
    if (completedCount === TOTAL_STEPS) {
      if (initial) {
        setHidden(true);
      } else {
        setShowComplete(true);
        const t = setTimeout(() => setHidden(true), 2000);
        return () => clearTimeout(t);
      }
    }
  }, [completedCount]);

  if (hidden) return null;
  if (completedCount < TOTAL_STEPS && !showComplete) {
    const remaining = TOTAL_STEPS - completedCount;
    return (
      <button
        type="button"
        onClick={onImportClick}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#FFF5F0",
          borderTop: "1px solid #F3E2D8",
          borderBottom: "1px solid #F3E2D8",
          borderLeft: "none",
          borderRight: "none",
          height: "48px",
          minHeight: "44px",
          paddingLeft: "16px",
          paddingRight: "16px",
          cursor: "pointer",
          borderRadius: "12px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            border: "2px solid #E85D2C",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "#E85D2C", fontSize: "12px", fontWeight: "bold", lineHeight: 1 }}>
            {completedCount}/{TOTAL_STEPS}
          </span>
        </div>

        <div style={{ flex: 1, textAlign: "center" }}>
          <p style={{ color: "#E85D2C", fontSize: "14px", fontWeight: "bold", margin: 0, lineHeight: 1.2 }}>
            初期設定 {completedCount}/{TOTAL_STEPS}
          </p>
          <p style={{ color: "#666", fontSize: "13px", margin: 0, lineHeight: 1.2 }}>
            あと{remaining}ステップで使えます
          </p>
        </div>

        <span style={{ color: "#E85D2C", fontSize: "24px", lineHeight: 1 }}>›</span>
      </button>
    );
  }

  if (showComplete) {
    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFF5F0",
          border: "1px solid #F3E2D8",
          height: "48px",
          borderRadius: "12px",
          gap: "8px",
        }}
      >
        <span style={{ color: "#E85D2C", fontSize: "18px" }}>✔</span>
        <span style={{ color: "#E85D2C", fontSize: "14px", fontWeight: "bold" }}>
          初期設定が完了しました
        </span>
      </div>
    );
  }

  return null;
}
