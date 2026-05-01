"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  getUserProfile,
  getProducts,
  getOnboardingSettings,
  initOnboarding,
} from "@/lib/firestore";
import { getGrossProfitLoss, formatGrossProfitLoss } from "@/lib/grossProfitLoss";
import ReciproLogo from "@/components/ReciproLogo";
import UnupdatedIngredientsList from "@/components/UnupdatedIngredientsList";
import ImprovementCard from "@/components/ImprovementCard";
import Card from "@/components/ui/Card";
import SetupProgressBar from "@/components/SetupProgressBar";
import SetupModal from "@/components/SetupModal";
import { IconSearch, IconEditDocumentNew } from "@/components/icons";
import type { OnboardingSettings, Product } from "@/types";

type CompletedSteps = OnboardingSettings["completedSteps"];

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [completedSteps, setCompletedSteps] = useState<CompletedSteps | null>(null);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getUserProfile(user.uid),
      getProducts(user.uid),
      getOnboardingSettings(user.uid),
    ]).then(([profile, prods, onboarding]) => {
      if (!onboarding) {
        if (prods.length === 0) {
          initOnboarding(user.uid).catch(console.error);
          router.replace("/onboarding");
          return;
        }
      } else if (!onboarding.onboardingCompleted && !onboarding.onboardingSkipped) {
        router.replace("/onboarding");
        return;
      }

      if (profile) setStoreName(profile.storeName);
      setProducts(prods);
      if (onboarding?.completedSteps) {
        setCompletedSteps(onboarding.completedSteps);
      }
      setReady(true);
    });
  }, [user, router]);

  const totalLoss = products.reduce((sum, product) => {
    const { loss } = getGrossProfitLoss(product);
    return sum + (loss ?? 0);
  }, 0);

  const { display, color } = formatGrossProfitLoss(totalLoss);

  const colorHex =
    color === "danger" ? "#D93025" : color === "success" ? "#0F9D58" : "#555555";

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        読み込み中...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">

        <div className="flex items-center justify-between">
          <ReciproLogo width={140} />
          <div className="flex items-center gap-3">
            {storeName && (
              <p className="text-sm text-gray-600 font-medium">{storeName}</p>
            )}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-bell.svg" alt="通知" width={24} height={24} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
            </div>
          </div>
        </div>

        {completedSteps && (
          <SetupProgressBar
            completedSteps={completedSteps}
            onImportClick={() => setSetupModalOpen(true)}
          />
        )}

        {/* 粗利損失サマリーカード */}
        <button
          onClick={() => router.push("/products")}
          className="w-full text-left"
        >
          <Card className={totalLoss > 0 ? "border-l-4 border-[#D93025]" : totalLoss < 0 ? "border-l-4 border-[#0F9D58]" : ""}>
            <p className="text-sm text-gray-500 mb-1">
              今月の推定粗利損失 ({products.length}商品合計)
            </p>
            <p className="text-3xl font-bold" style={{ color: colorHex }}>
              {products.length === 0 ? "データなし" : display}
              {products.length > 0 && (
                <span className="text-base font-normal text-gray-500 ml-1">/ 月</span>
              )}
            </p>
            {products.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">タップして商品一覧へ</p>
            )}
          </Card>
        </button>

        <UnupdatedIngredientsList />

        <div className="space-y-3">
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

          <button
            onClick={() => router.push("/products")}
            className="w-full flex items-center justify-center gap-3 font-bold bg-white hover:bg-orange-50 transition-colors cursor-pointer"
            style={{
              padding: "14px 30px",
              fontSize: "21px",
              color: "#E85D2C",
              border: "2px solid #E85D2C",
              borderRadius: "12px",
            }}
          >
            商品マスタを管理
          </button>
        </div>

        {/* 食材追加の常設導線 */}
        <button
          onClick={() => router.push("/receipt")}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <IconEditDocumentNew size={18} className="text-gray-500" />
          仕入伝票を追加して食材を増やす
        </button>

        <ImprovementCard />
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
