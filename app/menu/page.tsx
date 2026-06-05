"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, getGeneralSettings, savePriceMode, getPendingIngredients, getIngredients, updateIngredient, saveStoreInfo } from "@/lib/firestore";
import { getCurrentCounter, getNextMyCatalogId } from "@/lib/myCatalogIdGenerator";
import { signOut } from "@/lib/auth";
import { seedAll } from "@/lib/seedData";
import { IconEditDocument } from "@/components/icons";
import PriceModeModal from "@/components/PriceModeModal";
import CsvDownloadButton from "@/components/CsvDownloadButton";
import type { UserProfile, PriceMode } from "@/types";

type ImportPhase =
  | { name: "idle" }
  | { name: "previewing"; file: File; total: number; suppliers: string[]; supplierCount: number }
  | { name: "importing" }
  | { name: "done"; added: number; updated: number; skipped: number; supplierCount: number; newSupplierCount: number; suppliers: string[] }
  | { name: "error"; message: string };

export default function MenuPage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingStore, setEditingStore] = useState(false);
  const [storeForm, setStoreForm] = useState({ storeName: "", address: "", zipCode: "", phone: "", fax: "", personInCharge: "" });
  const [storeSaving, setStoreSaving] = useState(false);
  const [storeMsg, setStoreMsg] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [priceMode, setPriceMode] = useState<PriceMode | undefined>(undefined);
  const [priceModeOpen, setPriceModeOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [catalogCounter, setCatalogCounter] = useState<number | null>(null);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [importPhase, setImportPhase] = useState<ImportPhase>({ name: "idle" });

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => {
      setProfile(p);
      if (p) setStoreForm({ storeName: p.storeName ?? "", address: p.address ?? "", zipCode: p.zipCode ?? "", phone: p.phone ?? "", fax: p.fax ?? "", personInCharge: p.personInCharge ?? "" });
    });
    getGeneralSettings(user.uid).then((s) => setPriceMode(s?.priceMode));
    getPendingIngredients(user.uid).then((items) => setPendingCount(items.length));
    getCurrentCounter(user.uid).then(setCatalogCounter);
  }, [user]);

  const handleStoreSave = async () => {
    if (!user || !storeForm.storeName.trim()) return;
    setStoreSaving(true);
    setStoreMsg("");
    try {
      await saveStoreInfo(user.uid, {
        storeName: storeForm.storeName.trim(),
        address: storeForm.address.trim() || undefined,
        zipCode: storeForm.zipCode.trim() || undefined,
        phone: storeForm.phone.trim() || undefined,
        fax: storeForm.fax.trim() || undefined,
        personInCharge: storeForm.personInCharge.trim() || undefined,
      });
      setProfile((prev) => prev ? { ...prev, ...storeForm } : prev);
      setStoreMsg("✅ 保存しました");
      setEditingStore(false);
    } catch {
      setStoreMsg("❌ 保存に失敗しました");
    } finally {
      setStoreSaving(false);
    }
  };

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

  // ファイル選択 → プレビュー取得
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setImportPhase({ name: "previewing", file, total: 0, suppliers: [], supplierCount: 0 });

    try {
      const token = await user.getIdToken(/* forceRefresh */ true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("preview", "true");

      const res = await fetch("/api/import/ingredients", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json() as { total?: number; suppliers?: string[]; supplierCount?: number; error?: string };

      if (!res.ok) {
        setImportPhase({ name: "error", message: json.error ?? "解析に失敗しました" });
        return;
      }
      setImportPhase({
        name: "previewing",
        file,
        total: json.total ?? 0,
        suppliers: json.suppliers ?? [],
        supplierCount: json.supplierCount ?? 0,
      });
    } catch {
      setImportPhase({ name: "error", message: "通信エラーが発生しました" });
    }
  };

  // 確認後 → 実際に取り込み実行
  const handleImportConfirm = async () => {
    if (importPhase.name !== "previewing" || !user) return;
    const file = importPhase.file;
    setImportPhase({ name: "importing" });

    try {
      const token = await user.getIdToken(/* forceRefresh */ true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/ingredients", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json() as {
        added?: number; updated?: number; skipped?: number;
        supplierCount?: number; newSupplierCount?: number; suppliers?: string[];
        error?: string;
      };

      if (!res.ok) {
        setImportPhase({ name: "error", message: json.error ?? "取り込みに失敗しました" });
        return;
      }
      setImportPhase({
        name: "done",
        added: json.added ?? 0,
        updated: json.updated ?? 0,
        skipped: json.skipped ?? 0,
        supplierCount: json.supplierCount ?? 0,
        newSupplierCount: json.newSupplierCount ?? 0,
        suppliers: json.suppliers ?? [],
      });
    } catch {
      setImportPhase({ name: "error", message: "通信エラーが発生しました" });
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
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-sub-text font-medium">店舗情報</p>
            {!editingStore && (
              <button
                type="button"
                onClick={() => { setEditingStore(true); setStoreMsg(""); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
                style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
              >
                編集
              </button>
            )}
          </div>

          {editingStore ? (
            <div className="space-y-3">
              {[
                { key: "storeName", label: "店舗名 *", placeholder: "例: 居酒屋まるごと" },
                { key: "zipCode", label: "郵便番号", placeholder: "例: 150-0001" },
                { key: "address", label: "住所 (納品場所)", placeholder: "例: 東京都渋谷区..." },
                { key: "phone", label: "電話番号", placeholder: "例: 03-1234-5678" },
                { key: "fax", label: "FAX番号", placeholder: "例: 03-1234-5679" },
                { key: "personInCharge", label: "担当者名", placeholder: "例: 山田 太郎" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    type="text"
                    value={storeForm[key as keyof typeof storeForm]}
                    onChange={(e) => setStoreForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              ))}
              {storeMsg && (
                <p className={`text-xs text-center ${storeMsg.startsWith("❌") ? "text-red-500" : "text-green-600"}`}>{storeMsg}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setEditingStore(false); setStoreMsg(""); }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleStoreSave}
                  disabled={storeSaving || !storeForm.storeName.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ backgroundColor: "#E85D2C" }}
                >
                  {storeSaving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          ) : (
            <dl className="space-y-2">
              {[
                { label: "店舗名", value: profile?.storeName },
                { label: "住所", value: profile?.address },
                { label: "郵便番号", value: profile?.zipCode },
                { label: "電話番号", value: profile?.phone },
                { label: "FAX番号", value: profile?.fax },
                { label: "担当者名", value: profile?.personInCharge },
                { label: "メールアドレス", value: profile?.email },
              ].filter((r) => r.value).map((r) => (
                <div key={r.label} className="flex justify-between gap-3">
                  <dt className="text-xs text-sub-text shrink-0">{r.label}</dt>
                  <dd className="text-sm font-medium text-text text-right break-all">{r.value}</dd>
                </div>
              ))}
              {storeMsg && (
                <p className="text-xs text-green-600 text-center">{storeMsg}</p>
              )}
            </dl>
          )}
        </div>

        {/* デモデータ投入 */}
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
          <div>
            <p className="text-xs text-sub-text">次に発行されるID</p>
            <p className="text-lg font-bold text-text">
              {catalogCounter !== null ? catalogCounter.toLocaleString() : "—"}
            </p>
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

        {/* レシプロから食材マスタを取り込む */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-sm text-sub-text font-medium">レシプロから食材マスタを取り込む</p>

          {importPhase.name === "idle" && (
            <>
              <p className="text-xs text-muted">
                レシプロの入力シート(.xlsx)またはCSVをアップロードして食材マスタを取り込みます。
              </p>
              <label className="block cursor-pointer">
                <div
                  className="w-full py-3 text-sm font-semibold border-2 border-dashed rounded-xl text-center transition-colors hover:bg-orange-50"
                  style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
                >
                  📁 入力シートを選択(.xlsx / .csv)
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
              <div className="bg-amber-50 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-800">⚠ 注意</p>
                <p className="text-xs text-amber-700">既存食材(同じマイカタログID)は更新されます</p>
                <p className="text-xs text-amber-700">新規食材は追加されます</p>
              </div>
            </>
          )}

          {importPhase.name === "previewing" && importPhase.total === 0 && (
            <div className="flex items-center justify-center py-6 gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-gray-500">ファイルを解析中...</p>
            </div>
          )}

          {importPhase.name === "previewing" && importPhase.total > 0 && (
            <>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-gray-900">取り込み確認</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-sub-text">食材データ</span>
                    <span className="font-bold text-text">{importPhase.total.toLocaleString()}件</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-sub-text">取引先</span>
                    <span className="font-bold text-text">{importPhase.supplierCount}社</span>
                  </div>
                </div>
                {importPhase.suppliers.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-sub-text font-medium">取引先一覧:</p>
                    <ul className="space-y-0.5">
                      {importPhase.suppliers.slice(0, 8).map((s) => (
                        <li key={s} className="text-xs text-gray-600">・{s}</li>
                      ))}
                      {importPhase.suppliers.length > 8 && (
                        <li className="text-xs text-gray-400">他 {importPhase.suppliers.length - 8}社</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setImportPhase({ name: "idle" })}
                  className="flex-1 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleImportConfirm}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition-colors hover:opacity-90"
                  style={{ backgroundColor: "#E85D2C" }}
                >
                  取り込みを実行
                </button>
              </div>
            </>
          )}

          {importPhase.name === "importing" && (
            <div className="flex items-center justify-center py-6 gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-gray-500">取り込み中...</p>
            </div>
          )}

          {importPhase.name === "done" && (
            <>
              <div className="bg-green-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-green-900">✅ 取り込み完了</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">新規追加</span>
                    <span className="font-bold text-green-800">{importPhase.added.toLocaleString()}件</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">既存更新</span>
                    <span className="font-bold text-green-800">{importPhase.updated.toLocaleString()}件</span>
                  </div>
                  {importPhase.skipped > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">スキップ</span>
                      <span className="font-medium text-gray-600">{importPhase.skipped}件</span>
                    </div>
                  )}
                  <div className="border-t border-green-100 pt-1.5 flex justify-between text-sm">
                    <span className="text-green-700">取引先登録</span>
                    <span className="font-bold text-green-800">
                      {importPhase.supplierCount}社
                      {importPhase.newSupplierCount > 0 && ` (新規${importPhase.newSupplierCount}社)`}
                    </span>
                  </div>
                </div>
                {importPhase.suppliers.length > 0 && (
                  <div className="space-y-0.5">
                    {importPhase.suppliers.slice(0, 6).map((s) => (
                      <p key={s} className="text-xs text-green-700">・{s}</p>
                    ))}
                    {importPhase.suppliers.length > 6 && (
                      <p className="text-xs text-green-600">他 {importPhase.suppliers.length - 6}社</p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setImportPhase({ name: "idle" })}
                className="w-full py-2.5 text-sm font-medium border rounded-xl transition-colors hover:bg-gray-50"
                style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
              >
                続けて取り込む
              </button>
            </>
          )}

          {importPhase.name === "error" && (
            <>
              <p className="text-xs text-red-500 text-center">❌ {importPhase.message}</p>
              <button
                onClick={() => setImportPhase({ name: "idle" })}
                className="w-full py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
              >
                やり直す
              </button>
            </>
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
            { label: "利用規約", href: "/terms" },
            { label: "プライバシーポリシー", href: "/privacy" },
            { label: "お問い合わせ", href: "/contact" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-text">{item.label}</span>
              <span className="text-muted text-lg">›</span>
            </Link>
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
