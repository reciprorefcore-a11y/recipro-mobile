"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getIngredients } from "@/lib/firestore";
import OrderItemRow from "@/components/OrderItemRow";
import type { Ingredient } from "@/types";

const DRAFT_KEY = "recipro_order_draft";

export type OrderDraft = {
  supplierId: string;
  supplierName: string;
  quantities: Record<string, number>; // ingredientId -> quantity
  deliveryDate: string;
  generalNote: string;
};

export default function OrderInputPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const supplierId = params.supplierId as string;
  const supplierName = decodeURIComponent(supplierId);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getIngredients(user.uid)
      .then((all) => {
        const filtered = all.filter(
          (i) => i.isActive && i.supplier === supplierName
        );
        setIngredients(filtered);

        // 下書き復元
        try {
          const raw = sessionStorage.getItem(DRAFT_KEY);
          if (raw) {
            const draft: OrderDraft = JSON.parse(raw);
            if (draft.supplierId === supplierId) {
              setQuantities(draft.quantities ?? {});
            }
          }
        } catch {
          // ignore
        }
      })
      .finally(() => setLoading(false));
  }, [user, supplierId, supplierName]);

  const filtered = useMemo(() => {
    let list = ingredients;
    if (showOnlySelected) {
      list = list.filter((i) => (quantities[i.id] ?? 0) > 0);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.ingredientName.toLowerCase().includes(q) ||
          (i.myCatalogId ?? "").includes(q)
      );
    }
    return list;
  }, [ingredients, quantities, searchQuery, showOnlySelected]);

  const selectedCount = Object.values(quantities).filter((q) => q > 0).length;

  const handleChange = (ingredientId: string, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [ingredientId]: quantity }));
  };

  const saveDraftAndNavigate = (path: string) => {
    const draft: OrderDraft = {
      supplierId,
      supplierName,
      quantities,
      deliveryDate: "today",
      generalNote: "",
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    router.push(path);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        読み込み中...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] flex flex-col" style={{ paddingBottom: 80 }}>
        {/* ヘッダー */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/order")}
              className="flex items-center gap-1 text-gray-500 font-medium text-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-arrow-right.svg" alt="" width={14} height={14}
                style={{ filter: "brightness(0) opacity(0.5)", transform: "rotate(180deg)" }} />
              戻る
            </button>
            <h1 className="font-bold text-gray-900 truncate">
              {supplierName} / 発注内容の入力
            </h1>
          </div>

          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-search.svg" alt="" width={16} height={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="食材名またはコードで検索"
              className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              全{ingredients.length}件
              {selectedCount > 0 && (
                <span className="ml-2 text-primary font-semibold">
                  ({selectedCount}品選択中)
                </span>
              )}
            </p>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlySelected}
                onChange={(e) => setShowOnlySelected(e.target.checked)}
                className="accent-primary"
              />
              選択のみ表示
            </label>
          </div>
        </div>

        {/* 食材リスト */}
        <div className="flex-1 bg-white">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">
              {showOnlySelected ? "選択中の食材がありません" : "該当する食材がありません"}
            </p>
          ) : (
            filtered.map((item) => (
              <OrderItemRow
                key={item.id}
                ingredientId={item.id}
                myCatalogId={item.myCatalogId}
                ingredientName={item.ingredientName}
                unit={item.unit}
                quantity={quantities[item.id] ?? 0}
                onChange={handleChange}
              />
            ))
          )}
        </div>

        {/* フッター */}
        <div
          className="fixed left-0 right-0 flex justify-center"
          style={{ bottom: "calc(60px + env(safe-area-inset-bottom, 0px))", zIndex: 110 }}
        >
          <div className="w-full max-w-[480px] bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
                  supplierId, supplierName, quantities, deliveryDate: "today", generalNote: "",
                }));
                router.push("/");
              }}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              一時保存して戻る
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => saveDraftAndNavigate(`/order/${supplierId}/confirm`)}
              className="flex-[2] py-3 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: selectedCount > 0 ? "#E85D2C" : "#9ca3af" }}
            >
              内容確認 ({selectedCount}品) →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
