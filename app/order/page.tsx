"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getIngredients } from "@/lib/firestore";

const DRAFT_KEY = "recipro_order_draft";

type SupplierSummary = {
  name: string;
  count: number;
};

type DraftInfo = {
  supplierName: string;
  supplierId: string;
  itemCount: number;
};

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[ァ-ン]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[ぁ-ん]/g, (c) => c);
}

export default function OrderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<DraftInfo | null>(null);

  useEffect(() => {
    if (!user) return;
    getIngredients(user.uid)
      .then((ingredients) => {
        const map = new Map<string, number>();
        for (const ing of ingredients) {
          if (ing.supplier && ing.isActive) {
            map.set(ing.supplier, (map.get(ing.supplier) ?? 0) + 1);
          }
        }
        const list = [...map.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));
        setSuppliers(list);
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { supplierName?: string; supplierId?: string; quantities?: Record<string, number> };
      if (!d.supplierName || !d.supplierId) return;
      const itemCount = Object.values(d.quantities ?? {}).filter((q) => q > 0).length;
      if (itemCount === 0) return;
      setDraft({ supplierName: d.supplierName, supplierId: d.supplierId, itemCount });
    } catch {
      // ignore
    }
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = normalize(search.trim());
    return suppliers.filter((s) => normalize(s.name).includes(q));
  }, [suppliers, search]);

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4" style={{ paddingBottom: 100 }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 font-medium"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-arrow-right.svg" alt="" width={16} height={16}
              style={{ filter: "brightness(0) opacity(0.5)", transform: "rotate(180deg)" }} />
            戻る
          </button>
          <h1 className="text-xl font-bold">発注先を選択</h1>
        </div>

        {/* 発注履歴から再発注 */}
        <button
          type="button"
          onClick={() => router.push("/order/history")}
          className="w-full rounded-2xl p-4 flex items-center justify-between shadow-sm transition-opacity active:opacity-80"
          style={{ backgroundColor: "#E85D2C" }}
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-history.svg" alt="" width={28} height={28}
              style={{ filter: "brightness(0) invert(1)" }} />
            <div className="text-left">
              <div className="font-bold text-base text-white">発注履歴から再発注</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>過去の発注内容を再利用</div>
            </div>
          </div>
          <span className="text-white text-lg">→</span>
        </button>

        {/* 一時保存から発注 */}
        {draft && (
          <button
            type="button"
            onClick={() => router.push(`/order/${draft.supplierId}`)}
            className="w-full rounded-2xl p-4 flex items-center justify-between shadow-sm transition-opacity active:opacity-80"
            style={{ backgroundColor: "#10B981" }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">💾</span>
              <div className="text-left">
                <div className="font-bold text-base text-white">
                  一時保存から発注 ({draft.itemCount})
                </div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>
                  {draft.supplierName} — 保存中の発注を確定する
                </div>
              </div>
            </div>
            <span className="text-white text-lg">→</span>
          </button>
        )}

        <div className="h-px bg-gray-200" />

        {/* 検索 */}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-search.svg" alt="" width={16} height={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="取引先名で検索..."
            className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-gray-500 text-sm">取引先が設定された食材がありません</p>
            <Link href="/search" className="text-primary underline text-sm">
              食材に仕入先を設定する →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">
                「{search}」に一致する取引先がありません
              </p>
            ) : (
              filtered.map((s) => (
                <Link
                  key={s.name}
                  href={`/order/${encodeURIComponent(s.name)}`}
                  className="block bg-white rounded-xl shadow-sm p-4 hover:bg-orange-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">食材: {s.count}件</p>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/icon-arrow-right.svg" alt="" width={16} height={16}
                      style={{ filter: "brightness(0) opacity(0.3)" }} />
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
