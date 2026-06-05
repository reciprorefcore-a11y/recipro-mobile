"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  getUserProfile,
  saveStoreInfo,
  getGeneralSettings,
  savePriceMode,
} from "@/lib/firestore";
import type { PriceMode } from "@/types";

type FormKey = "storeName" | "zipCode" | "address" | "phone" | "fax" | "personInCharge";
type FormState = Record<FormKey, string>;

const FIELDS: { key: FormKey; label: string; placeholder: string; required?: boolean }[] = [
  { key: "storeName", label: "店舗名", placeholder: "例: 居酒屋まるごと", required: true },
  { key: "zipCode", label: "郵便番号", placeholder: "例: 150-0001" },
  { key: "address", label: "住所（納品場所）", placeholder: "例: 東京都渋谷区..." },
  { key: "phone", label: "電話番号", placeholder: "例: 03-1234-5678" },
  { key: "fax", label: "FAX番号", placeholder: "例: 03-1234-5679" },
  { key: "personInCharge", label: "担当者名", placeholder: "例: 山田 太郎" },
];

export default function StoreInfoPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    storeName: "",
    zipCode: "",
    address: "",
    phone: "",
    fax: "",
    personInCharge: "",
  });
  const [priceMode, setPriceMode] = useState<PriceMode | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getUserProfile(user.uid),
      getGeneralSettings(user.uid),
    ]).then(([profile, settings]) => {
      if (profile) {
        setForm({
          storeName: profile.storeName ?? "",
          zipCode: profile.zipCode ?? "",
          address: profile.address ?? "",
          phone: profile.phone ?? "",
          fax: profile.fax ?? "",
          personInCharge: profile.personInCharge ?? "",
        });
      }
      if (settings?.priceMode) setPriceMode(settings.priceMode);
      setLoading(false);
    });
  }, [user]);

  const handleSave = async () => {
    if (!user || !form.storeName.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      await saveStoreInfo(user.uid, {
        storeName: form.storeName.trim(),
        zipCode: form.zipCode.trim() || undefined,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        fax: form.fax.trim() || undefined,
        personInCharge: form.personInCharge.trim() || undefined,
      });
      setMsg("✅ 保存しました");
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      console.error("[saveStoreInfo]", m, err);
      setMsg(`❌ 保存に失敗しました: ${m}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePriceModeChange = async (mode: PriceMode) => {
    if (!user) return;
    setPriceMode(mode);
    await savePriceMode(user.uid, mode).catch(console.error);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex justify-center">
        <div className="w-full max-w-[480px] px-4 py-6 space-y-4 animate-pulse">
          <div className="h-6 bg-gray-100 rounded w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ‹
          </button>
          <h1 className="text-lg font-bold text-gray-900">店舗情報</h1>
        </div>

        {/* 店舗情報フォーム */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          {FIELDS.map(({ key, label, placeholder, required }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {label}{required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:border-transparent transition-shadow"
                style={{ "--tw-ring-color": "#E85D2C" } as React.CSSProperties}
              />
            </div>
          ))}

          {msg && (
            <p className={`text-sm text-center ${msg.startsWith("❌") ? "text-red-500" : "text-green-600"}`}>
              {msg}
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.storeName.trim()}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: "#E85D2C" }}
          >
            {saving ? "保存中..." : "保存する"}
          </button>
        </div>

        {/* 価格設定 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-sm font-medium text-gray-500">価格設定</p>
          <p className="text-xs text-gray-400">食材単価の税表示方法を選択してください</p>
          <div className="flex gap-3">
            {([
              { value: "taxIncluded", label: "税込" },
              { value: "taxExcluded", label: "税別" },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handlePriceModeChange(value)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                style={{
                  color: priceMode === value ? "#fff" : "#E85D2C",
                  backgroundColor: priceMode === value ? "#E85D2C" : "transparent",
                  borderColor: "#E85D2C",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {priceMode && (
            <p className="text-xs text-gray-400 text-center">
              現在: {priceMode === "taxIncluded" ? "税込" : "税別"}
            </p>
          )}
        </div>

      </div>
    </main>
  );
}
