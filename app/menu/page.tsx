"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile } from "@/lib/firestore";
import { signOut } from "@/lib/auth";
import type { UserProfile } from "@/types";

type ImportPhase =
  | { name: "idle" }
  | { name: "previewing"; file: File; total: number; suppliers: string[]; supplierCount: number }
  | { name: "importing" }
  | { name: "done"; added: number; updated: number; skipped: number; supplierCount: number; newSupplierCount: number; suppliers: string[] }
  | { name: "error"; message: string };

export default function MenuPage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [importPhase, setImportPhase] = useState<ImportPhase>({ name: "idle" });

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => setProfile(p));
  }, [user]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setImportPhase({ name: "previewing", file, total: 0, suppliers: [], supplierCount: 0 });

    try {
      const token = await user.getIdToken(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("preview", "true");

      const res = await fetch("/api/import/ingredients", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json() as { total?: number; suppliers?: string[]; supplierCount?: number; error?: string };

      if (!res.ok) {
        setImportPhase({ name: "error", message: json.error ?? "解析に失敗しました" });
        return;
      }
      setImportPhase({
        name: "previewing",
        file,
        total: json.total ?? 0,
        suppliers: json.suppliers ?? [],
        supplierCount: json.supplierCount ?? 0,
      });
    } catch {
      setImportPhase({ name: "error", message: "通信エラーが発生しました" });
    }
  };

  const handleImportConfirm = async () => {
    if (importPhase.name !== "previewing" || !user) return;
    const file = importPhase.file;
    setImportPhase({ name: "importing" });

    try {
      const token = await user.getIdToken(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/ingredients", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json() as {
        added?: number; updated?: number; skipped?: number;
        supplierCount?: number; newSupplierCount?: number; suppliers?: string[];
        error?: string;
      };

      if (!res.ok) {
        setImportPhase({ name: "error", message: json.error ?? "取り込みに失敗しました" });
        return;
      }
      setImportPhase({
        name: "done",
        added: json.added ?? 0,
        updated: json.updated ?? 0,
        skipped: json.skipped ?? 0,
        supplierCount: json.supplierCount ?? 0,
        newSupplierCount: json.newSupplierCount ?? 0,
        suppliers: json.suppliers ?? [],
      });
    } catch {
      setImportPhase({ name: "error", message: "通信エラーが発生しました" });
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">メニュー</h1>

        {/* 店舗情報サマリー */}
        {profile && (
          <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{profile.storeName}</p>
              {profile.email && <p className="text-xs text-gray-400 mt-0.5">{profile.email}</p>}
            </div>
            <Link
              href="/menu/store-info"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
              style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
            >
              編集
            </Link>
          </div>
        )}

        {/* レシプロから食材マスタを取り込む */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-sm font-medium text-gray-500">レシプロから食材マスタを取り込む</p>

          {importPhase.name === "idle" && (
            <>
              <p className="text-xs text-gray-400">
                レシプロの入力シート(.xlsx)またはCSVをアップロードして食材マスタを取り込みます。
              </p>
              <label className="block cursor-pointer">
                <div
                  className="w-full py-3 text-sm font-semibold border-2 border-dashed rounded-xl text-center transition-colors hover:bg-orange-50"
                  style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
                >
                  📁 入力シートを選択(.xlsx / .csv)
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
              <div className="bg-amber-50 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-800">⚠ 注意</p>
                <p className="text-xs text-amber-700">既存食材は更新されます</p>
                <p className="text-xs text-amber-700">新規食材は追加されます</p>
              </div>
            </>
          )}

          {importPhase.name === "previewing" && importPhase.total === 0 && (
            <div className="flex items-center justify-center py-6 gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-gray-500">ファイルを解析中...</p>
            </div>
          )}

          {importPhase.name === "previewing" && importPhase.total > 0 && (
            <>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-gray-900">取り込み確認</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">食材データ</span>
                    <span className="font-bold text-gray-900">{importPhase.total.toLocaleString()}件</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">取引先</span>
                    <span className="font-bold text-gray-900">{importPhase.supplierCount}社</span>
                  </div>
                </div>
                {importPhase.suppliers.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">取引先一覧:</p>
                    <ul className="space-y-0.5">
                      {importPhase.suppliers.slice(0, 8).map((s) => (
                        <li key={s} className="text-xs text-gray-500">・{s}</li>
                      ))}
                      {importPhase.suppliers.length > 8 && (
                        <li className="text-xs text-gray-400">他 {importPhase.suppliers.length - 8}社</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setImportPhase({ name: "idle" })}
                  className="flex-1 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleImportConfirm}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl"
                  style={{ backgroundColor: "#E85D2C" }}
                >
                  取り込みを実行
                </button>
              </div>
            </>
          )}

          {importPhase.name === "importing" && (
            <div className="flex items-center justify-center py-6 gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-gray-500">取り込み中...</p>
            </div>
          )}

          {importPhase.name === "done" && (
            <>
              <div className="bg-green-50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-bold text-green-900">✅ 取り込み完了</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">新規追加</span>
                    <span className="font-bold text-green-800">{importPhase.added.toLocaleString()}件</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">既存更新</span>
                    <span className="font-bold text-green-800">{importPhase.updated.toLocaleString()}件</span>
                  </div>
                  {importPhase.skipped > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">スキップ</span>
                      <span className="text-gray-600">{importPhase.skipped}件</span>
                    </div>
                  )}
                  <div className="border-t border-green-100 pt-1 flex justify-between text-sm">
                    <span className="text-green-700">取引先登録</span>
                    <span className="font-bold text-green-800">
                      {importPhase.supplierCount}社
                      {importPhase.newSupplierCount > 0 && ` (新規${importPhase.newSupplierCount}社)`}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setImportPhase({ name: "idle" })}
                className="w-full py-2.5 text-sm font-medium border rounded-xl"
                style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
              >
                続けて取り込む
              </button>
            </>
          )}

          {importPhase.name === "error" && (
            <>
              <p className="text-xs text-red-500 text-center">❌ {importPhase.message}</p>
              <button
                onClick={() => setImportPhase({ name: "idle" })}
                className="w-full py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-600"
              >
                やり直す
              </button>
            </>
          )}
        </div>

        {/* リンクリスト */}
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
          {[
            { label: "店舗情報", href: "/menu/store-info" },
            { label: "取引先マスタ", href: "/menu/suppliers" },
            { label: "利用規約", href: "/terms" },
            { label: "プライバシーポリシー", href: "/privacy" },
            { label: "お問い合わせ", href: "/contact" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-800">{item.label}</span>
              <span className="text-gray-400 text-lg">›</span>
            </Link>
          ))}
        </div>

        {/* ログアウト */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full py-3.5 rounded-2xl bg-white shadow-sm font-semibold text-base hover:bg-red-50 disabled:opacity-50 transition-colors"
          style={{ color: "#D93025" }}
        >
          {signingOut ? "ログアウト中..." : "ログアウト"}
        </button>

        <p className="text-center text-xs text-gray-400 pb-2">Recipro v0.1.0</p>
      </div>
    </main>
  );
}
