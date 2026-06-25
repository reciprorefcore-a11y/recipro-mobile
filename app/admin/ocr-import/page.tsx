"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { getReciproSettings, saveReciproSettings } from "@/lib/firestore";
import { assertCustomerAllowed, getAllowedCustomerIds } from "@/lib/allowedCustomers";
import { setAdminMasterWithLog } from "@/lib/setAdminMasterWithLog";
import { findMasterCandidates, nextMobileIdFromMaster, type MasterCandidate } from "@/lib/masterFuzzyMatch";
import { computeMasterDiff } from "@/lib/masterDiff";
import { reciproAuth } from "@/lib/reciproFirebase";
import { signInHeadquarters, getFreshReciproToken, signOutRecipro } from "@/lib/reciproAuth";
import { decodeJwtPayload } from "@/lib/jwtUtils";
import { useReciproStoreList } from "@/hooks/useReciproStoreList";

const MASTER_IMPORT_ENABLED = process.env.NEXT_PUBLIC_ENABLE_MASTER_IMPORT === "true";
const ALLOWED_CUSTOMER_IDS = getAllowedCustomerIds();

// ─── Types ───────────────────────────────────────────────────────────────────

type ItemAction = "new" | "merge" | "ignore";

type WorkItem = {
  key: string;
  name: string;
  spec: string;
  price: string;
  supplier: string;
  action: ItemAction;
  selectedId: string;
  candidates: MasterCandidate[];
  newId: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSetData(data: any): Record<string, string>[] | null {
  if (!data) return null;
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.setData)) return data.setData;
  if (data.data && Array.isArray(data.data.setData)) return data.data.setData;
  if (data.result && Array.isArray(data.result.setData)) return data.result.setData;
  return null;
}

const EMPTY_MASTER_ROW: Record<string, string> = {
  "［マイカタログID］": "",
  "［食品小分類コード］": "",
  "［食品大分類名］": "",
  "［食品中分類名］": "",
  "［食品小分類名］": "",
  "［商品システムコード］": "",
  "［商品名］": "",
  "［規格］": "",
  "［入数単位］": "",
  "［単価］": "",
  "［旧単価］": "",
  "［取引先名］": "",
  "［単価変更日］": "",
  "［自社管理入数］": "",
  "［自社管理入数単位］": "",
  "［発注単価］": "",
  "［発注単位］": "",
  "［マイカタログ単価］": "",
  "［マイカタログ旧単価］": "",
  "［マイカタログ単位］": "",
  "［マイカタログ変更日］": "",
  "［食品大分類コード］": "",
  "［食品中分類コード］": "",
  "［取引先名カナ］": "",
  "［商品名カナ］": "",
  "［入数］": "",
};

