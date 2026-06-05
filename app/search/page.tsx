"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getIngredients, addIngredient } from "@/lib/firestore";
import { getNextMyCatalogId } from "@/lib/myCatalogIdGenerator";
import { saveIngredientSnapshot } from "@/lib/ingredientSnapshot";
import { seedIngredients } from "@/lib/seedData";
import IngredientCard from "@/components/IngredientCard";
import AddIngredientModal from "@/components/AddIngredientModal";
import type { Ingredient, SnapshotItem } from "@/types";

type AddData = {
  ingredientName: string;
  ingredientNameKana: string;
  unit: string;
  currentPrice: number;
  supplier: string;
};

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export default function SearchPage() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const companyId = user?.uid ?? "";

  const fetchIngredients = async () => {
    if (!companyId) return;
    const data = await getIngredients(companyId);
    setIngredients(data);
  };

  useEffect(() => {
    if (!companyId) return;
    let ignore = false;
    getIngredients(companyId)
      .then((data) => { if (!ignore) setIngredients(data); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [companyId]);

  const filtered = ingredients.filter((item) => {
    if (supplierFilter && (item.supplier ?? "") !== supplierFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.ingredientName.includes(q) ||
      (item.ingredientNameKana ?? "").includes(q) ||
      normalizeName(item.ingredientName).includes(q)
    );
  });

  const supplierOptions = Array.from(
    ingredients.reduce((map, item) => {
      const s = item.supplier ?? "";
      if (s) map.set(s, (map.get(s) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  const activeIngredients = ingredients.filter((i) => i.isActive);

  const handleSeed = async () => {
    if (!companyId) return;
    setSeeding(true);
    setSeedMsg("");
    try {
      const count = await seedIngredients(companyId);
      await fetchIngredients();
      setSeedMsg(`✅ ${count}件投入しました`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setSeedMsg(`❌ ${e.message ?? "失敗しました"}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleAdd = async (data: AddData) => {
    if (!companyId) return;
    const uniqueId = `${companyId.slice(0, 8)}_${Date.now()}`;
    const nameNormalized = data.ingredientName.replace(/[\s　]/g, "");
    const myCatalogId = await getNextMyCatalogId(companyId);
    await addIngredient(companyId, { uniqueId, nameNormalized, ...data, myCatalogId });
    await fetchIngredients();
  };

  const handleCsvDownload = async () => {
    if (!user) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const latest = await getIngredients(companyId);
      setIngredients(latest);
      const activeWithId = latest.filter((i) => i.isActive);

      const token = await user.getIdToken();
      const res = await fetch("/api/csv/ingredients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("CSV生成に失敗しました");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ingredient_master_${todayString()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      // スナップショット保存（/history で確認・ロールバック可能に）
      if (activeWithId.length > 0) {
        const now = new Date();
        const desc = `${now.getMonth() + 1}/${now.getDate()} CSVダウンロード`;
        const snapshotItems: SnapshotItem[] = activeWithId.map((item) => ({
          ingredientId: item.id,
          myCatalogId: item.myCatalogId,
          ingredientName: item.ingredientName,
          oldPrice: item.currentPrice,
          newPrice: item.currentPrice,
          supplier: item.supplier,
          isNew: false,
        }));
        await saveIngredientSnapshot(companyId, user.uid, desc, snapshotItems);
      }

      setShowSuccessModal(true);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setDownloading(false);
    }
  };

  const showSeedButton = !loading && ingredients.length === 0;

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 font-medium"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-arrow-right.svg" alt="" width={16} height={16}
              style={{ filter: "brightness(0) opacity(0.5)", transform: "rotate(180deg)" }} />
            戻る
          </Link>
          <h1 className="text-xl font-bold">食材を検索</h1>
        </div>

        {showSeedButton && (
          <div className="space-y-1">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="w-full py-3 text-sm text-gray-600 border border-dashed border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
            >
              {seeding ? "投入中..." : "🌱 デモデータを投入(初回のみ)"}
            </button>
            {seedMsg && <p className="text-xs text-center text-gray-500">{seedMsg}</p>}
          </div>
        )}
        {!showSeedButton && seedMsg.startsWith("❌") && (
          <p className="text-xs text-center text-red-500">{seedMsg}</p>
        )}

        {/* 検索ボックス */}
        <div className="space-y-2">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-search.svg"
              alt=""
              width={18}
              height={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="食材名で検索..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 pl-10 text-[16px] outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {supplierOptions.length > 0 && (
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary text-gray-700"
            >
              <option value="">業者: 全て ({ingredients.filter(i => i.supplier).length > 0 ? ingredients.length : 0}件)</option>
              {supplierOptions.map(([name, count]) => (
                <option key={name} value={name}>{name}（{count}件）</option>
              ))}
            </select>
          )}
        </div>

        {/* 新規追加ボタン */}
        <button
          onClick={() => setModalOpen(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-primary text-primary font-semibold hover:bg-orange-50 transition-colors"
        >
          ＋ 新しい食材を追加
        </button>

        {/* レシプロ本体に反映 */}
        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="font-bold text-gray-900">レシプロ本体に反映</h2>
          <div className="text-center py-2">
            <p className="text-4xl font-bold tabular-nums" style={{ color: "#E85D2C" }}>
              {loading ? "—" : activeIngredients.length}件
            </p>
            <p className="text-sm text-gray-500 mt-1">レシプロに反映できます</p>
          </div>
          <button
            type="button"
            onClick={handleCsvDownload}
            disabled={downloading || loading || activeIngredients.length === 0}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            style={{ backgroundColor: activeIngredients.length > 0 && !loading && !downloading ? "#E85D2C" : "#9ca3af" }}
          >
            {downloading && (
              <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
            {downloading ? "CSV生成中..." : "📥 CSVをレシプロにアップロード"}
          </button>
          {downloadError && (
            <p className="text-xs text-red-500 text-center">{downloadError}</p>
          )}
        </section>

        <p className="text-sm text-gray-500 font-medium">
          食材一覧 ({filtered.length}件)
        </p>

        {loading ? (
          <p className="text-center text-sm text-gray-400 py-8">読み込み中...</p>
        ) : filtered.length === 0 && searchQuery ? (
          <p className="text-center text-sm text-gray-400 py-8">
            該当する食材がありません
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <IngredientCard key={item.id} ingredient={item} />
            ))}
          </div>
        )}
      </div>

      <AddIngredientModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAdd}
        suppliers={supplierOptions.map(([name]) => name)}
      />

      {/* CSVダウンロード成功モーダル */}
      {showSuccessModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
          onClick={() => setShowSuccessModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              backgroundColor: "#fff",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 16px + 60px)",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-1">
              <div className="text-3xl">✅</div>
              <h2 className="text-base font-bold text-gray-900">CSVをダウンロードしました</h2>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-700">次の手順:</p>
              <ol className="space-y-2">
                {[
                  "レシプロを開く",
                  "食材マスタ → CSVアップロード",
                  "ダウンロードしたCSVを選択",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <p className="text-xs text-gray-400 text-center">
              不明な点は管理者にお問い合わせください
            </p>

            <p className="text-xs text-green-600 text-center">
              この操作は履歴に保存されています（/history で確認できます）
            </p>

            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-3 rounded-xl font-bold text-white text-sm"
              style={{ backgroundColor: "#E85D2C" }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/[\s　]/g, "");
}
