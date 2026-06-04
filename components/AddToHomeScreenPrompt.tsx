"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "aths_dismissed";

export default function AddToHomeScreenPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // iOS Safari のみ表示
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandaloneMode =
      "standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true;

    if (!isIos || isInStandaloneMode) return;

    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    // 5秒後に表示
    const timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: "440px",
        zIndex: 300,
        backgroundColor: "#1c1c1e",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        color: "white",
      }}
    >
      {/* 閉じるボタン */}
      <button
        onClick={handleDismiss}
        style={{
          position: "absolute",
          top: "10px",
          right: "12px",
          background: "none",
          border: "none",
          color: "#8e8e93",
          fontSize: "20px",
          cursor: "pointer",
          lineHeight: 1,
          padding: "4px",
        }}
        aria-label="閉じる"
      >
        ×
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        {/* アプリアイコン */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt="Recipro"
          width={48}
          height={48}
          style={{ borderRadius: "12px", flexShrink: 0 }}
        />

        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>
            ホーム画面に追加
          </p>
          <p style={{ fontSize: "12px", color: "#ebebf5cc", lineHeight: 1.5, marginBottom: "10px" }}>
            Reciproをアプリのように使えます
          </p>

          {/* 手順 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#ebebf5cc" }}>
              {/* シェアアイコン (↑) */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "24px",
                  height: "24px",
                  backgroundColor: "#2c2c2e",
                  borderRadius: "6px",
                  fontSize: "14px",
                  flexShrink: 0,
                }}
              >
                ↑
              </span>
              <span>画面下の「共有」ボタンをタップ</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#ebebf5cc" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "24px",
                  height: "24px",
                  backgroundColor: "#2c2c2e",
                  borderRadius: "6px",
                  fontSize: "14px",
                  flexShrink: 0,
                }}
              >
                +
              </span>
              <span>「ホーム画面に追加」を選択</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
