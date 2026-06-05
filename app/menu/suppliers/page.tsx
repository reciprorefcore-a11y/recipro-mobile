"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getSuppliers, updateSupplier } from "@/lib/firestore";
import type { Supplier } from "@/types";

type EditState = {
  name: string;
  email: string;
  phone: string;
  fax: string;
  lineId: string;
  orderUrl: string;
  note: string;
};

const EMPTY_EDIT: EditState = {
  name: "", email: "", phone: "", fax: "", lineId: "", orderUrl: "", note: "",
};

function supplierToEdit(s: Supplier): EditState {
  return {
    name: s.name ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    fax: s.fax ?? "",
    lineId: s.lineId ?? "",
    orderUrl: s.orderUrl ?? "",
    note: s.note ?? "",
  };
}

export default function SuppliersPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, EditState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    getSuppliers(user.uid).then((list) => {
      setSuppliers(list);
      const forms: Record<string, EditState> = {};
      for (const s of list) forms[s.id] = supplierToEdit(s);
      setEditForms(forms);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setMsgs((prev) => ({ ...prev, [id]: "" }));
  };

  const handleSave = async (supplier: Supplier) => {
    if (!user) return;
    const form = editForms[supplier.id];
    if (!form || !form.name.trim()) return;

    setSavingId(supplier.id);
    setMsgs((prev) => ({ ...prev, [supplier.id]: "" }));
    try {
      await updateSupplier(user.uid, supplier.id, {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        fax: form.fax.trim() || undefined,
        lineId: form.lineId.trim() || undefined,
        orderUrl: form.orderUrl.trim() || undefined,
        note: form.note.trim() || undefined,
      });
      setSuppliers((prev) =>
        prev.map((s) => s.id === supplier.id ? { ...s, ...form } : s)
      );
      setMsgs((prev) => ({ ...prev, [supplier.id]: "✅ 保存しました" }));
      setExpandedId(null);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      console.error("[updateSupplier]", m);
      setMsgs((prev) => ({ ...prev, [supplier.id]: `❌ 保存に失敗しました` }));
    } finally {
      setSavingId(null);
    }
  };

  const EDIT_FIELDS = [
    { key: "name" as const, label: "取引先名", placeholder: "例: 高瀬物産", required: true, type: "text" },
    { key: "email" as const, label: "メールアドレス", placeholder: "例: order@takase.co.jp", type: "email" },
    { key: "phone" as const, label: "電話番号", placeholder: "例: 03-1234-5678", type: "tel" },
    { key: "fax" as const, label: "FAX番号", placeholder: "例: 03-1234-5679", type: "tel" },
    { key: "lineId" as const, label: "LINE ID", placeholder: "例: @takase-bussan", type: "text" },
    { key: "orderUrl" as const, label: "発注URL", placeholder: "例: https://order.example.com", type: "url" },
    { key: "note" as const, label: "備考", placeholder: "例: 火曜締め・木曜配送", type: "text" },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[480px] mx-auto">

        {/* ヘッダー */}
        <div
          className="flex items-center gap-3 px-4 bg-white border-b border-gray-100"
          style={{ height: "52px" }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ‹
          </button>
          <h1 className="text-base font-semibold text-gray-900">取引先マスタ</h1>
        </div>

        {loading ? (
          <div className="px-4 py-6 space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <p className="text-sm text-gray-400">取引先が登録されていません</p>
            <p className="text-xs text-gray-300">食材マスタを取り込むと自動登録されます</p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-2">
            {suppliers.map((supplier) => {
              const isOpen = expandedId === supplier.id;
              const form = editForms[supplier.id] ?? EMPTY_EDIT;

              return (
                <div
                  key={supplier.id}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden"
                >
                  {/* 取引先名行 */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(supplier.id)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {supplier.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {supplier.email && (
                          <span className="text-xs text-gray-400 truncate">{supplier.email}</span>
                        )}
                        {!supplier.email && !supplier.phone && (
                          <span className="text-xs text-gray-300">連絡先未登録</span>
                        )}
                        {!supplier.email && supplier.phone && (
                          <span className="text-xs text-gray-400">{supplier.phone}</span>
                        )}
                      </div>
                    </div>
                    <span
                      className="text-gray-400 text-sm ml-2 shrink-0 transition-transform"
                      style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                    >
                      ›
                    </span>
                  </button>

                  {/* 編集フォーム */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                      {EDIT_FIELDS.map(({ key, label, placeholder, required, type }) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            {label}
                            {required && <span className="text-red-400 ml-0.5">*</span>}
                          </label>
                          <input
                            type={type}
                            value={form[key]}
                            onChange={(e) =>
                              setEditForms((prev) => ({
                                ...prev,
                                [supplier.id]: { ...prev[supplier.id], [key]: e.target.value },
                              }))
                            }
                            placeholder={placeholder}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:border-transparent"
                            style={{ "--tw-ring-color": "#E85D2C" } as React.CSSProperties}
                          />
                        </div>
                      ))}

                      {msgs[supplier.id] && (
                        <p className={`text-xs text-center ${msgs[supplier.id].startsWith("❌") ? "text-red-500" : "text-green-600"}`}>
                          {msgs[supplier.id]}
                        </p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleExpand(supplier.id)}
                          className="flex-1 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50"
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSave(supplier)}
                          disabled={savingId === supplier.id || !form.name.trim()}
                          className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40"
                          style={{ backgroundColor: "#E85D2C" }}
                        >
                          {savingId === supplier.id ? "保存中..." : "保存"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <p className="text-xs text-center text-gray-300 pt-2 pb-4">
              食材マスタの取り込みで取引先が自動登録されます
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
