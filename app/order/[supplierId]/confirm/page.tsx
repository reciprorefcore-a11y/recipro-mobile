"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getIngredients } from "@/lib/firestore";
import type { OrderDraft } from "../page";
import type { OrderItem } from "@/types";

const DRAFT_KEY = "recipro_order_draft";

const DELIVERY_OPTIONS = [
  { value: "today", label: "今日" },
  { value: "tomorrow", label: "明日" },
  { value: "asap", label: "入荷次第" },
] as const;

export default function OrderConfirmPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const supplierId = params.supplierId as string;
  const supplierName = decodeURIComponent(supplierId);

  const [items, setItems] = useState<OrderItem[]>([]);
  const [deliveryDate, setDeliveryDate] = useState("today");
  const [customDate, setCustomDate] = useState("");
  const [generalNote, setGeneralNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) { router.replace(`/order/${supplierId}`); return; }
      const draft: OrderDraft = JSON.parse(raw);
      if (draft.supplierId !== supplierId) { router.replace(`/order/${supplierId}`); return; }

      setDeliveryDate(draft.deliveryDate || "today");
      setGeneralNote(draft.generalNote || "");

      getIngredients(user.uid).then((all) => {
        const orderItems: OrderItem[] = [];
        for (const [id, qty] of Object.entries(draft.quantities)) {
          if (qty <= 0) continue;
          const ing = all.find((i) => i.id === id);
          if (!ing) continue;
          orderItems.push({
            ingredientId: id,
            myCatalogId: ing.myCatalogId,
            ingredientName: ing.ingredientName,
            quantity: qty,
            unit: ing.unit,
          });
        }
        setItems(orderItems);
        setLoading(false);
      });
    } catch {
      router.replace(`/order/${supplierId}`);
    }
  }, [user, supplierId, router]);

  const saveDraftAndNavigate = (path: string) => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft: OrderDraft = JSON.parse(raw);
        const finalDate = deliveryDate === "custom" ? customDate : deliveryDate;
        draft.deliveryDate = finalDate;
        draft.generalNote = generalNote;
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    } catch { /* ignore */ }
    router.push(path);
  };

  const effectiveDeliveryDate =
    deliveryDate === "custom" ? customDate : deliveryDate;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        読み込み中...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4" style={{ paddingBottom: 100 }}>
        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/order/${supplierId}`)}
            className="flex items-center gap-1 text-gray-500 font-medium text-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-arrow-right.svg" alt="" width={14} height={14}
              style={{ filter: "brightness(0) opacity(0.5)", transform: "rotate(180deg)" }} />
            戻る
          </button>
          <h1 className="font-bold text-gray-900">発注内容の確認</h1>
        </div>

        {/* 取引先 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">発注先</p>
          <p className="text-lg font-bold text-gray-900">{supplierName}</p>
        </div>

        {/* 発注品目リスト */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="font-bold text-gray-900">{items.length}品目</p>
            <button
              type="button"
              onClick={() => router.push(`/order/${supplierId}`)}
              className="text-xs text-primary font-medium underline"
            >
              変更する
            </button>
          </div>
          {items.map((item) => (
            <div key={item.ingredientId} className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.ingredientName}</p>
                {item.myCatalogId && <p className="text-xs text-gray-400">{item.myCatalogId}</p>}
              </div>
              <p className="text-sm font-bold text-primary">
                {item.quantity}{item.unit}
              </p>
            </div>
          ))}
        </div>

        {/* 納品希望日 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <p className="font-bold text-gray-900">納品希望日 <span className="text-red-500">*</span></p>
          <div className="flex flex-wrap gap-2">
            {DELIVERY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDeliveryDate(opt.value)}
                className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
                style={{
                  backgroundColor: deliveryDate === opt.value ? "#E85D2C" : "#fff",
                  color: deliveryDate === opt.value ? "#fff" : "#555",
                  borderColor: deliveryDate === opt.value ? "#E85D2C" : "#ddd",
                }}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDeliveryDate("custom")}
              className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
              style={{
                backgroundColor: deliveryDate === "custom" ? "#E85D2C" : "#fff",
                color: deliveryDate === "custom" ? "#fff" : "#555",
                borderColor: deliveryDate === "custom" ? "#E85D2C" : "#ddd",
              }}
            >
              日付選択 📅
            </button>
          </div>
          {deliveryDate === "custom" && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>

        {/* 備考 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <p className="font-bold text-gray-900">注文に関する備考</p>
          <textarea
            value={generalNote}
            onChange={(e) => setGeneralNote(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="特記事項があれば入力してください"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <p className="text-xs text-gray-400 text-right">{generalNote.length}/300</p>
        </div>

        {/* フッター */}
        <div
          className="fixed left-0 right-0 flex justify-center"
          style={{ bottom: "calc(60px + env(safe-area-inset-bottom, 0px))", zIndex: 110 }}
        >
          <div className="w-full max-w-[480px] bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
            <button
              type="button"
              onClick={() => router.push(`/order/${supplierId}`)}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ← 戻る
            </button>
            <button
              type="button"
              disabled={deliveryDate === "custom" && !customDate}
              onClick={() => saveDraftAndNavigate(`/order/${supplierId}/complete`)}
              className="flex-[2] py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-colors"
              style={{
                backgroundColor:
                  deliveryDate !== "custom" || customDate ? "#E85D2C" : "#9ca3af",
              }}
            >
              確定 →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