function buildNextSetData(
  masterRecords: Record<string, string>[],
  workItems: WorkItem[]
): Record<string, string>[] {
  const resultMap = new Map<string, Record<string, string>>();
  for (const rec of masterRecords) {
    const id = rec["［マイカタログID］"];
    if (id) resultMap.set(id, { ...rec });
  }

  for (const item of workItems) {
    if (item.action === "ignore") continue;
    if (item.action === "merge" && item.selectedId) {
      const existing = resultMap.get(item.selectedId) ?? { ...EMPTY_MASTER_ROW };
      resultMap.set(item.selectedId, {
        ...existing,
        "［商品名］": item.name,
        "［規格］": item.spec,
        "［単価］": item.price,
        "［取引先名］": item.supplier,
      });
    }
    if (item.action === "new" && item.newId) {
      resultMap.set(item.newId, {
        ...EMPTY_MASTER_ROW,
        "［マイカタログID］": item.newId,
        "［商品名］": item.name,
        "［規格］": item.spec,
        "［単価］": item.price,
        "［取引先名］": item.supplier,
      });
    }
  }

  return Array.from(resultMap.values());
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OcrImportPage() {
  const { user } = useAuth();
  const router = useRouter();

  // 接続設定
  const [customerID, setCustomerID] = useState("");
  const [storeID, setStoreID] = useState("");

  // Recipro認証
  const [reciproLoggedIn, setReciptoLoggedIn] = useState(false);
  const [reciproInitializing, setReciptoInitializing] = useState(true);
  const [reciproDisplayName, setReciptoDisplayName] = useState("");
  const [loginDisplayId, setLoginDisplayId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [hqMode, setHqMode] = useState(false);
  const [savedStoreId, setSavedStoreId] = useState("");
  const [currentToken, setCurrentToken] = useState<string | null>(null);

  // 画像 / OCR
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [ocrError, setOcrError] = useState("");

  // 編集可能な作業リスト
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);

  // マスタ突き合わせ
  const [masterRecords, setMasterRecords] = useState<Record<string, string>[] | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState("");

  // 反映
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // 差分タブ
  const [diffTab, setDiffTab] = useState<"new" | "updated" | "removed">("new");
  const [diffExpanded, setDiffExpanded] = useState(false);

  const companyId = user?.uid ?? "";
  const companyIdRef = useRef(companyId);
  useEffect(() => { companyIdRef.current = companyId; }, [companyId]);

  // Admin access gate — redirect non-admins to top
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) => {
      fetch("/api/admin/check", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => { if (!res.ok) router.replace("/"); })
        .catch(() => router.replace("/"));
    });
  }, [user, router]);

  useEffect(() => {
    return onAuthStateChanged(reciproAuth, async (u) => {
      if (u) {
        setReciptoLoggedIn(true);
        try {
          const token = await u.getIdToken();
          setCurrentToken(token);
          const p = decodeJwtPayload(token) ?? {};
          if (typeof p.name === "string") setReciptoDisplayName(p.name);
          if (typeof p.customerID === "string") setCustomerID(p.customerID);
          const jwtStoreID = typeof p.storeID === "string" ? p.storeID : "";
          if (jwtStoreID) {
            setStoreID(jwtStoreID);
            setHqMode(false);
          } else {
            setHqMode(true);
            if (companyIdRef.current) {
              const saved = await getReciproSettings(companyIdRef.current).catch(() => null);
              setSavedStoreId(saved?.storeID ?? "");
            }
          }
        } catch { /* ignore */ }
      } else {
        setReciptoLoggedIn(false);
        setReciptoDisplayName("");
        setCustomerID("");
        setStoreID("");
        setHqMode(false);
        setSavedStoreId("");
        setCurrentToken(null);
      }
      setReciptoInitializing(false);
    });
  }, []);

  // ─── 差分プレビュー (自動計算) ───────────────────────────────────────────

  const diff = useMemo(() => {
    if (!masterRecords || workItems.length === 0) return null;
    const next = buildNextSetData(masterRecords, workItems);
    return computeMasterDiff(masterRecords, next);
  }, [masterRecords, workItems]);

  // ─── ハンドラ ─────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!loginDisplayId.trim() || !loginPassword) return;
    setLoginLoading(true);
    setLoginError("");
    try {
      const result = await signInHeadquarters(loginDisplayId.trim(), loginPassword);
      assertCustomerAllowed(result.customerID);
      if (result.customerID) setCustomerID(result.customerID);
      if (result.storeID) setStoreID(result.storeID);
      if (result.displayName) setReciptoDisplayName(result.displayName);
      setLoginPassword("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ログインに失敗しました";
      setLoginError(msg);
      console.error("[signInHeadquarters]", err);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOutRecipro();
  };

  // 店舗一覧（本部ユーザー用）
  const { stores, isLoading: storesLoading, error: storesError, selectedStoreId, setSelectedStoreId } =
    useReciproStoreList({ customerID, token: currentToken, enabled: hqMode, initialStoreId: savedStoreId });

  useEffect(() => {
    if (hqMode && selectedStoreId) setStoreID(selectedStoreId);
  }, [hqMode, selectedStoreId]);

  const handleStoreSelect = async (storeId: string) => {
    setSelectedStoreId(storeId);
    if (companyId && customerID) {
      await saveReciproSettings(companyId, { customerID, storeID: storeId }).catch(console.warn);
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImageFile(file);
    setWorkItems([]);
    setMasterRecords(null);
    setOcrError("");
    setApplyError("");
    setApplySuccess("");
  };

  const handleAnalyze = async () => {
    if (!imageFile || !user) return;
    setAnalyzing(true);
    setOcrError("");
    setWorkItems([]);
    try {
      const token = await user.getIdToken();
      const form = new FormData();
      form.append("image", imageFile);
      const res = await fetch("/api/ocr/receipt", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        const msg: string = data.error ?? "解析に失敗しました";
        setOcrError(msg);
        console.error("[ocr/receipt]", msg);
        return;
      }
      const items = (data.items ?? []) as {
        name: string; spec?: string; price?: number; supplier?: string;
      }[];
      setWorkItems(
        items.map((item, i) => ({
          key: `ocr-${i}-${Date.now()}`,
          name: item.name,
          spec: item.spec ?? "",
          price: item.price != null ? String(item.price) : "",
          supplier: item.supplier ?? "",
          action: "new" as ItemAction,
          selectedId: "",
          candidates: [],
          newId: "",
        }))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "通信エラー";
      setOcrError(msg);
      console.error("[ocr/receipt]", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const updateWorkItem = (key: string, patch: Partial<WorkItem>) => {
    setWorkItems((prev) => prev.map((w) => (w.key === key ? { ...w, ...patch } : w)));
  };

  const handleMatch = async () => {
    if (!user || workItems.length === 0) return;
    setMatching(true);
    setMatchError("");
    setMasterRecords(null);
    try {
      let token = await getFreshReciproToken();
      if (!token) {
        setMatchError("Reciproへのログインが必要です");
        return;
      }

      const doFetch = (t: string) =>
        fetch("/api/recipro/getMaster", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify({ customerID: customerID.trim(), storeID: storeID.trim() }),
        });

      let res = await doFetch(token);
      if (!res.ok && (res.status === 401 || res.status === 403)) {
        const fresh = await getFreshReciproToken(true);
        if (fresh) { res = await doFetch(fresh); }
      }

      let data: unknown;
      try { data = await res.json(); } catch { data = null; }

      if (!res.ok) {
        const serverMsg =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : null;
        const msg =
          res.status === 401
            ? "Reciproセッションが失効しています。再ログインしてください。"
            : res.status === 403
            ? serverMsg ?? "この操作を実行する権限がありません。"
            : res.status === 500
            ? "管理者認証に失敗しました。サーバー設定を確認してください。"
            : serverMsg ?? (data != null ? JSON.stringify(data) : `HTTP ${res.status}`);
        setMatchError(msg);
        return;
      }

      const records = extractSetData(data) ?? [];
      setMasterRecords(records);

      const baseId = nextMobileIdFromMaster(records);
      let idOffset = 0;

      setWorkItems((prev) =>
        prev.map((item) => {
          const candidates = findMasterCandidates(
            item.name,
            item.supplier || undefined,
            item.price ? Number(item.price) : undefined,
            records
          );
          const topScore = candidates[0]?.score ?? 0;
          const autoMerge = topScore >= 60;
          const newId = !autoMerge ? String(Number(baseId) + idOffset++) : "";
          if (!autoMerge) idOffset;
          return {
            ...item,
            candidates,
            action: autoMerge ? "merge" : "new",
            selectedId: autoMerge ? candidates[0].id : "",
            newId: autoMerge ? "" : newId,
          };
        })
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "通信エラー";
      setMatchError(msg);
      console.error("[match]", err);
    } finally {
      setMatching(false);
    }
  };

  const handleApply = async () => {
    if (!user) return;

    setApplying(true);
    setApplyError("");
    setApplySuccess("");

    try {
      let token = await getFreshReciproToken();
      if (!token) {
        setApplyError("Reciproへのログインが必要です");
        setShowConfirm(false);
        return;
      }

      assertCustomerAllowed(customerID.trim());

      const nextSetData = buildNextSetData(masterRecords ?? [], workItems);

      console.log("[setAdminMaster via OCR] 送信データ:", {
        customerID: customerID.trim(),
        storeID: storeID.trim(),
        count: nextSetData.length,
        sample: nextSetData[0],
      });

      const doApply = (t: string) =>
        setAdminMasterWithLog({
          customerID: customerID.trim(),
          storeID: storeID.trim(),
          setData: nextSetData,
          reciproToken: t,
          current: masterRecords ?? [],
          source: "ocr-import",
          triggerUserEmail: user.email ?? null,
        });

      let result = await doApply(token);
      if (!result.ok && (result.status === 401 || result.status === 403)) {
        const fresh = await getFreshReciproToken(true);
        if (fresh) { result = await doApply(fresh); }
      }

      if (!result.ok) {
        const serverMsg =
          result.data && typeof result.data === "object" && "error" in result.data
            ? String((result.data as { error: unknown }).error)
            : null;
        const msg =
          result.status === 401
            ? "Reciproへの再ログインが必要です"
            : result.status === 403
            ? serverMsg ?? "権限がありません（許可されていない customerID の可能性があります）"
            : result.status === 500
            ? serverMsg === "Failed to authenticate as admin"
              ? "サーバーで管理者認証に失敗しました。管理者にお問い合わせください。"
              : serverMsg ?? `HTTP ${result.status}`
            : result.data != null ? JSON.stringify(result.data, null, 2) : `HTTP ${result.status}`;
        setApplyError(msg);
        console.error("[setAdminMaster] error:", result.status, result.data);
        setShowConfirm(false);
        return;
      }

      setApplySuccess(JSON.stringify(result.data, null, 2));
      setShowConfirm(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "通信エラー";
      setApplyError(msg);
      console.error("[setAdminMaster]", err);
      setShowConfirm(false);
    } finally {
      setApplying(false);
    }
  };

  // ─── Derived ─────────────────────────────────────────────────────────────

  const canApply =
    MASTER_IMPORT_ENABLED &&
    reciproLoggedIn &&
    !!customerID.trim() &&
    !!storeID.trim() &&
    workItems.some((w) => w.action !== "ignore");

  if (!user) return null;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[600px] px-4 py-6 space-y-4">

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none">‹</button>
          <h1 className="text-xl font-bold text-gray-900">伝票OCR取込（管理）</h1>
        </div>

        {/* バナー */}
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-1.5">
          <p className="text-sm font-bold text-amber-800">このページは管理者・開発環境専用です</p>
          {MASTER_IMPORT_ENABLED ? (
            <p className="text-xs text-amber-700 font-semibold">
              ✅ NEXT_PUBLIC_ENABLE_MASTER_IMPORT=true — setAdminMaster 反映が有効です
            </p>
          ) : (
            <p className="text-xs text-amber-700">
              反映を有効にするには <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_ENABLE_MASTER_IMPORT=true</code> を追加してください。
            </p>
          )}
          {ALLOWED_CUSTOMER_IDS.length > 0 ? (
            <p className="text-xs text-amber-700">
              <span className="font-semibold">反映許可 customerID:</span>{" "}
              {ALLOWED_CUSTOMER_IDS.map((id) => (
                <code key={id} className="bg-amber-100 px-1 rounded mr-1">{id}</code>
              ))}
            </p>
          ) : (
            <p className="text-xs font-semibold text-red-600">
              ⚠️ 反映先未設定 — NEXT_PUBLIC_ALLOWED_CUSTOMER_IDS が未設定です
            </p>
          )}
        </div>

        {/* 接続設定 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="font-bold text-gray-900">接続設定</h2>
          {reciproInitializing ? (
            <div className="h-8 rounded-xl bg-gray-100 animate-pulse" />
          ) : (
            <>
              {/* Reciproログイン / customerID・storeID */}
              {reciproLoggedIn ? (
                <>
                  <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-green-700">✅ Recipro本部ユーザー</p>
                      {reciproDisplayName && (
                        <p className="text-xs text-green-600">{reciproDisplayName}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-300 text-green-600 hover:bg-green-100 transition-colors"
                    >
                      ログアウト
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1.5">
                    <p>
                      <span className="font-semibold">customerID:</span>{" "}
                      {customerID.trim() || <span className="text-red-400">未設定</span>}
                    </p>
                    <div>
                      <span className="font-semibold">店舗:</span>{" "}
                      {hqMode ? (
                        storesLoading ? (
                          <span className="text-gray-400">取得中...</span>
                        ) : storesError ? (
                          <span className="text-red-400">{storesError}</span>
                        ) : stores.length === 1 ? (
                          <span>{stores[0].name} <span className="text-gray-400">({stores[0].id})</span></span>
                        ) : stores.length > 1 ? (
                          <select
                            value={selectedStoreId}
                            onChange={(e) => handleStoreSelect(e.target.value)}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:ring-2 focus:border-transparent"
                          >
                            {stores.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-red-400">未設定</span>
                        )
                      ) : (
                        storeID.trim() || <span className="text-red-400">未設定</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-700">Recipro本部ユーザーでログイン</p>
                  <input
                    type="text"
                    value={loginDisplayId}
                    onChange={(e) => setLoginDisplayId(e.target.value)}
                    placeholder="displayID（例: user001）"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:border-transparent"
                  />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="パスワード"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:border-transparent"
                    onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                  />
                  {loginError && <p className="text-xs text-red-500">{loginError}</p>}
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={loginLoading || !loginDisplayId.trim() || !loginPassword}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                    style={{ backgroundColor: "#E85D2C" }}
                  >
                    {loginLoading ? "ログイン中..." : "ログイン"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 画像アップロード */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="font-bold text-gray-900">伝票画像アップロード</h2>
          <p className="text-xs text-gray-500">納品書・仕入伝票・レシートの画像（JPEG/PNG/WebP）</p>

          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 rounded-xl py-6 text-center hover:border-orange-400 transition-colors">
              <p className="text-sm font-medium text-gray-600">
                {imageFile ? imageFile.name : "画像ファイルを選択..."}
              </p>
              {imageFile && (
                <p className="text-xs text-gray-400 mt-1">別の画像を選択し直す場合はクリック</p>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange} className="hidden" />
          </label>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!imageFile || analyzing}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
            style={{ backgroundColor: "#E85D2C" }}
          >
            {analyzing ? "解析中..." : "Claude Haikuで解析"}
          </button>

          {ocrError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{ocrError}</p>
            </div>
          )}
        </div>

        {/* OCR結果 編集テーブル */}
        {workItems.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">解析結果 ({workItems.length}件)</h2>
              <p className="text-xs text-gray-400">編集可能</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="text-xs w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium whitespace-nowrap">商品名</th>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium whitespace-nowrap">規格</th>
                    <th className="px-2 py-2 text-right text-gray-500 font-medium whitespace-nowrap">単価</th>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium whitespace-nowrap">取引先</th>
                  </tr>
                </thead>
                <tbody>
                  {workItems.map((item) => (
                    <tr key={item.key} className="border-t border-gray-100">
                      <td className="px-1 py-1">
                        <input type="text" value={item.name}
                          onChange={(e) => updateWorkItem(item.key, { name: e.target.value })}
                          className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs outline-none focus:ring-1 min-w-[100px]" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="text" value={item.spec}
                          onChange={(e) => updateWorkItem(item.key, { spec: e.target.value })}
                          className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs outline-none focus:ring-1 min-w-[60px]" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="text" value={item.price}
                          onChange={(e) => updateWorkItem(item.key, { price: e.target.value })}
                          className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs outline-none focus:ring-1 text-right min-w-[60px]" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="text" value={item.supplier}
                          onChange={(e) => updateWorkItem(item.key, { supplier: e.target.value })}
                          className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs outline-none focus:ring-1 min-w-[80px]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* マスタ突き合わせボタン */}
            {!customerID.trim() || !storeID.trim() ? (
              <p className="text-xs text-red-400 text-center">突き合わせには customerID/storeID の設定が必要です</p>
            ) : !reciproLoggedIn ? (
              <p className="text-xs text-red-400 text-center">突き合わせには Recipro ログインが必要です</p>
            ) : (
              <button
                type="button"
                onClick={handleMatch}
                disabled={matching}
                className="w-full py-2.5 rounded-xl text-sm font-bold border-2 border-orange-400 text-orange-600 disabled:opacity-40 hover:bg-orange-50 transition-colors"
              >
                {matching ? "マスタ取得・突き合わせ中..." : "マスタと突き合わせる (getAdminMaster)"}
              </button>
            )}

            {matchError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                <p className="text-xs text-red-600">{matchError}</p>
              </div>
            )}
          </div>
        )}

        {/* 突き合わせ結果 + アクション選択 */}
        {masterRecords !== null && workItems.some((w) => w.candidates.length > 0 || w.action !== "new") && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h2 className="font-bold text-gray-900">突き合わせ結果</h2>
            <p className="text-xs text-gray-500">
              現在マスタ: {masterRecords.length}件 / 各アイテムのアクションを確認・変更してください
            </p>

            <div className="space-y-3">
              {workItems.map((item) => (
                <div key={item.key} className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                      {item.spec && <p className="text-xs text-gray-400">{item.spec}</p>}
                      {item.price && <p className="text-xs text-gray-500">¥{item.price}</p>}
                    </div>
                    {/* アクション選択 */}
                    <div className="flex gap-1 shrink-0">
                      {(["new", "merge", "ignore"] as const).map((a) => {
                        const labels = { new: "新規", merge: "統合", ignore: "無視" };
                        const colors = {
                          new: item.action === a ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600",
                          merge: item.action === a ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600",
                          ignore: item.action === a ? "bg-gray-500 text-white" : "bg-gray-100 text-gray-600",
                        };
                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => updateWorkItem(item.key, { action: a, selectedId: a === "merge" ? (item.candidates[0]?.id ?? "") : "" })}
                            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${colors[a]}`}
                          >
                            {labels[a]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 候補一覧 (merge時) */}
                  {item.action === "merge" && item.candidates.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-blue-600">統合先を選択:</p>
                      {item.candidates.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`candidate-${item.key}`}
                            checked={item.selectedId === c.id}
                            onChange={() => updateWorkItem(item.key, { selectedId: c.id })}
                            className="h-3 w-3"
                          />
                          <span className="text-[10px] text-gray-700">
                            ID:{c.id} — {c.name}
                            <span className="text-blue-500 ml-1">({c.reason} / スコア:{c.score})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* 新規の場合: 採番済みID表示 */}
                  {item.action === "new" && item.newId && (
                    <p className="text-[10px] text-green-600">
                      新規採番ID: <span className="font-mono font-bold">{item.newId}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 差分プレビュー */}
        {diff && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
            <p className="text-xs font-bold text-blue-800">変更内容サマリ</p>
            <div className="text-xs text-blue-900 space-y-0.5">
              <p><span className="font-semibold text-green-700">新規追加: {diff.newItems.length}件</span></p>
              <p><span className="font-semibold text-orange-700">更新: {diff.updatedItems.length}件</span></p>
              <p className="text-blue-700">変更なし: {diff.unchangedItems.length}件</p>
              <p className="text-gray-500">
                CSVに含まれない既存データ: {diff.removedItems.length}件
                {diff.removedItems.length > 0 && "（削除はされません）"}
              </p>
            </div>

            <button type="button" onClick={() => setDiffExpanded((v) => !v)}
              className="text-xs font-semibold text-blue-600 underline">
              {diffExpanded ? "詳細を閉じる ▲" : "詳細を見る ▼"}
            </button>

            {diffExpanded && (
              <div className="space-y-2">
                <div className="flex gap-1">
                  {(["new", "updated", "removed"] as const).map((tab) => {
                    const labels = {
                      new: `新規 (${diff.newItems.length})`,
                      updated: `更新 (${diff.updatedItems.length})`,
                      removed: `削除候補 (${diff.removedItems.length})`,
                    };
                    return (
                      <button key={tab} type="button" onClick={() => setDiffTab(tab)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                          diffTab === tab ? "bg-blue-600 text-white" : "bg-white/70 text-blue-700"
                        }`}
                      >{labels[tab]}</button>
                    );
                  })}
                </div>

                <div className="bg-white rounded-xl border border-blue-100 p-2 max-h-60 overflow-y-auto">
                  {diffTab === "new" && (
                    diff.newItems.length === 0
                      ? <p className="text-xs text-gray-400 text-center py-4">新規追加なし</p>
                      : <table className="text-[10px] w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-1 py-1 text-left text-gray-500">ID</th>
                              <th className="px-1 py-1 text-left text-gray-500">商品名</th>
                              <th className="px-1 py-1 text-right text-gray-500">単価</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diff.newItems.slice(0, 100).map((i) => (
                              <tr key={i.id} className="border-t border-gray-100">
                                <td className="px-1 py-1 text-gray-500">{i.id}</td>
                                <td className="px-1 py-1 text-gray-900">{i.record["［商品名］"]}</td>
                                <td className="px-1 py-1 text-right text-gray-700">{i.record["［単価］"]}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                  )}
                  {diffTab === "updated" && (
                    diff.updatedItems.length === 0
                      ? <p className="text-xs text-gray-400 text-center py-4">更新なし</p>
                      : <div className="space-y-2">
                          {diff.updatedItems.slice(0, 100).map((item) => (
                            <div key={item.id} className="border border-gray-100 rounded-lg p-2">
                              <p className="text-[10px] font-semibold text-gray-700 mb-1">
                                ID: {item.id} — {item.nextRecord["［商品名］"]}
                              </p>
                              {item.diffs.map((d) => (
                                <p key={d.field} className="text-[10px] text-gray-600">
                                  <span className="font-medium text-gray-500">{d.field}:</span>{" "}
                                  <span className="text-red-500 line-through">{d.oldValue || "（空）"}</span>
                                  {" → "}
                                  <span className="text-green-600 font-semibold">{d.newValue || "（空）"}</span>
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                  )}
                  {diffTab === "removed" && (
                    diff.removedItems.length === 0
                      ? <p className="text-xs text-gray-400 text-center py-4">削除候補なし</p>
                      : <table className="text-[10px] w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-1 py-1 text-left text-gray-500">ID</th>
                              <th className="px-1 py-1 text-left text-gray-500">商品名</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diff.removedItems.slice(0, 100).map((i) => (
                              <tr key={i.id} className="border-t border-gray-100">
                                <td className="px-1 py-1 text-gray-500">{i.id}</td>
                                <td className="px-1 py-1 text-gray-900">{i.record["［商品名］"]}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 反映ボタン */}
        {workItems.length > 0 && masterRecords !== null && (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={!canApply}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
            style={{ backgroundColor: "#E85D2C" }}
          >
            {!MASTER_IMPORT_ENABLED
              ? "反映無効（NEXT_PUBLIC_ENABLE_MASTER_IMPORT=true が必要）"
              : !reciproLoggedIn
              ? "Reciproにログインしてください"
              : !customerID.trim()
              ? "customerID を設定してください"
              : "レシプロマスタに反映する"}
          </button>
        )}

        {/* エラー / 成功 */}
        {applyError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm font-bold text-red-700">反映エラー</p>
            <p className="text-sm text-red-600 whitespace-pre-wrap">{applyError}</p>
          </div>
        )}
        {applySuccess && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4">
            <p className="text-sm font-bold text-green-700">反映成功</p>
            <pre className="text-xs text-green-800 overflow-x-auto whitespace-pre-wrap max-h-32">{applySuccess}</pre>
          </div>
        )}
      </div>

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => { if (!applying) setShowConfirm(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-red-600">⚠️ レシプロマスタを更新します</p>
            <div className="rounded-xl bg-gray-50 p-3 space-y-1.5 text-sm">
              <p><span className="font-semibold text-gray-500">customerID:</span>{" "}
                <span className="font-mono">{customerID}</span></p>
              <p><span className="font-semibold text-gray-500">storeID:</span>{" "}
                <span className="font-mono">{storeID}</span></p>
              <p><span className="font-semibold text-gray-500">OCRアイテム:</span>{" "}
                <span className="font-bold">{workItems.filter((w) => w.action !== "ignore").length}件を反映</span>
                （{workItems.filter((w) => w.action === "ignore").length}件は無視）
              </p>
              {diff && (
                <p className="text-xs text-gray-500">
                  差分: 新規{diff.newItems.length}件 / 更新{diff.updatedItems.length}件
                </p>
              )}
            </div>
            <p className="text-xs text-red-500">この操作はマスタデータに直接影響します。元に戻せません。</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowConfirm(false)} disabled={applying}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 disabled:opacity-40">
                キャンセル
              </button>
              <button type="button" onClick={handleApply} disabled={applying}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#E85D2C" }}>
                {applying && <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                {applying ? "送信中..." : "反映する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
