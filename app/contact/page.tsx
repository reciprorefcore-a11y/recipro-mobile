"use client";

import Link from "next/link";
import { useState } from "react";

const SUPPORT_EMAIL = "support@refcore.co.jp";
const SUBJECT = "【レシプロ】お問い合わせ";

type FormState = {
  name: string;
  email: string;
  storeName: string;
  message: string;
};

export default function ContactPage() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    storeName: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const isValid = form.name.trim() && form.email.trim() && form.message.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = [
      `お名前: ${form.name}`,
      `メールアドレス: ${form.email}`,
      form.storeName ? `店舗名: ${form.storeName}` : null,
      ``,
      `お問い合わせ内容:`,
      form.message,
    ]
      .filter((line) => line !== null)
      .join("\n");

    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[480px] mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/menu"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ‹ メニューに戻る
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">お問い合わせ</h1>
          <p className="text-sm text-gray-500 mb-6">ご質問・ご要望はこちらから</p>

          {submitted ? (
            <div className="space-y-4">
              <div className="bg-green-50 rounded-xl p-4 text-center space-y-2">
                <p className="text-2xl">✅</p>
                <p className="text-sm font-bold text-green-800">メールアプリが開きました</p>
                <p className="text-xs text-green-700">
                  内容をご確認のうえ、送信してください。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForm({ name: "", email: "", storeName: "", message: "" });
                  setSubmitted(false);
                }}
                className="w-full py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
              >
                新しいお問い合わせ
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="山田 太郎"
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="example@email.com"
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  店舗名
                </label>
                <input
                  type="text"
                  value={form.storeName}
                  onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
                  placeholder="〇〇店"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  お問い合わせ内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="ご質問・ご要望をご記入ください"
                  required
                  rows={6}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-shadow resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!isValid}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: "#E85D2C" }}
              >
                送信
              </button>

              <p className="text-xs text-gray-400 text-center">
                送信後、メールアプリが起動します。内容を確認して送信してください。
              </p>
            </form>
          )}
        </div>

        <div className="mt-4 text-center space-y-1">
          <p className="text-xs text-gray-400">お問い合わせ先</p>
          <p className="text-xs font-medium text-gray-600">{SUPPORT_EMAIL}</p>
          <p className="text-xs text-gray-400">平日 10:00〜18:00</p>
        </div>
      </div>
    </main>
  );
}
