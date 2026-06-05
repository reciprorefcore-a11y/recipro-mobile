"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getOrders, deleteOrder } from "@/lib/firestore";
import type { Order } from "@/types";

const DRAFT_KEY = "recipro_order_draft";

function formatDate(ts: Order["createdAt"]): string {
  if (!ts) return "—";
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getOrders(user.uid, 20)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [user]);

  const handleReorder = (order: Order) => {
    const supplierId = encodeURIComponent(order.supplier.name);
    const quantities: Record<string, number> = {};
    for (const item of order.items) {
      quantities[item.ingredientId] = item.quantity;
    }
    const draft = {
      supplierId,
      supplierName: order.supplier.name,
      quantities,
      deliveryDate: "today",
      generalNote: "",
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    router.push(`/order/${supplierId}`);
  };

  const handleDelete = async (orderId: string) => {
    if (!user) return;
    if (!window.confirm("この発注履歴を削除しますか？\n削除すると発注金額分析からも除外されます。")) return;
    setDeletingId(orderId);
    try {
      await deleteOrder(user.uid, orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch {
      alert("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4" style={{ paddingBottom: 100 }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/order")}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 font-medium"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-arrow-right.svg" alt="" width={16} height={16}
              style={{ filter: "brightness(0) opacity(0.5)", transform: "rotate(180deg)" }} />
            戻る
          </button>
          <h1 className="text-xl font-bold">発注履歴</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-gray-400 text-sm">発注履歴がありません</p>
            <p className="text-xs text-gray-400">発注を完了すると、ここに表示されます</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 truncate">{order.supplier.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(order.createdAt)} ・ {order.items.length}品目
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => order.id && handleDelete(order.id)}
                      disabled={!order.id || deletingId === order.id}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-40 transition-colors"
                    >
                      {deletingId === order.id ? "削除中…" : "削除"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorder(order)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: "#E85D2C" }}
                    >
                      再発注
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  {order.items.slice(0, 3).map((item) => (
                    <p key={item.ingredientId}>
                      ・{item.ingredientName} {item.quantity}{item.unit}
                    </p>
                  ))}
                  {order.items.length > 3 && (
                    <p className="text-gray-400">他 {order.items.length - 3}品目</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
