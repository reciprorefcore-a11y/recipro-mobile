"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  getPendingIngredients,
  deletePendingIngredient,
  promotePendingIngredient,
} from "@/lib/firestore";
import type { PendingIngredient } from "@/types";

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export default function NewIngredientsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<PendingIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    getPendingIngredients(user.uid)
      .then(setItems)
      .catch(() => setError("読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, [user]);

  const handleDownload = async () => {
    if (!user) return;
    setDownloading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/csv/new-ingredients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("CSV生成に失敗しました");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `新規食材_${todayString()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deletePendingIngredient(user.uid, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError("削除に失敗しました");
    }
  };

  return (
    <main className="min-h-screen bg-bg flex justify-center pb-20">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/menu"
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 font-medium text-sm"
          >
            ← 戻る
          </Link>
          <h1 className="text-xl font-bold text-text">新規食材リスト</h1>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
          <p className="text-sm font-semibold text-amber-800">
            レシプロ本体での登録が必要な食材
          </p>
          <p className="text-xs text-amber-700">
            レシプロ管理画面で登録後、マイカタログIDを入力してください。
          </p>
        </div>

        {loading ? (
          <p className="text-center text-sm text-muted py-8">読み込み中...</p>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-sub-text">
              未登録の食材はありません
            </p>
            <p className="text-xs text-muted">
              伝票解析で新規食材が検出されると、ここに表示されます。
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-sub-text">{items.length}件の未登録食材</p>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="text-sm font-semibold px-4 py-2 rounded-xl border transition-colors disabled:opacity-50"
                style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
              >
                {downloading ? "生成中..." : "CSVエクスポート"}
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <PendingItemCard
                  key={item.id}
                  item={item}
                  companyId={user?.uid ?? ""}
                  onPromoted={(id) =>
                    setItems((prev) => prev.filter((i) => i.id !== id))
                  }
                  onDeleted={handleDelete}
                />
              ))}
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>
        )}
      </div>
    </main>
  );
}

// ─── PendingItemCard ──────────────────────────────────────

function PendingItemCard({
  item,
  companyId,
  onPromoted,
  onDeleted,
}: {
  item: PendingIngredient;
  companyId: string;
  onPromoted: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [inputMode, setInputMode] = useState(false);
  const [catalogId, setCatalogId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handlePromote = async () => {
    const trimmed = catalogId.trim();
    if (!trimmed) { setError("マイカタログIDを入力してください"); return; }
    setSaving(true);
    setError("");
    try {
      await promotePendingIngredient(companyId, item.id, trimmed);
      onPromoted(item.id);
    } catch {
      setError("登録に失敗しました");
      setSaving(false);
    }
  };

  return (
    <article className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text truncate">{item.ingredientName}</p>
          <p className="text-xs text-sub-text mt-0.5">
            {item.unit} ・ {item.currentPrice.toLocaleString()}円
            {item.supplier ? ` ・ ${item.supplier}` : ""}
          </p>
        </div>
        <button
          onClick={() => onDeleted(item.id)}
          className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
        >
          削除
        </button>
      </div>

      {!inputMode ? (
        <button
          onClick={() => setInputMode(true)}
          className="w-full py-2.5 rounded-xl border border-dashed text-sm font-medium transition-colors hover:bg-gray-50"
          style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
        >
          マイカタログID入力
        </button>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-600">
            マイカタログID
          </label>
          <input
            type="text"
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
            placeholder="例: 12345"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2"
            style={{ ["--tw-ring-color" as string]: "#E85D2C" }}
            autoFocus
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setInputMode(false); setCatalogId(""); setError(""); }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-sub-text"
            >
              キャンセル
            </button>
            <button
              onClick={handlePromote}
              disabled={saving || !catalogId.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: "#E85D2C" }}
            >
              {saving ? "登録中..." : "食材マスタへ登録"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
