"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getSuppliers, updateSupplier, addSupplierToMaster, deleteSupplierFromMaster, backfillSupplierIds } from "@/lib/firestore";
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

const EDIT_FIELDS: { key: keyof EditState; label: string; placeholder: string; required?: boolean; type: string }[] = [
  { key: "name", label: "取引先名", placeholder: "例: 高瀬物産", required: true, type: "text" },
  { key: "email", label: "メールアドレス", placeholder: "例: order@takase.co.jp", type: "email" },
  { key: "phone", label: "電話番号", placeholder: "例: 03-1234-5678", type: "tel" },
  { key: "fax", label: "FAX番号", placeholder: "例: 03-1234-5679", type: "tel" },
  { key: "lineId", label: "LINE ID", placeholder: "例: @takase-bussan", type: "text" },
  { key: "orderUrl", label: "発注URL", placeholder: "例: https://order.example.com", type: "url" },
  { key: "note", label: "備考", placeholder: "例: 火曜締め・木曜配送", type: "text" },
];

export default function SuppliersPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, EditState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 新規登録フォーム
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [addMsg, setAddMsg] = useState("");

  // バックフィル
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");

  const loadSuppliers = async (uid: string) => {
    const list = await getSuppliers(uid);
    setSuppliers(list);
    const forms: Record<string, EditState> = {};
    for (const s of list) forms[s.id] = supplierToEdit(s);
    setEditForms(forms);
  };

  useEffect(() => {
    if (!user) return;
    loadSuppliers(user.uid)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setMsgs((prev) => ({ ...prev, [id]: "" }));
    setConfirmDeleteId(null);
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
        prev.map((s) => s.id === supplier.id ? { ...s, name: form.name.trim() } : s)
      );
      setMsgs((prev) => ({ ...prev, [supplier.id]: "✅ 保存しました" }));
      setExpandedId(null);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      console.error("[updateSupplier]", m);
      setMsgs((prev) => ({ ...prev, [supplier.id]: "❌ 保存に失敗しました" }));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!user) return;
    setDeletingId(supplier.id);
    try {
      await deleteSupplierFromMaster(user.uid, supplier.id);
      setSuppliers((prev) => prev.filter((s) => s.id !== supplier.id));
      setConfirmDeleteId(null);
      setExpandedId(null);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      console.error("[deleteSupplier]", m);
      setMsgs((prev) => ({ ...prev, [supplier.id]: "❌ 削除に失敗しました" }));
    } finally {
      setDeletingId(null);
    }
  };

  const handleBackfill = async () => {
    if (!user) return;
    setBackfilling(true);
    setBackfillMsg("");
    try {
      const { updated } = await backfillSupplierIds(user.uid);
      if (updated === 0) {
        setBackfillMsg("✅ すべての食材に取引先IDが設定済みです");
      } else {
        await loadSuppliers(user.uid);
        setBackfillMsg(`✅ ${updated}件の食材に取引先IDを紐付けました`);
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      console.error("[backfillSupplierIds]", m);
      setBackfillMsg("❌ バックフィルに失敗しました");
    } finally {
      setBackfilling(false);
    }
  };

  const handleAddNew = async () => {
    if (!user || !newName.trim()) return;
    setAddingNew(true);
    setAddMsg("");
    try {
      await addSupplierToMaster(user.uid, newName.trim());
      await loadSuppliers(user.uid);
      setNewName("");
      setShowAddForm(false);
      setAddMsg("");
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      console.error("[addSupplier]", m);
      setAddMsg("❌ 登録に失敗しました");
    } finally {
      setAddingNew(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[480px] mx-auto">

        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-4 bg-white border-b border-gray-100"
          style={{ height: "52px" }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ‹
            </button>
            <h1 className="text-base font-semibold text-gray-900">取引先マスタ</h1>
          </div>
          <button
            type="button"
            onClick={() => { setShowAddForm((v) => !v); setAddMsg(""); }}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ color: "#E85D2C" }}
          >
            ＋ 新規登録
          </button>
        </div>

        {/* 新規登録フォーム */}
        {showAddForm && (
          <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">新しい取引先を追加</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="取引先名 *"
              autoFocus
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": "#E85D2C" } as React.CSSProperties}
            />
            {addMsg && (
              <p className="text-xs text-red-500">{addMsg}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setNewName(""); setAddMsg(""); }}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-500"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleAddNew}
                disabled={addingNew || !newName.trim()}
                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40"
                style={{ backgroundColor: "#E85D2C" }}
              >
                {addingNew ? "登録中..." : "登録する"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="px-4 py-6 space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <p className="text-sm text-gray-400">取引先が登録されていません</p>
            <p className="text-xs text-gray-300">上の「＋ 新規登録」から追加できます</p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-2">
            {suppliers.map((supplier) => {
              const isOpen = expandedId === supplier.id;
              const form = editForms[supplier.id] ?? EMPTY_EDIT;
              const isConfirmingDelete = confirmDeleteId === supplier.id;

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

                      {/* 削除エリア */}
                      {!isConfirmingDelete ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(supplier.id)}
                          className="w-full py-2 text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          この取引先を削除する
                        </button>
                      ) : (
                        <div className="border border-red-100 bg-red-50 rounded-xl p-3 space-y-2">
                          <p className="text-xs text-red-600 text-center font-medium">
                            削除すると元に戻せません。よろしいですか？
                          </p>
                          <p className="text-xs text-red-400 text-center">
                            既存食材の取引先名はそのまま残ります
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="flex-1 py-2 text-xs border border-gray-200 rounded-xl text-gray-500"
                            >
                              キャンセル
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(supplier)}
                              disabled={deletingId === supplier.id}
                              className="flex-1 py-2 text-xs font-bold text-white rounded-xl bg-red-500 disabled:opacity-40"
                            >
                              {deletingId === supplier.id ? "削除中..." : "削除する"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <p className="text-xs text-center text-gray-300 pt-2 pb-2">
              食材マスタの取り込みでも取引先が自動登録されます
            </p>

            {/* バックフィルセクション */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2 mb-4">
              <p className="text-xs font-medium text-gray-600">取引先IDの一括紐付け</p>
              <p className="text-xs text-gray-400">
                既存食材に取引先IDが未設定の場合、一括で紐付けます。通常は自動で処理されます。
              </p>
              {backfillMsg && (
                <p className={`text-xs ${backfillMsg.startsWith("❌") ? "text-red-500" : "text-green-600"}`}>
                  {backfillMsg}
                </p>
              )}
              <button
                type="button"
                onClick={handleBackfill}
                disabled={backfilling}
                className="w-full py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                {backfilling ? "処理中..." : "取引先IDを一括紐付け"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
