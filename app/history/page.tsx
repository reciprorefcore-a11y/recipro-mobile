"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getRecentSnapshots,
  getOlderMonthlyReps,
  rollbackSnapshot,
  togglePinSnapshot,
  previewCleanup,
  executeCleanup,
} from "@/lib/ingredientSnapshot";
import type { CleanupPreview } from "@/lib/ingredientSnapshot";
import type { IngredientSnapshot } from "@/types";
import type { Timestamp } from "firebase/firestore";

function formatDate(ts: Timestamp): string {
  const d = ts.toDate();
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const companyId = user?.uid ?? "";

  const [snapshots, setSnapshots] = useState<IngredientSnapshot[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [olderReps, setOlderReps] = useState<IngredientSnapshot[]>([]);
  const [showOlder, setShowOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState("");

  // ピン留め
  const [pinningId, setPinningId] = useState<string | null>(null);

  // 整理
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number } | null>(null);

  const loadRecent = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { snapshots: data, hasMore: more } = await getRecentSnapshots(companyId);
      setSnapshots(data);
      setHasMore(more);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // ロールバック
  const handleRollback = async (snapshot: IngredientSnapshot) => {
    if (!companyId || rolling) return;
    setRolling(true);
    setError("");
    try {
      await rollbackSnapshot(companyId, snapshot);
      setSnapshots((prev) =>
        prev.map((s) => s.id === snapshot.id ? { ...s, status: "rolled_back" } : s)
      );
      setOlderReps((prev) =>
        prev.map((s) => s.id === snapshot.id ? { ...s, status: "rolled_back" } : s)
      );
      setConfirmId(null);
    } catch (err) {
      console.error(err);
      setError("ロールバックに失敗しました");
    } finally {
      setRolling(false);
    }
  };

  // ピン留め
  const handlePin = async (snap: IngredientSnapshot) => {
    if (!companyId || !user || pinningId) return;
    setPinningId(snap.id);
    const newPinned = !snap.pinned;
    try {
      await togglePinSnapshot(companyId, snap.id, newPinned, user.uid);
      const update = (s: IngredientSnapshot) =>
        s.id === snap.id ? { ...s, pinned: newPinned } : s;
      setSnapshots((prev) => prev.map(update));
      setOlderReps((prev) => prev.map(update));
    } catch (err) {
      console.error(err);
    } finally {
      setPinningId(null);
    }
  };

  // 古い履歴を展開
  const handleShowOlder = async () => {
    if (!companyId || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const reps = await getOlderMonthlyReps(companyId);
      setOlderReps(reps);
      setShowOlder(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // 整理プレビュー
  const handleCleanupPreview = async () => {
    if (!companyId || cleanupLoading) return;
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const preview = await previewCleanup(companyId);
      setCleanupPreview(preview);
    } catch (err) {
      console.error(err);
      setError("整理情報の取得に失敗しました");
    } finally {
      setCleanupLoading(false);
    }
  };

  // 整理実行
  const handleCleanupExecute = async () => {
    if (!companyId || !cleanupPreview || cleanupRunning) return;
    setCleanupRunning(true);
    try {
      const result = await executeCleanup(companyId);
      setCleanupPreview(null);
      setCleanupResult(result);
      // リロード
      await loadRecent();
      setShowOlder(false);
      setOlderReps([]);
    } catch (err) {
      console.error(err);
      setError("整理の実行に失敗しました");
    } finally {
      setCleanupRunning(false);
    }
  };

  const confirmSnapshot = snapshots.find((s) => s.id === confirmId) ??
    olderReps.find((s) => s.id === confirmId);

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">履歴</h1>
          <p className="text-sm text-gray-400 mt-0.5">スナップショット・ロールバック</p>
        </div>

        {cleanupResult && (
          <div className="bg-green-50 rounded-2xl p-4">
            <p className="text-sm font-bold text-green-800">✅ 整理完了</p>
            <p className="text-sm text-green-700 mt-1">{cleanupResult.deleted}件の古い履歴を削除しました</p>
            <button
              type="button"
              onClick={() => setCleanupResult(null)}
              className="mt-2 text-xs text-green-600 underline"
            >
              閉じる
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : snapshots.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-sm text-gray-400">まだ送信履歴がありません。</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {snapshots.map((snap) => (
                <SnapshotCard
                  key={snap.id}
                  snapshot={snap}
                  expanded={expandedId === snap.id}
                  pinning={pinningId === snap.id}
                  onToggleExpand={() =>
                    setExpandedId((prev) => (prev === snap.id ? null : snap.id))
                  }
                  onRollback={() => setConfirmId(snap.id)}
                  onPin={() => handlePin(snap)}
                />
              ))}
            </div>

            {/* もっと古い履歴 */}
            {hasMore && !showOlder && (
              <button
                type="button"
                onClick={handleShowOlder}
                disabled={loadingOlder}
                className="w-full py-3 text-sm text-gray-500 border border-dashed border-gray-200 rounded-2xl hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                {loadingOlder ? "読み込み中..." : "▼ もっと古い履歴を見る（月別代表）"}
              </button>
            )}

            {showOlder && olderReps.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-xs text-gray-400 shrink-0">月別代表（各月の最古）</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
                <div className="space-y-3">
                  {olderReps.map((snap) => (
                    <SnapshotCard
                      key={snap.id}
                      snapshot={snap}
                      expanded={expandedId === snap.id}
                      pinning={pinningId === snap.id}
                      onToggleExpand={() =>
                        setExpandedId((prev) => (prev === snap.id ? null : snap.id))
                      }
                      onRollback={() => setConfirmId(snap.id)}
                      onPin={() => handlePin(snap)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowOlder(false)}
                  className="w-full py-2 text-xs text-gray-400 hover:text-gray-600"
                >
                  ▲ 閉じる
                </button>
              </>
            )}

            {showOlder && olderReps.length === 0 && (
              <p className="text-xs text-center text-gray-400 py-2">
                21件目以降の履歴はありません
              </p>
            )}

            {/* 整理ボタン */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCleanupPreview}
                disabled={cleanupLoading}
                className="w-full py-3 text-sm text-gray-500 border border-gray-200 rounded-2xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {cleanupLoading ? "確認中..." : "🗑 古い履歴を整理する"}
              </button>
              <p className="text-xs text-center text-gray-300 mt-1.5">
                直近20件・月別代表・ピン留めは保持されます
              </p>
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>
        )}
      </div>

      {/* ロールバック確認モーダル */}
      {confirmSnapshot && (
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
          onClick={() => setConfirmId(null)}
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
            <h2 className="text-base font-bold text-gray-900">ロールバックの確認</h2>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">「{confirmSnapshot.description}」</span>
              の時点に戻します。
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700">変更される内容</p>
              <ul className="text-xs text-amber-700 space-y-0.5">
                {confirmSnapshot.items.filter((i) => !i.isNew).length > 0 && (
                  <li>・単価更新を元に戻す ({confirmSnapshot.items.filter((i) => !i.isNew).length}件)</li>
                )}
                {confirmSnapshot.items.filter((i) => i.isNew).length > 0 && (
                  <li>・新規追加した食材を無効化 ({confirmSnapshot.items.filter((i) => i.isNew).length}件)</li>
                )}
              </ul>
            </div>
            <p className="text-xs text-gray-500">この操作は取り消せません。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                disabled={rolling}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleRollback(confirmSnapshot)}
                disabled={rolling}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50"
              >
                {rolling ? "処理中..." : "ロールバック実行"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 整理プレビューモーダル */}
      {cleanupPreview && (
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
          onClick={() => !cleanupRunning && setCleanupPreview(null)}
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
            <h2 className="text-base font-bold text-gray-900">🗑 古い履歴を整理する</h2>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">保持される履歴</span>
                <span className="font-bold text-gray-800">{cleanupPreview.keepCount}件</span>
              </div>
              <p className="text-xs text-gray-400">（直近20件 ＋ 月別代表 ＋ ピン留め）</p>
              <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
                <span className="text-red-500">削除される履歴</span>
                <span className="font-bold text-red-600">{cleanupPreview.deleteCount}件</span>
              </div>
            </div>

            {cleanupPreview.deleteCount === 0 ? (
              <p className="text-sm text-center text-gray-500 py-2">
                整理対象の履歴はありません
              </p>
            ) : (
              <>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {cleanupPreview.deleteItems.slice(0, 30).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs text-gray-500 py-1 border-b border-gray-50">
                      <span className="truncate flex-1">{item.description}</span>
                      <span className="shrink-0 ml-2 text-gray-400">
                        {item.createdAt?.toDate
                          ? `${item.createdAt.toDate().getMonth() + 1}/${item.createdAt.toDate().getDate()}`
                          : ""}
                      </span>
                    </div>
                  ))}
                  {cleanupPreview.deleteItems.length > 30 && (
                    <p className="text-xs text-gray-400 text-center pt-1">
                      他 {cleanupPreview.deleteItems.length - 30}件
                    </p>
                  )}
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-xs text-amber-700">削除した履歴は元に戻せません。ピン留めした履歴は削除されません。</p>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setCleanupPreview(null)}
                disabled={cleanupRunning}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 disabled:opacity-50"
              >
                キャンセル
              </button>
              {cleanupPreview.deleteCount > 0 && (
                <button
                  onClick={handleCleanupExecute}
                  disabled={cleanupRunning}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-500 disabled:opacity-50"
                >
                  {cleanupRunning ? "削除中..." : `${cleanupPreview.deleteCount}件を削除`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SnapshotCard({
  snapshot,
  expanded,
  pinning,
  onToggleExpand,
  onRollback,
  onPin,
}: {
  snapshot: IngredientSnapshot;
  expanded: boolean;
  pinning: boolean;
  onToggleExpand: () => void;
  onRollback: () => void;
  onPin: () => void;
}) {
  const ts = snapshot.createdAt as Timestamp | null | undefined;
  const date = ts?.toDate?.() ? formatDate(ts as Timestamp) : "—";
  const updateCount = snapshot.items.filter((i) => !i.isNew).length;
  const newCount = snapshot.items.filter((i) => i.isNew).length;
  const isBeforeImport = snapshot.type === "before-import";

  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${snapshot.pinned ? "ring-1 ring-amber-300" : ""}`}>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {snapshot.pinned && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  📌 ピン留め
                </span>
              )}
              {isBeforeImport && (
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                  取り込み前
                </span>
              )}
            </div>
            <p className="font-semibold text-gray-900 truncate mt-0.5">{snapshot.description}</p>
            <p className="text-xs text-gray-400 mt-0.5">{date}</p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* ピン留めボタン */}
            <button
              type="button"
              onClick={onPin}
              disabled={pinning}
              title={snapshot.pinned ? "ピン留めを解除" : "ピン留め"}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                snapshot.pinned
                  ? "bg-amber-50 text-amber-500"
                  : "bg-gray-100 text-gray-400 hover:bg-amber-50 hover:text-amber-400"
              }`}
            >
              {pinning ? (
                <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <span className="text-sm">📌</span>
              )}
            </button>

            {/* ロールバックボタン */}
            {snapshot.status === "rolled_back" ? (
              <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                ✓ 済み
              </span>
            ) : (
              <button
                onClick={onRollback}
                className="text-xs font-bold text-red-600 border border-red-200 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
              >
                元に戻す
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {updateCount > 0 && (
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
              {updateCount}件更新
            </span>
          )}
          {newCount > 0 && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {newCount}件新規
            </span>
          )}
          {snapshot.items.length > 0 && (
            <button
              onClick={onToggleExpand}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600"
            >
              {expanded ? "▲ 閉じる" : "▼ 詳細"}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {snapshot.items.map((item, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.ingredientName}</p>
                {item.supplier && <p className="text-xs text-gray-400">{item.supplier}</p>}
              </div>
              {item.isNew ? (
                <span className="shrink-0 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  新規 {item.newPrice.toLocaleString()}円
                </span>
              ) : (
                <span className="shrink-0 text-xs text-gray-600">
                  {item.oldPrice.toLocaleString()} → {item.newPrice.toLocaleString()}円
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
