"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getRecentPriceHistory } from "@/lib/firestore";
import type { PriceHistory } from "@/types";
import type { Timestamp } from "firebase/firestore";

function formatDate(ts: Timestamp): string {
  const d = ts.toDate();
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function SourceBadge({ source }: { source?: string }) {
  if (source === "receipt_ai") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-primary-light text-primary font-medium">
        AI読取
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-sub-text font-medium">
      手入力
    </span>
  );
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let ignore = false;
    getRecentPriceHistory(user.uid)
      .then((data) => { if (!ignore) setHistory(data); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [user]);

  return (
    <main className="min-h-screen bg-bg flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-text">履歴</h1>
        <p className="text-sm text-sub-text">直近30日の価格更新履歴</p>

        {loading ? (
          <p className="text-center text-sm text-muted py-8">読み込み中...</p>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-sm text-sub-text">
              まだ価格更新の履歴がありません。
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text truncate">
                    {record.ingredientName}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {record.recordedAt
                      ? formatDate(record.recordedAt as Timestamp)
                      : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <SourceBadge source={record.source} />
                  <p className="font-bold text-text">
                    {record.price.toLocaleString()}円
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
