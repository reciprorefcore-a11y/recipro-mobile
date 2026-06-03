"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getRecentSnapshots, rollbackSnapshot } from "@/lib/ingredientSnapshot";
import type { IngredientSnapshot } from "@/types";
import type { Timestamp } from "firebase/firestore";

function formatDate(ts: Timestamp): string {
  const d = ts.toDate();
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<IngredientSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState("");

  const companyId = user?.uid ?? "";

  useEffect(() => {
    if (!companyId) return;
    let ignore = false;
    getRecentSnapshots(companyId)
      .then((data) => { if (!ignore) setSnapshots(data); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [companyId]);

  const handleRollback = async (snapshot: IngredientSnapshot) => {
    if (!companyId || rolling) return;
    setRolling(true);
    setError("");
    try {
      await rollbackSnapshot(companyId, snapshot);
      setSnapshots((prev) =>
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

  const confirmSnapshot = snapshots.find((s) => s.id === confirmId);

  return (
    <main className="min-h-screen bg-bg flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-text">履歴</h1>
        <p className="text-sm text-sub-text">CSV送信履歴・ロールバック</p>

        {loading ? (
          <p className="text-center text-sm text-muted py-8">読み込み中...</p>
        ) : snapshots.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-sm text-sub-text">まだ送信履歴がありません。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {snapshots.map((snap) => (
              <SnapshotCard
                key={snap.id}
                snapshot={snap}
                expanded={expandedId === snap.id}
                onToggleExpand={() =>
                  setExpandedId((prev) => (prev === snap.id ? null : snap.id))
                }
                onRollback={() => setConfirmId(snap.id)}
              />
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>
        )}
      </div>

      {confirmSnapshot && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-[480px] bg-white rounded-t-2xl p-6 space-y-4 pb-8">
            <h2 className="text-base font-bold text-text">ロールバックの確認</h2>
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
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-sub-text hover:bg-gray-50 disabled:opacity-50"
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
    </main>
  );
}

function SnapshotCard({
  snapshot,
  expanded,
  onToggleExpand,
  onRollback,
}: {
  snapshot: IngredientSnapshot;
  expanded: boolean;
  onToggleExpand: () => void;
  onRollback: () => void;
}) {
  const ts = snapshot.createdAt as Timestamp;
  const date = ts?.toDate() ? formatDate(ts) : "—";
  const updateCount = snapshot.items.filter((i) => !i.isNew).length;
  const newCount = snapshot.items.filter((i) => i.isNew).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text truncate">{snapshot.description}</p>
            <p className="text-xs text-muted mt-0.5">{date}</p>
          </div>
          {snapshot.status === "rolled_back" ? (
            <span className="shrink-0 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              ✓ ロールバック済み
            </span>
          ) : (
            <button
              onClick={onRollback}
              className="shrink-0 text-xs font-bold text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              前回のデータに戻す
            </button>
          )}
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
          <button
            onClick={onToggleExpand}
            className="ml-auto text-xs text-sub-text hover:text-text"
          >
            {expanded ? "▲ 閉じる" : "▼ 詳細"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {snapshot.items.map((item, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{item.ingredientName}</p>
                {item.supplier && <p className="text-xs text-muted">{item.supplier}</p>}
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
