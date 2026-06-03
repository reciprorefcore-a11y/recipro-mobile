"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, getGeneralSettings, savePriceMode, getPendingIngredients, getIngredients, updateIngredient } from "@/lib/firestore";
import { getCurrentCounter, resetCounter, getNextMyCatalogId } from "@/lib/myCatalogIdGenerator";
import { signOut } from "@/lib/auth";
import { seedAll } from "@/lib/seedData";
import { IconEditDocument } from "@/components/icons";
import PriceModeModal from "@/components/PriceModeModal";
import CsvDownloadButton from "@/components/CsvDownloadButton";
import type { UserProfile, PriceMode } from "@/types";

export default function MenuPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [priceMode, setPriceMode] = useState<PriceMode | undefined>(undefined);
  const [priceModeOpen, setPriceModeOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [catalogCounter, setCatalogCounter] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then(setProfile);
    getGeneralSettings(user.uid).then((s) => setPriceMode(s?.priceMode));
    getPendingIngredients(user.uid).then((items) => setPendingCount(items.length));
    getCurrentCounter(user.uid).then(setCatalogCounter);
  }, [user]);

  const handleBulkAssign = async () => {
    if (!user) return;
    setBulkMsg("");
    const ingredients = await getIngredients(user.uid);
    const noIdItems = ingredients.filter((i) => !i.myCatalogId && i.isActive);
    if (noIdItems.length === 0) {
      setBulkMsg("✅ 未採番の食材はありません");
      return;
    }
    if (!window.confirm(`${noIdItems.length}件の食材にマイカタログIDを採番しますか？`)) return;
    setBulkAssigning(true);
    try {
      let count = 0;
      for (const item of noIdItems) {
        const id = await getNextMyCatalogId(user.uid);
        await updateIngredient(user.uid, item.id, { myCatalogId: id });
        count++;
      }
      setBulkMsg(`✅ ${count}件にIDを採番しました`);
      getCurrentCounter(user.uid).then(setCatalogCounter);
    } catch {
      setBulkMsg("❌ 採番に失敗しました");
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setCsvFileName(file.name);
    setImportMsg("");
    setImporting(true);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("csv", file);
      const res = await fetch("/api/csv/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json() as { added?: number; updated?: number; skipped?: number; error?: string };
      if (!res.ok) {
        setImportMsg(`❌ ${json.error ?? "取り込みに失敗しました"}`);
      } else {
        setImportMsg(`✅ 追加: ${json.added}件 / 更新: ${json.updated}件 / スキップ: ${json.skipped}件`);
      }
    } catch {
      setImportMsg("❌ 通信エラーが発生しました");
    } finally {
      setImporting(false);
    }
  };

  const handleResetCounter = async () => {
    if (!user) return;
    if (!window.confirm("カウンタを 10000 にリセットしますか？")) return;
    setResetting(true);
    try {
      await resetCounter(user.uid);
      setCatalogCounter(10000);
    } finally {
      setResetting(false);
    }
  };

  const handlePriceModeSelect = async (mode: PriceMode) => {
    if (!user) return;
    await savePriceMode(user.uid, mode).catch(console.error);
    setPriceMode(mode);
    setPriceModeOpen(false);
  };

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

        {/* 価格設定 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <p className="text-sm text-sub-text font-medium">価格設定</p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text">
              現在:{" "}
              {priceMode === "taxIncluded"
                ? "税込"
                : priceMode === "taxExcluded"
                ? "税別"
                : "未設定"}
            </p>
            <button
              onClick={() => setPriceModeOpen(true)}
              className="text-sm font-semibold px-3 py-1.5 rounded-lg border"
              style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
            >
              変更する
            </button>
          </div>
        </div>

        {/* レシプロ連携 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <p className="text-sm text-sub-text font-medium">レシプロ連携</p>
          <p className="text-xs text-muted">
            食材マスタをレシプロ入力シート互換のCSVでエクスポートします。
          </p>
          <CsvDownloadButton />
        </div>

        {/* マイカタログID管理 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-sm text-sub-text font-medium">マイカタログID管理</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-sub-text">次に発行されるID</p>
              <p className="text-lg font-bold text-text">
                {catalogCounter !== null ? catalogCounter.toLocaleString() : "—"}
              </p>
            </div>
            <button
              onClick={handleResetCounter}
              disabled={resetting}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {resetting ? "リセット中..." : "10000 にリセット"}
            </button>
          </div>
          <p className="text-xs text-muted">
            モバイル版が発行するIDは 10000 以上です。レシプロ本体のIDとは重複しません。
          </p>
        </div>

        {/* マイカタログID 一括採番 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <p className="text-sm text-sub-text font-medium">マイカタログID 一括採番</p>
          <p className="text-xs text-muted">
            マイカタログIDが未設定の食材に、自動でIDを発行します。
          </p>
          <button
            onClick={handleBulkAssign}
            disabled={bulkAssigning}
            className="w-full py-2.5 text-sm font-medium border rounded-xl transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
          >
            {bulkAssigning ? "採番中..." : "未設定食材に一括採番"}
          </button>
          {bulkMsg && (
            <p className={`text-xs text-center ${bulkMsg.startsWith("❌") ? "text-red-500" : "text-gray-500"}`}>
              {bulkMsg}
            </p>
          )}
        </div>

        {/* レシプロから食材を取り込む */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <p className="text-sm text-sub-text font-medium">レシプロから食材を取り込む</p>
          <p className="text-xs text-muted">
            レシプロから書き出したCSVをアップロードしてください
          </p>
          <label className="block cursor-pointer">
            <div
              className="w-full py-2.5 text-sm font-medium border border-dashed rounded-xl text-center transition-colors hover:bg-gray-50"
              style={{ color: importing ? "#999" : "#E85D2C", borderColor: importing ? "#ccc" : "#E85D2C" }}
            >
              {importing ? "取り込み中..." : csvFileName ?? "CSVファイルを選択"}
            </div>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              disabled={importing}
              onChange={handleCsvImport}
            />
          </label>
          <p className="text-xs text-amber-600">⚠ Shift-JIS形式のCSVのみ対応</p>
          {importMsg && (
            <p className={`text-xs text-center ${importMsg.startsWith("❌") ? "text-red-500" : "text-gray-500"}`}>
              {importMsg}
            </p>
          )}
        </div>

        {/* リンク */}
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
          <Link
            href="/products"
            className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-text">
              <IconEditDocument size={18} className="text-gray-500" />
              商品マスタ管理
            </span>
            <span className="text-muted text-lg">›</span>
          </Link>
          <Link
            href="/new-ingredients"
            className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-text">
              新規食材リスト
              {pendingCount > 0 && (
                <span className="ml-2 text-xs font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full">
                  {pendingCount}件
                </span>
              )}
            </span>
            <span className="text-muted text-lg">›</span>
          </Link>
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

      <PriceModeModal
        isOpen={priceModeOpen}
        onClose={() => setPriceModeOpen(false)}
        onSelect={handlePriceModeSelect}
      />
    </main>
  );
}
