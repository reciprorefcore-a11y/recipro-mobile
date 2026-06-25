"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { signIn } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ReciproLogo from "@/components/ReciproLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [resetError, setResetError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/");
    } catch {
      setError("メールアドレスまたはパスワードが正しくありません");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetMsg("");
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetMsg("登録がある場合、パスワード再設定メールを送信しました。");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/invalid-email") {
        setResetError("メールアドレスの形式が正しくありません");
      } else if (code === "auth/user-not-found") {
        // 登録の有無を漏らさない
        setResetMsg("登録がある場合、パスワード再設定メールを送信しました。");
      } else {
        setResetError("送信に失敗しました。しばらくしてから再度お試しください");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleOpenReset = () => {
    setResetEmail(email); // ログインフォームのメールを引き継ぐ
    setResetMsg("");
    setResetError("");
    setShowResetForm(true);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-sm p-6">
        <div className="flex justify-center mb-6">
          <ReciproLogo />
        </div>
        <h1 className="text-xl font-bold text-center mb-1">ログイン</h1>
        <p className="text-center text-sm text-gray-500 mb-6">
          Recipro にサインイン
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
          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "処理中..." : "ログイン"}
          </Button>
        </form>

        <div className="text-center mt-3">
          <button
            type="button"
            onClick={handleOpenReset}
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            パスワードをお忘れですか？
          </button>
        </div>

        <p className="text-center text-sm text-gray-600 mt-4">
          アカウントをお持ちでない方は{" "}
          <Link href="/signup" className="text-primary underline">
            新規登録
          </Link>
        </p>
      </div>

      {/* パスワード再設定モーダル */}
      {showResetForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowResetForm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-base font-bold text-gray-900">パスワード再設定</h2>
              <p className="text-xs text-gray-500 mt-1">
                レシプロモバイルのパスワードを再設定します。
              </p>
            </div>

            {resetMsg ? (
              <div className="space-y-4">
                <p className="text-sm text-green-700 bg-green-50 rounded-xl p-3">{resetMsg}</p>
                <button
                  type="button"
                  onClick={() => setShowResetForm(false)}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: "#E85D2C" }}
                >
                  閉じる
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-3">
                <Input
                  label="メールアドレス"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                />
                {resetError && (
                  <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">{resetError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResetForm(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || !resetEmail.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                    style={{ backgroundColor: "#E85D2C" }}
                  >
                    {resetLoading ? "送信中..." : "送信"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
