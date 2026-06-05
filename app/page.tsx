"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  getUserProfile,
  getIngredients,
  getOnboardingSettings,
  initOnboarding,
} from "@/lib/firestore";
import ReciproLogo from "@/components/ReciproLogo";
import TopOrderedIngredients from "@/components/TopOrderedIngredients";
import Card from "@/components/ui/Card";
import SetupProgressBar from "@/components/SetupProgressBar";
import SetupModal from "@/components/SetupModal";
import { IconSearch } from "@/components/icons";
import type { OnboardingSettings, Ingredient } from "@/types";

type CompletedSteps = OnboardingSettings["completedSteps"];

type PriceChangeItem = {
  id: string;
  name: string;
  supplier?: string;
  oldPrice: number;
  currentPrice: number;
  pct: number;
};

function calcTopChanges(ingredients: Ingredient[]): PriceChangeItem[] {
  return ingredients
    .filter((i) => i.isActive && i.oldPrice != null && i.oldPrice > 0)
    .map((i) => ({
      id: i.id,
      name: i.ingredientName,
      supplier: i.supplier,
      oldPrice: i.oldPrice!,
      currentPrice: i.currentPrice,
      pct: ((i.currentPrice - i.oldPrice!) / i.oldPrice!) * 100,
    }))
    .sort((a, b) => b.pct - a.pct);
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [topChanges, setTopChanges] = useState<PriceChangeItem[]>([]);
  const [completedSteps, setCompletedSteps] = useState<CompletedSteps | null>(null);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;

    getUserProfile(user.uid).then((profile) => {
      if (profile) setStoreName(profile.storeName);
    });

    Promise.all([
      getIngredients(user.uid),
      getOnboardingSettings(user.uid),
    ]).then(([ingredients, onboarding]) => {
      if (!onboarding) {
        if (ingredients.length === 0) {
          initOnboarding(user.uid).catch(console.error);
          router.replace("/onboarding");
          return;
        }
      } else if (!onboarding.onboardingCompleted && !onboarding.onboardingSkipped) {
        router.replace("/onboarding");
        return;
      }

      setTopChanges(calcTopChanges(ingredients));

      if (onboarding?.completedSteps) {
        setCompletedSteps(onboarding.completedSteps);
      } else if (onboarding && !onboarding.onboardingCompleted) {
        setCompletedSteps({ ingredientMaster: false, menuImport: false, confirmation: false });
      }
      setReady(true);
    });
  }, [user, router]);

  if (!ready) {
    return (
      <main className="min-h-screen bg-gray-50 flex justify-center">
        <div className="w-full max-w-[480px] px-4 py-6 space-y-4 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-36" />
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-20 bg-gray-200 rounded-xl" />
          <div className="h-14 bg-gray-200 rounded-xl" />
          <div className="h-14 bg-gray-200 rounded-xl" />
        </div>
      </main>
    );
  }

  const top3 = topChanges.slice(0, 3);

  return (
    <main className="bg-gray-50 flex justify-center" style={{ height: "calc(100svh - 60px)", overflow: "hidden" }}>
      <div className="w-full max-w-[480px] px-4 py-4 space-y-3 flex flex-col" style={{ height: "100%" }}>

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <ReciproLogo width={140} />
          <div className="flex items-center gap-3">
            {storeName && (
              <p className="text-sm text-gray-600 font-medium">{storeName}</p>
            )}
          </div>
        </div>

        {completedSteps && (
          <SetupProgressBar
            completedSteps={completedSteps}
            onImportClick={() => setSetupModalOpen(true)}
          />
        )}

        {/* 価格変動サマリーカード */}
        <button
          onClick={() => router.push("/price-changes")}
          className="w-full text-left"
        >
          <Card>
            <p className="text-sm text-gray-500 mb-2 font-medium">今月の食材変動価格推移</p>
            {top3.length === 0 ? (
              <p className="text-sm text-gray-400 py-1">
                価格変動データがまだありません
              </p>
            ) : (
              <div className="space-y-1.5">
                {top3.map((item, i) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      <span className="text-gray-400 mr-1">{i + 1}.</span>
                      {item.name}
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: item.pct > 0 ? "#D93025" : item.pct < 0 ? "#0F9D58" : "#555" }}
                    >
                      {item.pct > 0 ? "+" : ""}{item.pct.toFixed(1)}% {item.pct > 0 ? "↑" : item.pct < 0 ? "↓" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">タップで全リストへ →</p>
          </Card>
        </button>

        <TopOrderedIngredients />

        {/* アクションボタン */}
        <div className="space-y-3 mt-auto">
          <button
            onClick={() => router.push("/receipt")}
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
            <IconSearch size={24} className="text-primary" />
            食材を検索して更新
          </button>
        </div>
      </div>

      {completedSteps && (
        <SetupModal
          isOpen={setupModalOpen}
          onClose={() => setSetupModalOpen(false)}
          completedSteps={completedSteps}
        />
      )}
    </main>
  );
}
