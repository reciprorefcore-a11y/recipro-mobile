"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, saveStoreInfo } from "@/lib/firestore";

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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // パスワード変更
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((profile) => {
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

  const handlePasswordChange = async () => {
    if (!user) return;
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      setPwMsg("❌ すべての項目を入力してください");
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg("❌ 新しいパスワードが一致しません");
      return;
    }
    if (pwForm.next.length < 6) {
      setPwMsg("❌ パスワードは6文字以上で入力してください");
      return;
    }
    if (!user.email) {
      setPwMsg("❌ メールアドレスが取得できません");
      return;
    }

    setPwSaving(true);
    setPwMsg("");
    try {
      const credential = EmailAuthProvider.credential(user.email, pwForm.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, pwForm.next);
      setPwMsg("✅ パスワードを変更しました");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setPwMsg("❌ 現在のパスワードが正しくありません");
      } else if (code === "auth/weak-password") {
        setPwMsg("❌ パスワードは6文字以上で設定してください");
      } else if (code === "auth/too-many-requests") {
        setPwMsg("❌ 試行回数が多すぎます。しばらく時間をおいてください");
      } else {
        setPwMsg("❌ パスワード変更に失敗しました");
      }
    } finally {
      setPwSaving(false);
    }
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

        {/* パスワード変更 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700">ログインパスワード変更</p>
            <p className="text-xs text-gray-400 mt-0.5">
              レシプロモバイルのログインパスワードを変更します。<br />
              Recipro本体のパスワードとは別です。
            </p>
          </div>

          {[
            { key: "current" as const, label: "現在のパスワード", placeholder: "現在のパスワードを入力" },
            { key: "next" as const, label: "新しいパスワード", placeholder: "6文字以上" },
            { key: "confirm" as const, label: "新しいパスワード（確認）", placeholder: "もう一度入力" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
              <div className="relative">
                <input
                  type={showPw[key] ? "text" : "password"}
                  value={pwForm[key]}
                  onChange={(e) => setPwForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-[16px] outline-none focus:ring-2 focus:border-transparent transition-shadow"
                  style={{ "--tw-ring-color": "#E85D2C" } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => ({ ...s, [key]: !s[key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
                >
                  {showPw[key] ? "隠す" : "表示"}
                </button>
              </div>
            </div>
          ))}

          {pwMsg && (
            <p className={`text-sm text-center ${pwMsg.startsWith("❌") ? "text-red-500" : "text-green-600"}`}>
              {pwMsg}
            </p>
          )}

          <button
            type="button"
            onClick={handlePasswordChange}
            disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: "#E85D2C" }}
          >
            {pwSaving ? "変更中..." : "パスワードを変更する"}
          </button>
        </div>

      </div>
    </main>
  );
}
