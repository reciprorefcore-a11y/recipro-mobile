"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth";
import { createUserProfile, saveConsent } from "@/lib/firestore";

const TERMS_VERSION = "1.0";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ReciproLogo from "@/components/ReciproLogo";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await signUp(email, password);
      await createUserProfile(user.uid, { email, companyName, storeName });
      await saveConsent(user.uid, TERMS_VERSION);
      router.push("/onboarding");
    } catch (err: unknown) {
      const fe = err as { code?: string };
      if (fe.code === "auth/email-already-in-use") {
        setError("このメールアドレスはすでに登録されています");
      } else {
        setError("登録に失敗しました。入力内容を確認してください");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-sm p-6">
        <div className="flex justify-center mb-6">
          <ReciproLogo />
        </div>
        <h1 className="text-xl font-bold text-center mb-1">新規登録</h1>
        <p className="text-center text-sm text-gray-500 mb-6">
          Recipro アカウントを作成
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            required
          />
          <Input
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6文字以上"
            required
          />
          <Input
            label="企業名"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="株式会社〇〇"
            required
          />
          <Input
            label="店舗名"
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="〇〇店"
            required
          />
          <div className="space-y-2.5 pt-1">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-orange-500 shrink-0"
              />
              <span className="text-sm text-gray-700">
                <Link href="/terms" target="_blank" className="text-primary underline">
                  利用規約
                </Link>
                に同意します
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedPrivacy}
                onChange={(e) => setAgreedPrivacy(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-orange-500 shrink-0"
              />
              <span className="text-sm text-gray-700">
                <Link href="/privacy" target="_blank" className="text-primary underline">
                  プライバシーポリシー
                </Link>
                に同意します
              </span>
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading || !agreedTerms || !agreedPrivacy} className="w-full">
            {loading ? "処理中..." : "登録する"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-5">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="text-primary underline">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  );
}
