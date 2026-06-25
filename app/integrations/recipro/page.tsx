"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getReciproIntegration } from "@/lib/reciproIntegration";
import { RECIPRO_LOCAL_STORE_ID } from "@/lib/reciproIntegration";

type Phase =
  | { tag: "loading" }
  | { tag: "disconnected" }
  | { tag: "form_login" }
  | {
      tag: "choosing_store";
      customerId: string;
      stores: Array<{ id: string; name: string }>;
    }
  | { tag: "connected"; storeName: string }
  | { tag: "error"; message: string };

export default function ReciproIntegrationPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>({ tag: "loading" });
  const [displayId, setDisplayId] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  // 初回: 連携状態を読み込む
  useEffect(() => {
    if (!user) return;
    getReciproIntegration(user.uid)
      .then((data) => {
        if (data?.enabled) {
          setPhase({ tag: "connected", storeName: data.reciprocalStoreName });
        } else {
          setPhase({ tag: "disconnected" });
        }
      })
      .catch(() => setPhase({ tag: "disconnected" }));
  }, [user]);

  const handleConnect = async () => {
    if (!user || !displayId.trim() || !password) return;
    setLoginLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/recipro/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          displayId: displayId.trim(),
          password,
          companyId: user.uid,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase({
          tag: "error",
          message: data.error ?? "連携に失敗しました",
        });
        return;
      }
      const stores: Array<{ id: string; name: string }> = data.stores ?? [];
      setSelectedStoreId(stores[0]?.id ?? "");
      setPassword("");
      setPhase({ tag: "choosing_store", customerId: data.customerId, stores });
    } catch {
      setPhase({ tag: "error", message: "通信エラーが発生しました" });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleConfirmStore = async () => {
    if (phase.tag !== "choosing_store" || !user || !selectedStoreId) return;
    const store = phase.stores.find((s) => s.id === selectedStoreId);
    if (!store) return;

    setConfirmLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/recipro/confirm-store", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyId: user.uid,
          storeId: RECIPRO_LOCAL_STORE_ID,
          customerId: phase.customerId,
          reciprocalStoreId: store.id,
          reciprocalStoreName: store.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase({ tag: "error", message: data.error ?? "保存に失敗しました" });
        return;
      }
      setPhase({ tag: "connected", storeName: store.name });
    } catch {
      setPhase({ tag: "error", message: "通信エラーが発生しました" });
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setDisconnectLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/recipro/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId: user.uid }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPhase({ tag: "error", message: data.error ?? "解除に失敗しました" });
        return;
      }
      setShowDisconnectConfirm(false);
      setPhase({ tag: "disconnected" });
    } catch {
      setPhase({ tag: "error", message: "通信エラーが発生しました" });
    } finally {
      setDisconnectLoading(false);
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-800 transition-colors"
          >
            ‹
          </button>
          <h1 className="text-xl font-bold text-gray-900">レシプロ連携設定</h1>
        </div>

        {/* loading */}
        {phase.tag === "loading" && (
          <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center justify-center">
            <span className="h-5 w-5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        )}

        {/* disconnected */}
        {phase.tag === "disconnected" && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-700">現在未接続です</p>
            <p className="text-xs text-gray-500">
              レシプロ本体と連携すると、食材マスタをレシプロへ反映できます。
            </p>
            <button
              type="button"
              onClick={() => setPhase({ tag: "form_login" })}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#E85D2C" }}
            >
              レシプロ本体と連携する
            </button>
          </div>
        )}

        {/* form_login */}
        {phase.tag === "form_login" && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-700">
              Recipro本部ユーザーでログインしてください
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={displayId}
                onChange={(e) => setDisplayId(e.target.value)}
                placeholder="displayID（例: user001）"
                autoCapitalize="none"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:border-transparent"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード"
                onKeyDown={(e) => { if (e.key === "Enter") handleConnect(); }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setPhase({ tag: "disconnected" }); setPassword(""); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConnect}
                disabled={loginLoading || !displayId.trim() || !password}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: "#E85D2C" }}
              >
                {loginLoading ? "確認中..." : "連携する"}
              </button>
            </div>
          </div>
        )}

        {/* choosing_store */}
        {phase.tag === "choosing_store" && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-700">接続先店舗を選択してください</p>
            {phase.stores.length === 1 ? (
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-sm font-medium text-gray-800">{phase.stores[0].name}</p>
              </div>
            ) : (
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:border-transparent"
              >
                {phase.stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPhase({ tag: "form_login" })}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={handleConfirmStore}
                disabled={confirmLoading || !selectedStoreId}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: "#E85D2C" }}
              >
                {confirmLoading ? "保存中..." : "この店舗と連携する"}
              </button>
            </div>
          </div>
        )}

        {/* connected */}
        {phase.tag === "connected" && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-xl">✅</span>
              <p className="text-sm font-semibold text-gray-800">接続済み</p>
            </div>
            <p className="text-sm text-gray-600">
              連携先：<span className="font-medium text-gray-900">{phase.storeName}</span>
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { setPhase({ tag: "form_login" }); }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border text-gray-700 hover:bg-gray-50 transition-colors"
                style={{ borderColor: "#E85D2C", color: "#E85D2C" }}
              >
                再接続
              </button>
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(true)}
                className="w-full py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                接続解除
              </button>
            </div>
          </div>
        )}

        {/* error */}
        {phase.tag === "error" && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <p className="text-sm font-semibold text-red-600">エラーが発生しました</p>
            <p className="text-sm text-gray-700">{phase.message}</p>
            <button
              type="button"
              onClick={() => setPhase({ tag: "disconnected" })}
              className="w-full py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              最初から
            </button>
          </div>
        )}

        {/* 接続解除確認ダイアログ */}
        {showDisconnectConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
              <p className="text-sm font-semibold text-gray-900">接続を解除しますか？</p>
              <p className="text-xs text-gray-500">
                解除後はレシプロへの反映ができなくなります。再接続するにはDisplayIDとパスワードが必要です。
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDisconnectConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnectLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 disabled:opacity-40"
                >
                  {disconnectLoading ? "解除中..." : "解除する"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
