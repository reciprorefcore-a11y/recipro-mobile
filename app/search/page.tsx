"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getIngredients, addIngredient } from "@/lib/firestore";
import { getNextMyCatalogId } from "@/lib/myCatalogIdGenerator";
import { saveIngredientSnapshot } from "@/lib/ingredientSnapshot";
import { seedIngredients } from "@/lib/seedData";
import { getReciproIntegration, RECIPRO_LOCAL_STORE_ID } from "@/lib/reciproIntegration";
import { buildReciproMasterPayload } from "@/lib/reciproMasterPayload";
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


function getExportErrorMessage(status: number): string {
  if (status === 401) return "ログインし直してください";
  if (status === 403) return "レシプロ連携設定が無効です。再設定してください";
  if (status === 500) return "レシプロとの通信に失敗しました。少し時間をおいて再試行してください";
  return `反映に失敗しました (${status})`;
}

export default function SearchPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportCount, setExportCount] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showNoIntegrationDialog, setShowNoIntegrationDialog] = useState(false);
  const [integrationEnabled, setIntegrationEnabled] = useState<boolean | null>(null);

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
    getReciproIntegration(companyId)
      .then((data) => { if (!ignore) setIntegrationEnabled(data?.enabled ?? false); })
      .catch(() => { if (!ignore) setIntegrationEnabled(false); });
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

  const handleExportToRecipro = async () => {
    if (!user) return;
    setExporting(true);
    setExportError("");
    try {
      // 1. 連携設定確認
      const integration = await getReciproIntegration(companyId);
      if (!integration?.enabled) {
        setShowNoIntegrationDialog(true);
        return;
      }

      // 2. 最新食材取得
      const latest = await getIngredients(companyId);
      setIngredients(latest);

      // 3. setData 変換（buildReciproMasterPayload が isActive フィルタ済み）
      const payload = buildReciproMasterPayload({ customerID: "", storeID: "", ingredients: latest });
      const setData = payload.data.setData;
      if (setData.length === 0) return;

      // 4. スナップショット保存（/history でロールバック可能）
      const now = new Date();
      const desc = `${now.getMonth() + 1}/${now.getDate()} レシプロ反映`;
      const snapshotItems: SnapshotItem[] = latest
        .filter((i) => i.isActive)
        .map((item) => ({
          ingredientId: item.id,
          myCatalogId: item.myCatalogId,
          ingredientName: item.ingredientName,
          oldPrice: item.currentPrice,
          newPrice: item.currentPrice,
          supplier: item.supplier,
          isNew: false,
        }));
      await saveIngredientSnapshot(companyId, user.uid, desc, snapshotItems);

      // 5. master-sync API 呼び出し
      const token = await user.getIdToken();
      const res = await fetch("/api/recipro/master-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeId: RECIPRO_LOCAL_STORE_ID, setData }),
      });

      if (!res.ok) {
        throw new Error(getExportErrorMessage(res.status));
      }

      // 6. 成功
      setExportCount(setData.length);
      setShowSuccessModal(true);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "反映に失敗しました");
    } finally {
      setExporting(false);
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
        <section className="bg-white rounded-2xl shadow-md p-4 space-y-4">
          {/* ヘッダー */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white text-xs font-bold px-2 py-1 rounded-md" style={{ backgroundColor: "#F97316" }}>
                Recipro
              </span>
              <span className="text-sm font-medium text-gray-700">連携サービス</span>
            </div>
            <div
              role="status"
              className={`flex items-center gap-1 text-xs font-medium ${integrationEnabled ? "text-green-600" : "text-gray-400"}`}
            >
              <span className="text-base leading-none">{integrationEnabled ? "●" : "○"}</span>
              <span>{integrationEnabled ? "接続済" : "未接続"}</span>
            </div>
          </div>

          {/* 件数 */}
          <div className="text-center py-1">
            <div className="flex items-baseline justify-center gap-0.5">
              <span
                className="text-5xl font-bold tabular-nums leading-none"
                style={{ color: loading || activeIngredients.length > 0 ? "#E85D2C" : undefined }}
              >
                <span className={loading || activeIngredients.length > 0 ? "" : "text-gray-400"}>
                  {loading ? "—" : activeIngredients.length}
                </span>
              </span>
              <span
                className={`text-2xl font-bold leading-none ${activeIngredients.length === 0 && !loading ? "text-gray-400" : ""}`}
                style={{ color: activeIngredients.length > 0 ? "#E85D2C" : undefined }}
              >
                件
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1.5">
              {!loading && activeIngredients.length === 0 ? "反映する食材がありません" : "エクスポート対象"}
            </p>
          </div>

          {/* CTAボタン */}
          <button
            type="button"
            onClick={handleExportToRecipro}
            disabled={exporting || loading || activeIngredients.length === 0}
            aria-label="レシプロへエクスポートする"
            aria-busy={exporting}
            className="w-full h-14 rounded-xl text-white font-bold shadow-md flex flex-col items-center justify-center gap-0.5 disabled:opacity-50 transition-all active:scale-[0.98] hover:brightness-105"
            style={{ background: "linear-gradient(to right, #F97316, #FFB75E)" }}
          >
            {exporting ? (
              <>
                <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span className="text-sm font-medium mt-0.5">反映中...</span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <Upload size={18} strokeWidth={2.5} />
                  <span className="text-base font-bold">レシプロへエクスポート</span>
                </div>
                <span className="text-xs" style={{ opacity: 0.75 }}>タップで反映</span>
              </>
            )}
          </button>

          {exportError && (
            <p className="text-xs text-red-500 text-center">{exportError}</p>
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

      {/* 反映成功モーダル */}
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
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-2">
              <div className="text-4xl">✅</div>
              <h2 className="text-base font-bold text-gray-900">レシプロに反映しました</h2>
              <p className="text-sm text-gray-500">{exportCount}件の食材マスタを反映しました</p>
            </div>
            <p className="text-xs text-green-600 text-center">
              この操作は履歴に保存されています
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

      {/* 未連携ダイアログ */}
      {showNoIntegrationDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
            padding: "16px",
          }}
          onClick={() => setShowNoIntegrationDialog(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-gray-900">レシプロ連携設定が必要です</p>
            <p className="text-sm text-gray-600">
              食材マスタをレシプロへ反映するには、メニュー →「レシプロ連携設定」から初回連携を行ってください。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNoIntegrationDialog(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => { setShowNoIntegrationDialog(false); router.push("/integrations/recipro"); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: "#E85D2C" }}
              >
                連携設定へ
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/[\s　]/g, "");
}
