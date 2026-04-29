"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile } from "@/lib/firestore";
import { signOut } from "@/lib/auth";
import { seedAll } from "@/lib/seedData";
import type { UserProfile } from "@/types";

export default function MenuPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then(setProfile);
  }, [user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  };

  const handleSeedAll = async () => {
    if (!user) return;
    setSeeding(true);
    setSeedMsg("");
    try {
      const { ingredients, products } = await seedAll(user.uid);
      setSeedMsg(`✅ 食材 ${ingredients}件・商品 ${products}件を投入しました`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setSeedMsg(`❌ ${e.message ?? "投入に失敗しました"}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-text">メニュー</h1>

        {/* 店舗情報 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2.5">
          <p className="text-sm text-sub-text font-medium">店舗情報</p>
          <dl className="space-y-2">
            {profile?.storeName && (
              <div className="flex justify-between">
                <dt className="text-sm text-sub-text">店舗名</dt>
                <dd className="font-semibold text-text">{profile.storeName}</dd>
              </div>
            )}
            {profile?.companyName && (
              <div className="flex justify-between">
                <dt className="text-sm text-sub-text">会社名</dt>
                <dd className="font-semibold text-text">{profile.companyName}</dd>
              </div>
            )}
            {profile?.email && (
              <div className="flex justify-between">
                <dt className="text-sm text-sub-text">メールアドレス</dt>
                <dd className="text-sm font-medium text-text">{profile.email}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* デモデータ投入(本番でも常時表示) */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <p className="text-sm text-sub-text font-medium">デモデータ</p>
          <p className="text-xs text-muted">
            食材・商品のサンプルデータを投入します。既存データへの追記になります。
          </p>
          <button
            onClick={handleSeedAll}
            disabled={seeding}
            className="w-full py-2.5 text-sm font-medium text-gray-600 border border-dashed border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {seeding ? "投入中..." : "🌱 デモデータを投入(初回のみ)"}
          </button>
          {seedMsg && (
            <p className={`text-xs text-center ${seedMsg.startsWith("❌") ? "text-red-500" : "text-gray-500"}`}>
              {seedMsg}
            </p>
          )}
        </div>

        {/* リンク */}
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
          {[
            { label: "利用規約", href: "#" },
            { label: "プライバシーポリシー", href: "#" },
            { label: "お問い合わせ", href: "#" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-text">{item.label}</span>
              <span className="text-muted text-lg">›</span>
            </a>
          ))}
        </div>

        {/* ログアウト */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full py-3.5 rounded-2xl bg-white shadow-sm text-danger font-semibold text-base hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {signingOut ? "ログアウト中..." : "ログアウト"}
        </button>

        <p className="text-center text-xs text-muted pt-2">Recipro v0.1.0</p>
      </div>
    </main>
  );
}
