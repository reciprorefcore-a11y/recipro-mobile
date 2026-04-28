"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile } from "@/lib/firestore";
import ReciproLogo from "@/components/ReciproLogo";
import LossImpactCard from "@/components/LossImpactCard";
import UnupdatedIngredientsList from "@/components/UnupdatedIngredientsList";
import ImprovementCard from "@/components/ImprovementCard";

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [storeName, setStoreName] = useState("");

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((profile) => {
      if (profile) setStoreName(profile.storeName);
    });
  }, [user]);

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <ReciproLogo width={140} />
          <div className="flex items-center gap-3">
            {storeName && (
              <p className="text-sm text-gray-600 font-medium">{storeName}</p>
            )}
            {/* 通知ベル */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-bell.svg" alt="通知" width={24} height={24} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
            </div>
          </div>
        </div>

        <LossImpactCard />

        <UnupdatedIngredientsList />

        {/* ボタン群 */}
        <div className="space-y-3">
          {/* メインCTAボタン */}
          <button
            className="w-full flex items-center justify-center gap-3 rounded-xl font-bold text-white bg-[#E85D2C] hover:bg-[#C04A1F] transition-colors cursor-pointer"
            style={{
              padding: "16px 24px",
              fontSize: "24px",
              boxShadow: "0 4px 8px rgba(232, 93, 44, 0.3)",
              borderRadius: "12px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-camera.svg"
              alt=""
              width={28}
              height={28}
              style={{ filter: "brightness(0) invert(1)" }}
            />
            伝票を撮影して更新
          </button>

          {/* サブボタン */}
          <button
            onClick={() => router.push("/search")}
            className="w-full flex items-center justify-center gap-3 font-bold bg-white hover:bg-orange-50 transition-colors cursor-pointer"
            style={{
              padding: "14px 30px",
              fontSize: "21px",
              color: "#E85D2C",
              border: "2px solid #E85D2C",
              borderRadius: "12px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-search.svg" alt="" width={24} height={24} />
            食材を検索して更新
          </button>
        </div>

        <ImprovementCard />
      </div>
    </main>
  );
}
