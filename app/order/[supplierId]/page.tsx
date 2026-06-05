"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getIngredients } from "@/lib/firestore";
import type { Ingredient } from "@/types";

const DRAFT_KEY = "recipro_order_draft";

export type OrderDraft = {
  supplierId: string;
  supplierName: string;
  quantities: Record<string, number>;
  deliveryDate: string;
  generalNote: string;
};

type OrderItem = {
  ingredient: Ingredient;
  quantity: number;
};

export default function OrderInputPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const supplierId = params.supplierId as string;
  const supplierName = decodeURIComponent(supplierId);

  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    getIngredients(user.uid)
      .then((all) => {
        const filtered = all.filter((i) => i.isActive && i.supplier === supplierName);
        setAllIngredients(filtered);

        try {
          const raw = sessionStorage.getItem(DRAFT_KEY);
          if (raw) {
            const draft: OrderDraft = JSON.parse(raw);
            if (draft.supplierId === supplierId) {
              const items: OrderItem[] = [];
              for (const [id, qty] of Object.entries(draft.quantities)) {
                if (qty > 0) {
                  const ing = filtered.find((i) => i.id === id);
                  if (ing) items.push({ ingredient: ing, quantity: qty });
                }
              }
              setOrderItems(items);
            }
          }
        } catch {
          // ignore
        }
      })
      .finally(() => setLoading(false));
  }, [user, supplierId, supplierName]);

  const addedIds = useMemo(() => new Set(orderItems.map((o) => o.ingredient.id)), [orderItems]);

  const modalFiltered = useMemo(() => {
    if (!modalSearch) return allIngredients;
    const q = modalSearch.toLowerCase();
    return allIngredients.filter(
      (i) =>
        i.ingredientName.toLowerCase().includes(q) ||
        (i.ingredientNameKana ?? "").toLowerCase().includes(q)
    );
  }, [allIngredients, modalSearch]);

  const addItem = (ingredient: Ingredient) => {
    if (addedIds.has(ingredient.id)) return;
    setOrderItems((prev) => [...prev, { ingredient, quantity: 1 }]);
  };

  const removeItem = (id: string) => {
    setOrderItems((prev) => prev.filter((o) => o.ingredient.id !== id));
  };

  const updateQty = (id: string, qty: number) => {
    const v = Math.max(0, qty);
    if (v === 0) {
      removeItem(id);
    } else {
      setOrderItems((prev) =>
        prev.map((o) => (o.ingredient.id === id ? { ...o, quantity: v } : o))
      );
    }
  };

  const selectedCount = orderItems.filter((o) => o.quantity > 0).length;

  const buildDraft = (): OrderDraft => {
    const quantities: Record<string, number> = {};
    for (const { ingredient, quantity } of orderItems) {
      if (quantity > 0) quantities[ingredient.id] = quantity;
    }
    return { supplierId, supplierName, quantities, deliveryDate: "today", generalNote: "" };
  };

  const saveDraftAndNavigate = (path: string) => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(buildDraft()));
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
      <div className="w-full max-w-[480px] flex flex-col" style={{ paddingBottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 72px)" }}>

        {/* ヘッダー */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
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
        </div>

        {/* 発注リスト */}
        <div className="flex-1 px-4 py-4 space-y-3">
          <p className="text-sm text-gray-500">全{orderItems.length}件</p>

          {orderItems.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">
              商品を追加してください
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
              {orderItems.map(({ ingredient, quantity }) => (
                <div key={ingredient.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {ingredient.ingredientName}
                    </p>
                    {ingredient.spec && (
                      <p className="text-xs text-gray-400 truncate">{ingredient.spec}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQty(ingredient.id, quantity - 1)}
                      className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 text-lg font-bold"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        updateQty(ingredient.id, Number.isFinite(v) ? v : 1);
                      }}
                      min={1}
                      className="w-12 text-center text-base font-bold border-b-2 border-gray-300 focus:border-primary outline-none"
                      style={{ color: "#E85D2C" }}
                    />
                    <button
                      type="button"
                      onClick={() => updateQty(ingredient.id, quantity + 1)}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-lg font-bold"
                      style={{ backgroundColor: "#E85D2C" }}
                    >
                      ＋
                    </button>
                    <span className="text-sm text-gray-500 w-5">{ingredient.unit}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(ingredient.id)}
                      className="ml-1 text-gray-300 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 商品を追加ボタン */}
          <button
            type="button"
            onClick={() => { setModalSearch(""); setShowModal(true); }}
            className="w-full py-3 rounded-xl border-2 border-dashed font-semibold text-sm transition-colors hover:bg-orange-50"
            style={{ borderColor: "#E85D2C", color: "#E85D2C" }}
          >
            ＋ 商品を追加
          </button>
        </div>

        {/* 下部固定フッター */}
        <div
          className="fixed left-0 right-0 flex justify-center"
          style={{ bottom: "calc(60px + env(safe-area-inset-bottom, 0px))", zIndex: 110 }}
        >
          <div className="w-full max-w-[480px] bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem(DRAFT_KEY, JSON.stringify(buildDraft()));
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

      {/* 商品追加モーダル */}
      {showModal && (
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
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              backgroundColor: "#fff",
              borderRadius: "20px 20px 0 0",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">商品を追加</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* 検索 */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/icon-search.svg" alt="" width={16} height={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="食材名で検索..."
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* 食材一覧 */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {modalFiltered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  {allIngredients.length === 0 ? "食材が登録されていません" : "該当する食材がありません"}
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {modalFiltered.map((item) => {
                    const already = addedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.ingredientName}
                          </p>
                          <p className="text-xs text-gray-400">
                            ¥{item.currentPrice.toLocaleString()} / {item.unit}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { addItem(item); }}
                          disabled={already}
                          className="shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40"
                          style={{
                            backgroundColor: already ? "#f3f4f6" : "#E85D2C",
                            color: already ? "#9ca3af" : "#fff",
                          }}
                        >
                          {already ? "追加済" : "追加"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
