"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconDownload, IconAuto } from "@/components/icons";

const PRIMARY = "#E85D2C";

export default function RecipesPage() {
  const [showToast, setShowToast] = useState(false);

  const handleComingSoon = () => {
    setShowToast(true);
  };

  useEffect(() => {
    if (!showToast) return;
    const id = setTimeout(() => setShowToast(false), 2500);
    return () => clearTimeout(id);
  }, [showToast]);

  return (
    <main className="min-h-screen bg-bg flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-text">レシピ</h1>

        <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-recipe.svg"
            alt=""
            width={48}
            height={48}
            className="mx-auto opacity-30"
          />
          <p className="text-sm text-sub-text text-center">
            AIがメニュー候補、使用食材、原価影響、改善候補をまとめて解析します。
          </p>

          <button
            type="button"
            onClick={handleComingSoon}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <IconDownload size={18} />
            レシプロから商品リストを取り込む
          </button>

          <button
            type="button"
            onClick={handleComingSoon}
            className="w-full rounded-xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: PRIMARY }}
          >
            <IconAuto size={18} />
            AIメニュー生成
          </button>
        </section>

        <Link
          href="/receipt"
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          📷 仕入伝票を追加して食材を増やす
        </Link>
      </div>

      {showToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg whitespace-nowrap">
          現在準備中です
        </div>
      )}
    </main>
  );
}
