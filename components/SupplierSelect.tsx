"use client";

import { useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  suppliers: string[];
  onAddNew?: (name: string) => Promise<void>;
};

export default function SupplierSelect({ value, onChange, suppliers, onAddNew }: Props) {
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  if (addingNew) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新しい取引先名"
          autoFocus
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setAddingNew(false); setNewName(""); }}
            className="flex-1 py-2 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← 一覧に戻る
          </button>
          <button
            type="button"
            disabled={saving || !newName.trim()}
            onClick={async () => {
              const trimmed = newName.trim();
              if (!trimmed) return;
              setSaving(true);
              try {
                if (onAddNew) await onAddNew(trimmed);
              } catch {
                // master保存失敗でも選択は続行
              } finally {
                setSaving(false);
              }
              onChange(trimmed);
              setAddingNew(false);
              setNewName("");
            }}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ backgroundColor: "#E85D2C" }}
          >
            {saving ? "登録中..." : "追加して選択"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__new__") {
          setAddingNew(true);
        } else {
          onChange(e.target.value);
        }
      }}
      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary text-gray-700"
    >
      <option value="">選択してください</option>
      {suppliers.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
      <option value="__new__">＋ 新しい取引先を追加</option>
    </select>
  );
}
