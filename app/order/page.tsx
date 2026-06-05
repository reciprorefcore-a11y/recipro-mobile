"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getIngredients } from "@/lib/firestore";

type SupplierSummary = {
  name: string;
  count: number;
};

export default function OrderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4" style={{ paddingBottom: 80 }}>
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
              食材に仕入先を設定する
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {suppliers.map((s) => (
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
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
