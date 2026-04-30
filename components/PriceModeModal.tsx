"use client";

import type { PriceMode } from "@/types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: PriceMode) => void;
};

export default function PriceModeModal({ isOpen, onClose, onSelect }: Props) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
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
          padding: "24px 20px 36px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#333", margin: 0 }}>
            価格設定
          </h2>
          <p style={{ fontSize: "14px", color: "#555", marginTop: "8px", marginBottom: 0, lineHeight: 1.6 }}>
            メニューに入力する価格は、税込ですか？ 税別ですか？
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            type="button"
            onClick={() => onSelect("taxIncluded")}
            style={{
              width: "100%",
              minHeight: "56px",
              backgroundColor: "#E85D2C",
              color: "#fff",
              fontWeight: "bold",
              fontSize: "16px",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
            }}
          >
            はい（税込）
          </button>
          <button
            type="button"
            onClick={() => onSelect("taxExcluded")}
            style={{
              width: "100%",
              minHeight: "52px",
              backgroundColor: "#fff",
              color: "#E85D2C",
              fontWeight: "bold",
              fontSize: "16px",
              border: "2px solid #E85D2C",
              borderRadius: "12px",
              cursor: "pointer",
            }}
          >
            いいえ（税別）
          </button>
        </div>
      </div>
    </div>
  );
}
