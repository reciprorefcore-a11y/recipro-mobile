"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ReciproLogo from "@/components/ReciproLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

        <p className="text-center text-sm text-gray-600 mt-5">
          アカウントをお持ちでない方は{" "}
          <Link href="/signup" className="text-primary underline">
            新規登録
          </Link>
        </p>
      </div>
    </main>
  );
}
