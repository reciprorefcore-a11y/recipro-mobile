"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getReciproSettings } from "@/lib/firestore";
import { getChangeLogs, type MasterChangeLog } from "@/lib/masterChangeLog";

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

export default function ChangeLogsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [customerID, setCustomerID] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [logs, setLogs] = useState<MasterChangeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<"updated" | "new">("updated");

  const companyId = user?.uid ?? "";

  useEffect(() => {
    if (!companyId) return;
    getReciproSettings(companyId)
      .then((s) => { if (s?.customerID) setCustomerID(s.customerID); })
      .catch(console.error)
      .finally(() => setSettingsLoading(false));
  }, [companyId]);

  const handleLoad = async () => {
    if (!customerID.trim()) return;
    setLoading(true);
    setLoadError("");
    setLogs([]);
    setExpandedId(null);
    try {
      const entries = await getChangeLogs(customerID.trim());
      setLogs(entries);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "取得に失敗しました";
      setLoadError(msg);
      console.error("[getChangeLogs]", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const expandedLog = logs.find((l) => l.id === expandedId);

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[700px] px-4 py-6 space-y-4">

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none">‹</button>
          <h1 className="text-xl font-bold text-gray-900">マスタ変更ログ</h1>
        </div>

        {/* 検索フォーム */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="font-bold text-gray-900">対象 customerID</h2>
          {settingsLoading ? (
            <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={customerID}
                onChange={(e) => setCustomerID(e.target.value)}
                placeholder="customerID"
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 font-mono"
              />
              <button
                type="button"
                onClick={handleLoad}
                disabled={loading || !customerID.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: "#E85D2C" }}
              >
                {loading ? "取得中..." : "読み込む"}
              </button>
            </div>
          )}
          {loadError && (
            <p className="text-xs text-red-500">{loadError}</p>
          )}
        </div>

        {/* ログ一覧テーブル */}
        {logs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">最新 {logs.length} 件</h2>
              <p className="text-xs text-gray-400">行をクリックで詳細展開</p>
            </div>

            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">日時</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">ソース</th>
                    <th className="px-3 py-2 text-center text-gray-500 font-medium whitespace-nowrap">新規</th>
                    <th className="px-3 py-2 text-center text-gray-500 font-medium whitespace-nowrap">更新</th>
                    <th className="px-3 py-2 text-center text-gray-500 font-medium whitespace-nowrap">不変</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">実行者</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        onClick={() => {
                          setExpandedId((prev) => (prev === log.id ? null : log.id));
                          setExpandedTab("updated");
                        }}
                        className={`border-t border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${expandedId === log.id ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                          {formatDate(log.createdAtIso)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            log.source === "ocr-import"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {log.source}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-green-700">
                          {log.summary.newCount}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-orange-600">
                          {log.summary.updatedCount}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-400">
                          {log.summary.unchangedCount}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 truncate max-w-[120px]">
                          {log.triggerUserEmail ?? "—"}
                        </td>
                      </tr>

                      {/* 詳細展開行 */}
                      {expandedId === log.id && expandedLog && (
                        <tr key={`${log.id}-detail`} className="border-t border-blue-100 bg-blue-50/60">
                          <td colSpan={6} className="px-3 py-3">
                            <div className="space-y-2">
                              {/* メタ情報 */}
                              <div className="text-[10px] text-gray-500 space-x-3">
                                <span>storeID: <span className="font-mono">{expandedLog.storeID}</span></span>
                                {expandedLog.reciproAdminEmail && (
                                  <span>Recipro: {expandedLog.reciproAdminEmail}</span>
                                )}
                              </div>

                              {/* タブ */}
                              <div className="flex gap-1">
                                {(["updated", "new"] as const).map((tab) => {
                                  const count = tab === "updated"
                                    ? expandedLog.changes.filter((c) => c.type === "updated").length
                                    : expandedLog.changes.filter((c) => c.type === "new").length;
                                  return (
                                    <button
                                      key={tab}
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setExpandedTab(tab); }}
                                      className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                                        expandedTab === tab
                                          ? "bg-blue-600 text-white"
                                          : "bg-white text-blue-700 border border-blue-200"
                                      }`}
                                    >
                                      {tab === "updated" ? `更新 (${count})` : `新規 (${count})`}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* タブコンテンツ */}
                              <div className="bg-white rounded-xl border border-blue-100 p-2 max-h-64 overflow-y-auto">
                                {expandedTab === "updated" && (() => {
                                  const items = expandedLog.changes.filter((c) => c.type === "updated");
                                  return items.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-3">更新なし</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {items.map((item) => (
                                        <div key={item.id} className="border border-gray-100 rounded-lg p-2">
                                          <p className="text-[10px] font-semibold text-gray-700 mb-1">
                                            ID: {item.id} — {item.productName}
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
                                  );
                                })()}

                                {expandedTab === "new" && (() => {
                                  const items = expandedLog.changes.filter((c) => c.type === "new");
                                  return items.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-3">新規なし</p>
                                  ) : (
                                    <table className="text-[10px] w-full">
                                      <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                          <th className="px-1 py-1 text-left text-gray-500">ID</th>
                                          <th className="px-1 py-1 text-left text-gray-500">商品名</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {items.map((item) => (
                                          <tr key={item.id} className="border-t border-gray-100">
                                            <td className="px-1 py-1 text-gray-500 font-mono">{item.id}</td>
                                            <td className="px-1 py-1 text-gray-900">{item.productName}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  );
                                })()}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && logs.length === 0 && !loadError && customerID.trim() && (
          <p className="text-sm text-gray-400 text-center py-4">
            ログが見つかりません（まだ反映が実行されていないか、customerID が異なります）
          </p>
        )}
      </div>
    </main>
  );
}
