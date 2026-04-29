"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getIngredients, addIngredient } from "@/lib/firestore";
import { buildReciproMasterPayload } from "@/lib/reciproMasterPayload";
import { seedIngredients } from "@/lib/seedData";
import IngredientCard from "@/components/IngredientCard";
import AddIngredientModal from "@/components/AddIngredientModal";
import type { Ingredient } from "@/types";

type AddData = {
  ingredientName: string;
  ingredientNameKana: string;
  unit: string;
  currentPrice: number;
  supplier: string;
};

export default function SearchPage() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [exportJson, setExportJson] = useState("");
  const [exporting, setExporting] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [exportCounts, setExportCounts] = useState({
    updateTargets: 0,
    needsReview: 0,
    outputTargets: 0,
  });

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
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.ingredientName.includes(q) ||
      (item.ingredientNameKana ?? "").includes(q) ||
      normalizeName(item.ingredientName).includes(q)
    );
  });

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
    await addIngredient(companyId, { uniqueId, nameNormalized, ...data });
    await fetchIngredients();
  };

  const handleBuildReciproJson = async () => {
    if (!companyId) return;
    setExporting(true);
    setCopyMsg("");
    try {
      const latestIngredients = await getIngredients(companyId);
      setIngredients(latestIngredients);
      const activeIngredients = latestIngredients.filter((item) => item.isActive);
      setExportCounts({
        updateTargets: activeIngredients.filter((item) => Boolean(item.myCatalogId)).length,
        needsReview: activeIngredients.filter((item) => !item.myCatalogId).length,
        outputTargets: activeIngredients.length,
      });
      const payload = buildReciproMasterPayload({
        customerID: companyId,
        storeID: "default",
        ingredients: latestIngredients,
      });
      setExportJson(JSON.stringify(payload, null, 2));
    } finally {
      setExporting(false);
    }
  };

  const handleCopyJson = async () => {
    if (!exportJson) return;
    await navigator.clipboard.writeText(exportJson);
    setCopyMsg("コピーしました");
  };

  /* データ空(ローディング完了後)のみシードボタンを表示 */
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

        {/* シードボタン: データ空の場合のみ表示 */}
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
        {/* 投入後エラーのみ表示 */}
        {!showSeedButton && seedMsg.startsWith("❌") && (
          <p className="text-xs text-center text-red-500">{seedMsg}</p>
        )}

        {/* 検索ボックス */}
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

        {/* 新規追加ボタン */}
        <button
          onClick={() => setModalOpen(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-primary text-primary font-semibold hover:bg-orange-50 transition-colors"
        >
          ＋ 新しい食材を追加
        </button>

        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900">レシプロ反映データ</h2>
              <p className="text-xs text-gray-500 mt-1">
                API送信は行わず、確認用JSONのみ作成します。
              </p>
            </div>
            <button
              type="button"
              onClick={handleBuildReciproJson}
              disabled={exporting || loading}
              className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {exporting ? "作成中..." : "レシプロ反映データ作成"}
            </button>
          </div>

          {exportJson && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <ExportCount label="更新対象" value={exportCounts.updateTargets} />
                <ExportCount label="要確認" value={exportCounts.needsReview} />
                <ExportCount label="出力対象" value={exportCounts.outputTargets} />
              </div>

              {ingredients.some((item) => item.isActive && !item.myCatalogId) && (
                <div className="space-y-1.5">
                  {ingredients
                    .filter((item) => item.isActive && !item.myCatalogId)
                    .slice(0, 5)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2"
                      >
                        <span className="truncate text-xs font-medium text-amber-900">
                          {item.ingredientName}
                        </span>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                          マイカタログID未設定
                        </span>
                      </div>
                    ))}
                  {exportCounts.needsReview > 5 && (
                    <p className="text-xs text-amber-700">
                      ほか {exportCounts.needsReview - 5}件のマイカタログIDが未設定です
                    </p>
                  )}
                </div>
              )}

              <textarea
                readOnly
                value={exportJson}
                className="h-64 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700 outline-none"
              />
              <button
                type="button"
                onClick={handleCopyJson}
                className="w-full rounded-xl border border-primary py-3 text-sm font-bold text-primary hover:bg-orange-50"
              >
                JSONをコピー
              </button>
              {copyMsg && (
                <p className="text-center text-xs font-medium text-green-700">
                  {copyMsg}
                </p>
              )}
            </div>
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
      />
    </main>
  );
}

function ExportCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-50 px-2 py-2 text-center">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/[\s　]/g, "");
}
