"use client";

import { useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  suppliers: string[];
};

export default function SupplierSelect({ value, onChange, suppliers }: Props) {
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");

  if (addingNew) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新しい仕入先名"
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
            onClick={() => {
              if (newName.trim()) {
                onChange(newName.trim());
                setAddingNew(false);
                setNewName("");
              }
            }}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: "#E85D2C" }}
          >
            追加して選択
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
      <option value="__new__">＋ 新しい仕入先を追加</option>
    </select>
  );
}
