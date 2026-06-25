"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { getReciproSettings, saveReciproSettings } from "@/lib/firestore";
import { assertCustomerAllowed, getAllowedCustomerIds } from "@/lib/allowedCustomers";
import { computeMasterDiff, diffIdRange } from "@/lib/masterDiff";
import { setAdminMasterWithLog } from "@/lib/setAdminMasterWithLog";
import { reciproAuth } from "@/lib/reciproFirebase";
import { signInHeadquarters, getFreshReciproToken, signOutRecipro } from "@/lib/reciproAuth";
import { decodeJwtPayload } from "@/lib/jwtUtils";
import { useReciproStoreList } from "@/hooks/useReciproStoreList";

const MASTER_IMPORT_ENABLED = process.env.NEXT_PUBLIC_ENABLE_MASTER_IMPORT === "true";
const ALLOWED_CUSTOMER_IDS = getAllowedCustomerIds();

type VerifyStats = {
  total: number;
  infomart: number;
  mobile: number;
  other: number;
  minId: string;
  maxId: string;
  withName: number;
  head3: Record<string, string>[];
  tail3: Record<string, string>[];
  items: Record<string, string>[];
  raw: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSetData(data: any): any[] | null {
  if (!data) return null;
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.setData)) return data.setData;
  if (data.data && Array.isArray(data.data.setData)) return data.data.setData;
  if (data.result && Array.isArray(data.result.setData)) return data.result.setData;
  return null;
}

function computeVerifyStats(data: unknown): VerifyStats {
  const setData = extractSetData(data) ?? [];
  const ids = setData.map((r) => Number(r["［マイカタログID］"] ?? ""));
  const validIds = ids.filter((n) => Number.isFinite(n) && n > 0);
  return {
    total: setData.length,
    infomart: setData.filter((_, i) => ids[i] >= 1 && ids[i] <= 9999).length,
    mobile: setData.filter((_, i) => ids[i] >= 10000).length,
    other: setData.filter((_, i) => !Number.isFinite(ids[i]) || ids[i] <= 0).length,
    minId: validIds.length ? String(Math.min(...validIds)) : "—",
    maxId: validIds.length ? String(Math.max(...validIds)) : "—",
    withName: setData.filter((r) => r["［商品名］"]).length,
    head3: setData.slice(0, 3),
    tail3: setData.length > 3 ? setData.slice(-3) : [],
    items: setData,
    raw: data,
  };
}

type SetDataRow = Record<string, string>;

type ParseResult = {
  setData: SetDataRow[];
  total: number;
  headers: string[];
  unmappedColumns: string[];
  parseMode: "index" | "header";
};

