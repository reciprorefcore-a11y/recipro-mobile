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
import SetupModal from "@/components/SetupModal";
import { IconSearch } from "@/components/icons";
import type { OnboardingSettings, Ingredient } from "@/types";

type CompletedSteps = OnboardingSettings["completedSteps"];

type PriceChangeItem = {
  id: string;
  name: string;
  pct: number;
};

function buildDisplayChanges(ingredients: Ingredient[]): PriceChangeItem[] {
  const active = ingredients.filter(
    (i) => i.isActive && i.oldPrice != null && i.oldPrice > 0
  );
  const withPct = active.map((i) => ({
    id: i.id,
    name: i.ingredientName,
    pct: ((i.currentPrice - i.oldPrice!) / i.oldPrice!) * 100,
  }));
  const rising = withPct.filter((i) => i.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 3);
  const falling = withPct.filter((i) => i.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 1);
  return [...rising, ...falling];
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [displayChanges, setDisplayChanges] = useState<PriceChangeItem[]>([]);
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

      setDisplayChanges(buildDisplayChanges(ingredients));

      if (onboarding?.completedSteps) {
        setCompletedSteps(onboarding.completedSteps);
      } else if (onboarding && !onboarding.onboardingCompleted) {
        setCompletedSteps({ ingredientMaster: false, menuImport: false, confirmation: false });
      }
      setReady(true);
    });
  }, [user, router]);

  const avatarLetter = storeName ? storeName.charAt(0) : "U";

  if (!ready) {
    return (
      <main
        className="bg-white flex justify-center"
        style={{ height: "calc(100svh - 60px)", overflow: "hidden" }}
      >
        <div className="w-full max-w-[480px] px-4 py-5 flex flex-col gap-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-7 bg-gray-100 rounded w-32" />
            <div className="h-8 w-8 bg-gray-100 rounded-full" />
          </div>
          <div className="flex-1 bg-gray-100 rounded-2xl" />
          <div className="h-14 bg-gray-100 rounded-xl" />
          <div className="h-12 bg-gray-100 rounded-xl" />
        </div>
      </main>
    );
  }

  return (
    <main
      className="bg-white flex justify-center"
      style={{ height: "calc(100svh - 60px)", overflow: "hidden" }}
    >
      <div
        className="w-full max-w-[480px] px-4 flex flex-col"
        style={{ paddingTop: "16px", paddingBottom: "16px", height: "100%", gap: "12px" }}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between shrink-0">
          <ReciproLogo width={120} />
          <button
            type="button"
            onClick={() => router.push("/menu")}
            className="flex items-center justify-center rounded-full font-semibold text-sm text-white shrink-0"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: "#E85D2C",
              fontSize: "14px",
            }}
          >
            {avatarLetter}
          </button>
        </div>

        {/* 価格変動カード */}
        <button
          type="button"
          onClick={() => router.push("/price-changes")}
          className="w-full text-left flex-1 min-h-0 flex"
        >
          <div
            className="w-full flex flex-col rounded-2xl border border-gray-100 p-4"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <div className="flex items-start justify-between mb-3 shrink-0">
              <div>
                <p className="text-base font-semibold text-gray-900">今月の価格変動</p>
                <p className="text-xs text-gray-400 mt-0.5">食材の値上がり・値下がり</p>
              </div>
              <span className="text-xs text-gray-400 mt-0.5">詳細 ›</span>
            </div>

            {displayChanges.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-400">価格変動データがまだありません</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center gap-2.5">
                {displayChanges.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span
                      className="text-sm text-gray-700 truncate mr-2"
                      style={{ maxWidth: "70%" }}
                    >
                      {item.name}
                    </span>
                    <span
                      className="text-sm font-semibold shrink-0 tabular-nums"
                      style={{
                        color: item.pct > 0 ? "#EF4444" : item.pct < 0 ? "#10B981" : "#9CA3AF",
                      }}
                    >
                      {item.pct > 0 ? "+" : ""}{item.pct.toFixed(1)}%
                      {" "}{item.pct > 0 ? "↑" : item.pct < 0 ? "↓" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </button>

        {/* メインCTA: 伝票撮影 */}
        <button
          type="button"
          onClick={() => router.push("/receipt")}
          className="w-full flex items-center justify-center gap-2.5 rounded-xl font-bold text-white transition-opacity active:opacity-80 shrink-0"
          style={{
            height: "56px",
            fontSize: "17px",
            backgroundColor: "#E85D2C",
            boxShadow: "0 2px 8px rgba(232,93,44,0.25)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-camera.svg"
            alt=""
            width={22}
            height={22}
            style={{ filter: "brightness(0) invert(1)" }}
          />
          伝票を撮影して更新
        </button>

        {/* サブCTA: 食材検索 */}
        <button
          type="button"
          onClick={() => router.push("/search")}
          className="w-full flex items-center justify-center gap-2.5 rounded-xl font-semibold transition-opacity active:opacity-70 shrink-0"
          style={{
            height: "50px",
            fontSize: "16px",
            color: "#E85D2C",
            border: "1.5px solid #E85D2C",
            backgroundColor: "transparent",
          }}
        >
          <IconSearch size={20} className="text-primary" />
          食材を検索して更新
        </button>
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
