"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getIngredients, getUserProfile, saveOrder } from "@/lib/firestore";
import { openOrderPrintWindow, generateLineText, generateMailtoUrl } from "@/lib/orderPdfGenerator";
import type { StoreInfoForOrder } from "@/lib/orderPdfGenerator";
import type { OrderDraft } from "../page";
import type { OrderItem } from "@/types";

const DRAFT_KEY = "recipro_order_draft";

export default function OrderCompletePage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const supplierId = params.supplierId as string;
  const supplierName = decodeURIComponent(supplierId);

  const [items, setItems] = useState<OrderItem[]>([]);
  const [deliveryDate, setDeliveryDate] = useState("today");
  const [generalNote, setGeneralNote] = useState("");
  const [storeInfo, setStoreInfo] = useState<StoreInfoForOrder>({ storeName: "店舗" });
  const [orderId, setOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let draft: OrderDraft | null = null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) draft = JSON.parse(raw) as OrderDraft;
    } catch { /* ignore */ }

    if (!draft || draft.supplierId !== supplierId) {
      router.replace(`/order/${supplierId}`);
      return;
    }

    const { quantities, deliveryDate: dd, generalNote: gn } = draft;
    setDeliveryDate(dd || "today");
    setGeneralNote(gn || "");

    Promise.all([
      getIngredients(user.uid),
      getUserProfile(user.uid),
    ]).then(([all, profile]) => {
      if (profile) {
        setStoreInfo({
          storeName: profile.storeName || "店舗",
          address: profile.address,
          zipCode: profile.zipCode,
          phone: profile.phone,
          fax: profile.fax,
          personInCharge: profile.personInCharge,
        });
      }

      const orderItems: OrderItem[] = [];
      for (const [id, qty] of Object.entries(quantities)) {
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

      // Firestoreに保存
      setSaving(true);
      saveOrder(user.uid, {
        supplier: { id: supplierId, name: supplierName },
        items: orderItems,
        deliveryDate: dd,
        generalNote: gn || "",
        status: "draft",
      })
        .then((id) => setOrderId(id))
        .catch(console.error)
        .finally(() => { setSaving(false); setLoading(false); });
    });
  }, [user, supplierId, supplierName, router]);

  const pdfParams = { supplierName, storeInfo, items, deliveryDate, generalNote };

  const handlePdf = () => openOrderPrintWindow(pdfParams);

  const handleMail = () => {
    window.location.href = generateMailtoUrl(pdfParams);
  };

  const handleLine = async () => {
    const text = generateLineText(pdfParams);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(text);
    }
  };

  const handleDone = () => {
    sessionStorage.removeItem(DRAFT_KEY);
    router.push("/order");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        {saving ? "発注書を保存中..." : "読み込み中..."}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-8 space-y-4" style={{ paddingBottom: 40 }}>

        {/* 完了メッセージ */}
        <div className="text-center space-y-2 py-4">
          <div className="text-4xl">✅</div>
          <h1 className="text-lg font-bold text-gray-900">発注書の準備が完了しました</h1>
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-700">{supplierName}</span> への発注書 ({items.length}品目)
          </p>
          {orderId && (
            <p className="text-xs text-gray-400">発注ID: {orderId.slice(0, 8)}</p>
          )}
        </div>

        {/* 品目サマリー */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-700">発注内容</p>
          </div>
          {items.map((item) => (
            <div key={item.ingredientId} className="px-4 py-3 border-b border-gray-50 flex justify-between">
              <p className="text-sm text-gray-800">{item.ingredientName}</p>
              <p className="text-sm font-semibold text-primary">{item.quantity}{item.unit}</p>
            </div>
          ))}
        </div>

        {/* 送信方法 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <p className="font-bold text-gray-900">送信方法を選択</p>

          <button
            type="button"
            onClick={handlePdf}
            className="w-full py-3 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2 transition-colors hover:bg-orange-50"
            style={{ borderColor: "#E85D2C", color: "#E85D2C" }}
          >
            📄 FAX用PDFをダウンロード
          </button>

          <button
            type="button"
            onClick={handleMail}
            className="w-full py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:bg-gray-50 border-gray-300 text-gray-700"
          >
            📧 メールで送信
          </button>

          <button
            type="button"
            onClick={handleLine}
            className="w-full py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:bg-green-50 border-green-400 text-green-700"
          >
            {copied ? "✅ コピーしました！" : "💬 LINEテキストをコピー"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleDone}
          className="w-full py-3 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: "#E85D2C" }}
        >
          完了
        </button>
      </div>
    </main>
  );
}