export default function AdminMasterImportPage() {
  const { user } = useAuth();
  const router = useRouter();

  // 接続設定
  const [customerID, setCustomerID] = useState("");
  const [storeID, setStoreID] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

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

  // CSV
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  // 送信オプション
  const [appendIrisuCr, setAppendIrisuCr] = useState(false);

  // 反映
  const [showConfirm, setShowConfirm] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState("");

  // getAdminMaster 確認
  const [verifyResult, setVerifyResult] = useState<VerifyStats | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  // 差分プレビュー
  const [diffExpanded, setDiffExpanded] = useState(false);
  const [diffTab, setDiffTab] = useState<"new" | "updated" | "removed">("new");

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
      // Auto-save customerID (storeID only for non-HQ users who have it in JWT)
      if (companyId && result.customerID) {
        await saveReciproSettings(companyId, {
          customerID: result.customerID,
          ...(result.storeID ? { storeID: result.storeID } : {}),
        }).catch(console.warn);
      }
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

  const handleSaveSettings = async () => {
    if (!companyId || !customerID.trim() || !storeID.trim()) return;
    setSettingsSaving(true);
    try {
      await saveReciproSettings(companyId, {
        customerID: customerID.trim(),
        storeID: storeID.trim(),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (e) {
      console.error("[saveReciproSettings]", e);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleCsvChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setCsvFileName(file.name);
    setParseResult(null);
    setParseError("");
    setParsing(true);

    try {
      const token = await user.getIdToken();
      const form = new FormData();
      form.append("csv", file);
      const res = await fetch("/api/admin/parse-master-csv", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        const msg: string = data.error ?? "パースに失敗しました";
        setParseError(msg);
        console.error("[parse-master-csv]", msg);
        return;
      }
      setParseResult(data as ParseResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "通信エラー";
      setParseError(msg);
      console.error("[parse-master-csv]", err);
    } finally {
      setParsing(false);
    }
  };

  const handleApply = async () => {
    if (!user || !parseResult || !customerID.trim() || !storeID.trim()) return;
    if (!MASTER_IMPORT_ENABLED) return;

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

      const finalSetData = appendIrisuCr
        ? parseResult.setData.map((row) => ({ ...row, "［入数］": row["［入数］"] + "\r" }))
        : parseResult.setData;

      assertCustomerAllowed(customerID.trim());

      console.log("[setAdminMaster] 送信データ:", {
        customerID: customerID.trim(),
        storeID: storeID.trim(),
        setDataCount: finalSetData.length,
        setData0: finalSetData[0],
      });

      const doApply = (t: string) =>
        setAdminMasterWithLog({
          customerID: customerID.trim(),
          storeID: storeID.trim(),
          setData: finalSetData,
          reciproToken: t,
          current: verifyResult?.items ?? [],
          source: "master-import",
          triggerUserEmail: user.email ?? null,
        });

      let result = await doApply(token);
      if (!result.ok && (result.status === 401 || result.status === 403)) {
        const fresh = await getFreshReciproToken(true);
        if (fresh) { token = fresh; result = await doApply(fresh); }
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
            : result.data != null
            ? JSON.stringify(result.data, null, 2)
            : `HTTP ${result.status}`;
        setApplyError(msg);
        console.error("[setAdminMaster] error:", result.status, result.data);
        setShowConfirm(false);
        return;
      }

      setApplySuccess(JSON.stringify(result.data, null, 2));
      setShowConfirm(false);
      await doVerify();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "通信エラー";
      setApplyError(msg);
      console.error("[setAdminMaster]", err);
      setShowConfirm(false);
    } finally {
      setApplying(false);
    }
  };

  const doVerify = async () => {
    if (!user || !customerID.trim() || !storeID.trim()) return;
    setVerifying(true);
    setVerifyError("");
    try {
      let token = await getFreshReciproToken();
      if (!token) {
        setVerifyError("Reciproへのログインが必要です");
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
            : serverMsg ?? (data != null ? JSON.stringify(data, null, 2) : `HTTP ${res.status}`);
        setVerifyError(msg);
        console.error("[getAdminMaster] error:", res.status, data);
      } else {
        setVerifyResult(computeVerifyStats(data));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "通信エラー";
      setVerifyError(msg);
      console.error("[getAdminMaster]", err);
    } finally {
      setVerifying(false);
    }
  };

  if (!user) return null;

  const diff = useMemo(() => {
    if (!verifyResult || !parseResult) return null;
    return computeMasterDiff(verifyResult.items, parseResult.setData);
  }, [verifyResult, parseResult]);

  const canApply =
    MASTER_IMPORT_ENABLED &&
    !!parseResult &&
    parseResult.total > 0 &&
    !!customerID.trim() &&
    !!storeID.trim() &&
    reciproLoggedIn;

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[600px] px-4 py-6 space-y-4">

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ‹
          </button>
          <h1 className="text-xl font-bold text-gray-900">食材マスタ取込（管理）</h1>
        </div>

        {/* 開発環境バナー */}
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-1.5">
          <p className="text-sm font-bold text-amber-800">このページは管理者・開発環境専用です</p>
          {MASTER_IMPORT_ENABLED ? (
            <p className="text-xs text-amber-700 font-semibold">
              ✅ NEXT_PUBLIC_ENABLE_MASTER_IMPORT=true — setAdminMaster 反映が有効です
            </p>
          ) : (
            <p className="text-xs text-amber-700">
              反映を有効にするには{" "}
              <code className="bg-amber-100 px-1 rounded">.env.local</code> に{" "}
              <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_ENABLE_MASTER_IMPORT=true</code>{" "}
              を追加してください。現在はCSVプレビューのみ可能です。
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
              ⚠️ 反映先未設定 — NEXT_PUBLIC_ALLOWED_CUSTOMER_IDS が未設定です。setAdminMaster は呼び出せません。
            </p>
          )}
        </div>

        {/* 接続設定 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="font-bold text-gray-900">接続設定</h2>
          {reciproInitializing ? (
            <div className="space-y-2">
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <>
              {/* Reciproログイン */}
              {reciproLoggedIn ? (
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

              {/* customerID / storeID / 保存 — ログイン後のみ */}
              {reciproLoggedIn ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      customerID
                    </label>
                    <input
                      type="text"
                      value={customerID}
                      onChange={(e) => setCustomerID(e.target.value)}
                      placeholder="例: C000123"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      店舗
                    </label>
                    {hqMode ? (
                      storesLoading ? (
                        <p className="text-sm text-gray-400 py-1">店舗一覧を取得中...</p>
                      ) : storesError ? (
                        <div className="space-y-1">
                          <p className="text-xs text-red-500">{storesError}</p>
                          <input
                            type="text"
                            value={storeID}
                            onChange={(e) => setStoreID(e.target.value)}
                            placeholder="storeID を手動入力"
                            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:border-transparent"
                          />
                        </div>
                      ) : stores.length === 1 ? (
                        <p className="text-sm text-gray-700 py-1">
                          {stores[0].name}
                          <span className="ml-1 text-xs text-gray-400">({stores[0].id})</span>
                        </p>
                      ) : stores.length > 1 ? (
                        <select
                          value={selectedStoreId}
                          onChange={(e) => handleStoreSelect(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:border-transparent"
                        >
                          {stores.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={storeID}
                          onChange={(e) => setStoreID(e.target.value)}
                          placeholder="storeID を手動入力"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:border-transparent"
                        />
                      )
                    ) : (
                      <input
                        type="text"
                        value={storeID}
                        onChange={(e) => setStoreID(e.target.value)}
                        placeholder="例: S000456"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:border-transparent"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={settingsSaving || !customerID.trim() || !storeID.trim()}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                      style={{ backgroundColor: "#E85D2C" }}
                    >
                      {settingsSaving ? "保存中..." : "保存"}
                    </button>
                    {settingsSaved && (
                      <span className="text-sm text-green-600 font-medium">✅ 保存しました</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400">
                  ログイン後に customerID / storeID が表示されます
                </p>
              )}
            </>
          )}
        </div>

        {/* CSVアップロード */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="font-bold text-gray-900">CSVアップロード</h2>
          <p className="text-xs text-gray-500">
            レシプロ形式のCSV（Shift_JIS）または本アプリからエクスポートしたCSVをアップロードしてください。
          </p>
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 rounded-xl py-6 text-center hover:border-orange-400 transition-colors">
              <p className="text-sm font-medium text-gray-600">
                {csvFileName || "CSVファイルを選択..."}
              </p>
              {csvFileName && (
                <p className="text-xs text-gray-400 mt-1">別のファイルを選択し直す場合はクリック</p>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleCsvChange}
              className="hidden"
            />
          </label>

          {parsing && (
            <p className="text-sm text-gray-500 text-center">パース中...</p>
          )}
          {parseError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{parseError}</p>
            </div>
          )}
        </div>

        {/* プレビュー */}
        {parseResult && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">プレビュー</h2>
              <span className="text-xs text-gray-400">
                {parseResult.parseMode === "index" ? "インデックスベース" : "ヘッダーベース"}
              </span>
            </div>

            <p className="text-sm text-gray-700 font-medium">
              {parseResult.total}件のデータを読み込みました
            </p>

            {parseResult.unmappedColumns.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs font-semibold text-amber-800">
                  ヘッダー名が異なる列（位置ベースで自動補完済み）:
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {parseResult.unmappedColumns.join("、")}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  ※ 重複ヘッダー・エイリアス列はインデックス位置で正しくマッピングされています
                </p>
              </div>
            )}

            {/* 表 */}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="text-xs w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium whitespace-nowrap">カタログID</th>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium whitespace-nowrap">商品名</th>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium whitespace-nowrap">規格</th>
                    <th className="px-2 py-2 text-right text-gray-500 font-medium whitespace-nowrap">単価</th>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium whitespace-nowrap">取引先</th>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium whitespace-nowrap">入数</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.setData.slice(0, 200).map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 text-gray-500">{row["［マイカタログID］"]}</td>
                      <td className="px-2 py-1.5 text-gray-900 font-medium">{row["［商品名］"]}</td>
                      <td className="px-2 py-1.5 text-gray-500">{row["［規格］"]}</td>
                      <td className="px-2 py-1.5 text-right text-gray-700">{row["［単価］"]}</td>
                      <td className="px-2 py-1.5 text-gray-500">{row["［取引先名］"]}</td>
                      <td className="px-2 py-1.5 text-gray-500">{row["［入数］"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parseResult.total > 200 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  ほか {parseResult.total - 200} 件（表示省略）
                </p>
              )}
            </div>

            {/* 反映設定の確認 */}
            <div className="rounded-xl bg-gray-50 p-3 space-y-1 text-xs text-gray-600">
              <p>
                <span className="font-semibold">customerID:</span>{" "}
                {customerID.trim() || <span className="text-red-400">未設定</span>}
              </p>
              <p>
                <span className="font-semibold">storeID:</span>{" "}
                {storeID.trim() || <span className="text-red-400">未設定</span>}
              </p>
              <p>
                <span className="font-semibold">件数:</span> {parseResult.total}件（うち名前あり:{" "}
                {parseResult.setData.filter((r) => r["［商品名］"]).length}件）
              </p>
            </div>

            {/* 送信オプション */}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 select-none">
              <input
                type="checkbox"
                checked={appendIrisuCr}
                onChange={(e) => setAppendIrisuCr(e.target.checked)}
                className="h-4 w-4"
              />
              <span>
                <code className="bg-gray-100 px-1 rounded">[$入数]</code> 末尾に{" "}
                <code className="bg-gray-100 px-1 rounded">\r</code> を付加
                <span className="text-gray-400 ml-1">（旧実装互換・デフォルト OFF）</span>
              </span>
            </label>

            {/* 差分サマリ */}
            {!verifyResult ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-700">
                  先に「現在のマスタを確認 (getAdminMaster)」を実行してください。
                  実行前でも反映は可能ですが、変更内容を事前確認できません。
                </p>
              </div>
            ) : diff ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
                <p className="text-xs font-bold text-blue-800">変更内容サマリ</p>

                {/* 全体集計 */}
                <div className="text-xs text-blue-900 space-y-0.5">
                  {(() => {
                    const priceChange = diff.updatedItems.filter((u) =>
                      u.diffs.some((d) => d.field === "［単価］")
                    ).length;
                    const supplierChange = diff.updatedItems.filter((u) =>
                      u.diffs.some((d) => d.field === "［取引先名］") &&
                      !u.diffs.some((d) => d.field === "［単価］")
                    ).length;
                    const otherChange = diff.updatedItems.length - priceChange - supplierChange;
                    return (
                      <>
                        <p>
                          <span className="font-semibold text-green-700">新規追加: {diff.newItems.length}件</span>
                        </p>
                        <p>
                          <span className="font-semibold text-orange-700">
                            更新: {diff.updatedItems.length}件
                          </span>
                          {diff.updatedItems.length > 0 && (
                            <span className="text-blue-700 ml-1">
                              （うち単価変更 {priceChange}件、取引先変更 {supplierChange}件、その他 {otherChange}件）
                            </span>
                          )}
                        </p>
                        <p className="text-blue-700">変更なし: {diff.unchangedItems.length}件</p>
                        <p className="text-gray-500">
                          CSVに含まれない既存データ: {diff.removedItems.length}件
                          {diff.removedItems.length > 0 && "（削除はされません）"}
                        </p>
                      </>
                    );
                  })()}
                </div>

                {/* ID範囲別内訳 */}
                {(() => {
                  const newRange = diffIdRange(diff.newItems.map((i) => i.id));
                  const updRange = diffIdRange(diff.updatedItems.map((i) => i.id));
                  const unchRange = diffIdRange(diff.unchangedItems.map((i) => i.id));
                  return (
                    <div className="text-[10px] text-blue-800 bg-white/60 rounded-lg p-2 space-y-0.5">
                      <p className="font-semibold text-blue-700 mb-1">ID範囲別内訳</p>
                      <p>
                        インフォマート由来 (1–9999):
                        新規 {newRange.infomart} / 更新 {updRange.infomart} / 不変 {unchRange.infomart}
                      </p>
                      <p>
                        手動追加 (10000+):
                        新規 {newRange.mobile} / 更新 {updRange.mobile} / 不変 {unchRange.mobile}
                      </p>
                    </div>
                  );
                })()}

                {/* 詳細展開ボタン */}
                <button
                  type="button"
                  onClick={() => setDiffExpanded((v) => !v)}
                  className="text-xs font-semibold text-blue-600 underline"
                >
                  {diffExpanded ? "詳細を閉じる ▲" : "詳細を見る ▼"}
                </button>

                {/* 詳細タブ */}
                {diffExpanded && (
                  <div className="space-y-2">
                    {/* タブバー */}
                    <div className="flex gap-1">
                      {(["new", "updated", "removed"] as const).map((tab) => {
                        const labels = {
                          new: `新規追加 (${diff.newItems.length})`,
                          updated: `更新 (${diff.updatedItems.length})`,
                          removed: `削除候補 (${diff.removedItems.length})`,
                        };
                        return (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setDiffTab(tab)}
                            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                              diffTab === tab
                                ? "bg-blue-600 text-white"
                                : "bg-white/70 text-blue-700 hover:bg-white"
                            }`}
                          >
                            {labels[tab]}
                          </button>
                        );
                      })}
                    </div>

                    {/* タブコンテンツ */}
                    <div className="bg-white rounded-xl border border-blue-100 p-2 max-h-72 overflow-y-auto">
                      {diffTab === "new" && (
                        diff.newItems.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">新規追加なし</p>
                        ) : (
                          <table className="text-[10px] w-full">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-1 py-1 text-left text-gray-500">ID</th>
                                <th className="px-1 py-1 text-left text-gray-500">商品名</th>
                                <th className="px-1 py-1 text-right text-gray-500">単価</th>
                                <th className="px-1 py-1 text-left text-gray-500">取引先</th>
                              </tr>
                            </thead>
                            <tbody>
                              {diff.newItems.slice(0, 100).map((item) => (
                                <tr key={item.id} className="border-t border-gray-100">
                                  <td className="px-1 py-1 text-gray-500">{item.id}</td>
                                  <td className="px-1 py-1 text-gray-900">{item.record["［商品名］"]}</td>
                                  <td className="px-1 py-1 text-right text-gray-700">{item.record["［単価］"]}</td>
                                  <td className="px-1 py-1 text-gray-500">{item.record["［取引先名］"]}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      )}

                      {diffTab === "updated" && (
                        diff.updatedItems.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">更新なし</p>
                        ) : (
                          <div className="space-y-2">
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
                            {diff.updatedItems.length > 100 && (
                              <p className="text-[10px] text-gray-400 text-center">他 {diff.updatedItems.length - 100} 件</p>
                            )}
                          </div>
                        )
                      )}

                      {diffTab === "removed" && (
                        diff.removedItems.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">削除候補なし</p>
                        ) : (
                          <table className="text-[10px] w-full">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-1 py-1 text-left text-gray-500">ID</th>
                                <th className="px-1 py-1 text-left text-gray-500">商品名</th>
                                <th className="px-1 py-1 text-right text-gray-500">単価</th>
                                <th className="px-1 py-1 text-left text-gray-500">取引先</th>
                              </tr>
                            </thead>
                            <tbody>
                              {diff.removedItems.slice(0, 100).map((item) => (
                                <tr key={item.id} className="border-t border-gray-100">
                                  <td className="px-1 py-1 text-gray-500">{item.id}</td>
                                  <td className="px-1 py-1 text-gray-900">{item.record["［商品名］"]}</td>
                                  <td className="px-1 py-1 text-right text-gray-700">{item.record["［単価］"]}</td>
                                  <td className="px-1 py-1 text-gray-500">{item.record["［取引先名］"]}</td>
                                </tr>
                              ))}
                              {diff.removedItems.length > 100 && (
                                <tr className="border-t border-gray-100">
                                  <td colSpan={4} className="px-1 py-1 text-center text-gray-400">
                                    他 {diff.removedItems.length - 100} 件
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* 反映ボタン */}
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={!canApply}
              className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: "#E85D2C" }}
            >
              {!MASTER_IMPORT_ENABLED
                ? "反映無効（NEXT_PUBLIC_ENABLE_MASTER_IMPORT=true が必要）"
                : !customerID.trim() || !storeID.trim()
                ? "customerID / storeID を設定してください"
                : !reciproLoggedIn
                ? "Reciproにログインしてください"
                : `${parseResult.total}件をレシプロマスタに反映する`}
            </button>
            {canApply && !verifyResult && (
              <p className="text-xs text-amber-600 text-center">
                ⚠️ 現在マスタ未取得のまま反映しようとしています
              </p>
            )}

            {/* getAdminMaster 確認ボタン */}
            <button
              type="button"
              onClick={() => doVerify()}
              disabled={!customerID.trim() || !storeID.trim() || !reciproLoggedIn || verifying}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 disabled:opacity-40"
            >
              {verifying ? "取得中..." : "現在のマスタを確認 (getAdminMaster)"}
            </button>
          </div>
        )}

        {/* 反映エラー */}
        {applyError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-1">
            <p className="text-sm font-bold text-red-700">反映エラー</p>
            <p className="text-sm text-red-600">{applyError}</p>
          </div>
        )}

        {/* 反映成功 */}
        {applySuccess && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-1">
            <p className="text-sm font-bold text-green-700">反映成功</p>
            <pre className="text-xs text-green-800 overflow-x-auto whitespace-pre-wrap max-h-40">
              {applySuccess}
            </pre>
          </div>
        )}

        {/* getAdminMaster エラー */}
        {verifyError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3">
            <p className="text-xs font-semibold text-red-700">getAdminMaster エラー</p>
            <p className="text-xs text-red-600 mt-0.5">{verifyError}</p>
          </div>
        )}

        {/* getAdminMaster 結果 */}
        {verifyResult !== null && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-3">
            <p className="text-sm font-bold text-blue-700">getAdminMaster 取得結果</p>

            {/* 集計 */}
            <div className="rounded-xl bg-white border border-blue-100 p-3 space-y-1.5 text-sm">
              <p>
                <span className="font-semibold text-gray-600">総件数:</span>{" "}
                <span className="font-bold text-gray-900">{verifyResult.total} 件</span>
              </p>
              <p>
                <span className="font-semibold text-gray-600">インフォマート由来 (ID 1〜9999):</span>{" "}
                <span className="font-bold text-blue-700">{verifyResult.infomart} 件</span>
              </p>
              <p>
                <span className="font-semibold text-gray-600">手動追加 (ID 10000+):</span>{" "}
                <span className={`font-bold ${verifyResult.mobile > 0 ? "text-green-700" : "text-gray-400"}`}>
                  {verifyResult.mobile} 件
                </span>
              </p>
              {verifyResult.other > 0 && (
                <p>
                  <span className="font-semibold text-gray-600">その他/不明:</span>{" "}
                  <span className="font-bold text-amber-600">{verifyResult.other} 件</span>
                </p>
              )}
              <p>
                <span className="font-semibold text-gray-600">ID範囲:</span>{" "}
                <span className="font-mono text-gray-800">{verifyResult.minId} 〜 {verifyResult.maxId}</span>
              </p>
              <p>
                <span className="font-semibold text-gray-600">商品名あり:</span>{" "}
                <span className="text-gray-800">{verifyResult.withName} 件</span>
              </p>
            </div>

            {/* 先頭3件 */}
            {verifyResult.head3.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-blue-600 mb-1">先頭 {verifyResult.head3.length} 件</p>
                <pre className="text-[10px] text-blue-900 bg-white rounded-xl p-2 overflow-x-auto whitespace-pre-wrap max-h-40 border border-blue-100">
                  {JSON.stringify(verifyResult.head3, null, 2)}
                </pre>
              </div>
            )}

            {/* 末尾3件 */}
            {verifyResult.tail3.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-blue-600 mb-1">末尾 {verifyResult.tail3.length} 件</p>
                <pre className="text-[10px] text-blue-900 bg-white rounded-xl p-2 overflow-x-auto whitespace-pre-wrap max-h-40 border border-blue-100">
                  {JSON.stringify(verifyResult.tail3, null, 2)}
                </pre>
              </div>
            )}

            {/* rawが setData を見つけられなかった場合のフォールバック */}
            {extractSetData(verifyResult.raw) === null && (
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-1">
                  ⚠️ setData を自動検出できませんでした。生レスポンス:
                </p>
                <pre className="text-[10px] text-gray-700 bg-white rounded-xl p-2 overflow-x-auto whitespace-pre-wrap max-h-48 border border-amber-100">
                  {JSON.stringify(verifyResult.raw, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => { if (!applying) setShowConfirm(false); }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-base font-bold text-red-600">⚠️ レシプロマスタを更新します</p>
              <p className="text-sm text-gray-700 mt-2">
                以下の設定でレシプロの食材マスタを<strong>上書き更新</strong>します。
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-3 space-y-1.5 text-sm">
              <p>
                <span className="font-semibold text-gray-500">customerID:</span>{" "}
                <span className="font-mono text-gray-900">{customerID}</span>
              </p>
              <p>
                <span className="font-semibold text-gray-500">storeID:</span>{" "}
                <span className="font-mono text-gray-900">{storeID}</span>
              </p>
              <p>
                <span className="font-semibold text-gray-500">件数:</span>{" "}
                <span className="font-bold text-gray-900">{parseResult?.total}件</span>
              </p>
            </div>

            {/* 先頭1件のsetDataをプレビュー（appendIrisuCr 適用後） */}
            {parseResult?.setData[0] && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  送信予定 setData[0]（先頭1件・[$入数]\r{appendIrisuCr ? "付加あり" : "なし"}）
                </p>
                <pre className="text-[10px] text-gray-700 bg-gray-50 rounded-xl p-2 overflow-x-auto whitespace-pre-wrap max-h-36 border border-gray-200">
                  {JSON.stringify(
                    appendIrisuCr
                      ? { ...parseResult.setData[0], "［入数］": parseResult.setData[0]["［入数］"] + "\r" }
                      : parseResult.setData[0],
                    null,
                    2
                  )}
                </pre>
              </div>
            )}

            <p className="text-xs text-red-500">
              この操作はレシプロのマスタデータに直接影響します。元に戻せません。
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={applying}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#E85D2C" }}
              >
                {applying && (
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                {applying ? "送信中..." : "反映する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
