"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  addIngredient,
  addProduct,
  updateProduct,
  getOnboardingSettings,
  initOnboarding,
  completeOnboardingStep,
  completeOnboarding,
  skipOnboarding,
} from "@/lib/firestore";
import type { AiWorkflowResult } from "@/types";

// ─── Local types ─────────────────────────────────────────

type DraftIngredient = {
  name: string;
  kana?: string;
  price: number;
  unit: string;
  quantity?: number;
  supplier?: string;
  confidence: number;
  selected: boolean;
};

type DraftProduct = {
  tmpId: string;
  name: string;
  price: number;
  confidence: number;
  isEditing: boolean;
  editName: string;
  editPrice: string;
};

type Step = 1 | 2 | 3 | 4;
type MenuMethod = "photo" | "url" | "manual";

const PRIMARY = "#E85D2C";

function makeTmpId(i: number) {
  return `tmp_${Date.now()}_${i}`;
}

function toDraft(name: string, price: number, confidence: number, i: number): DraftProduct {
  return { tmpId: makeTmpId(i), name, price, confidence, isEditing: false, editName: name, editPrice: String(price) };
}

// ─── Page ────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const initChecked = useRef(false);

  // Step 1
  const cam1 = useRef<HTMLInputElement>(null);
  const file1 = useRef<HTMLInputElement>(null);
  const [s1Loading, setS1Loading] = useState(false);
  const [s1Items, setS1Items] = useState<DraftIngredient[]>([]);
  const [s1Saving, setS1Saving] = useState(false);
  const [s1Error, setS1Error] = useState("");

  // Step 2
  const cam2 = useRef<HTMLInputElement>(null);
  const file2 = useRef<HTMLInputElement>(null);
  const [s2Method, setS2Method] = useState<MenuMethod>("photo");
  const [s2Loading, setS2Loading] = useState(false);
  const [s2Url, setS2Url] = useState("");
  const [s2ManualName, setS2ManualName] = useState("");
  const [s2ManualPrice, setS2ManualPrice] = useState("");
  const [s2Products, setS2Products] = useState<DraftProduct[]>([]);
  const [s2Error, setS2Error] = useState("");

  // Step 3
  const [s3Products, setS3Products] = useState<DraftProduct[]>([]);
  const [s3Saving, setS3Saving] = useState(false);
  const [s3Error, setS3Error] = useState("");

  // Step 4
  const [s4Done, setS4Done] = useState(false);
  const [s4Count, setS4Count] = useState(0);

  const companyId = user?.uid ?? "";

  // ── Init ────────────────────────────────────────────────
  useEffect(() => {
    if (!user || initChecked.current) return;
    initChecked.current = true;
    getOnboardingSettings(user.uid).then((s) => {
      if (s?.onboardingCompleted || s?.onboardingSkipped) {
        router.replace("/");
      } else if (!s) {
        initOnboarding(user.uid).catch(console.error);
      }
    });
  }, [user, router, initChecked]);

  const handleSkip = async () => {
    if (!user) return;
    await skipOnboarding(user.uid).catch(console.error);
    router.replace("/");
  };

  // ── Step 1: 食材マスター ─────────────────────────────────

  const handleS1File = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !user) return;
    setS1Error("");
    setS1Loading(true);
    try {
      const img = await compressImage(f);
      const token = await user.getIdToken();
      const res = await fetch("/api/ai/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: img, companyId, source: "receipt" }),
      });
      if (res.status === 429) { setS1Error("本日の解析上限に達しました"); return; }
      if (!res.ok) { setS1Error("解析に失敗しました。再度お試しください"); return; }
      const result = (await res.json()) as AiWorkflowResult;
      if (result.items.length === 0) { setS1Error("食材を読み取れませんでした。もう一度撮影してください"); return; }
      setS1Items(result.items.map((item) => ({
        name: item.name,
        kana: item.ingredientNameKana,
        price: item.price,
        unit: item.unit,
        quantity: item.quantity,
        supplier: item.supplier,
        confidence: item.confidence,
        selected: true,
      })));
    } catch {
      setS1Error("通信エラーが発生しました");
    } finally {
      setS1Loading(false);
    }
  };

  const toggleS1Item = (i: number) => {
    setS1Items((prev) => prev.map((item, idx) => idx === i ? { ...item, selected: !item.selected } : item));
  };

  const handleS1Save = async () => {
    if (!user) return;
    const selected = s1Items.filter((i) => i.selected);
    if (selected.length === 0) { setStep(2); return; }
    setS1Saving(true);
    setS1Error("");
    try {
      await Promise.all(selected.map((item, idx) =>
        addIngredient(companyId, {
          uniqueId: `${companyId.slice(0, 8)}_ob_${Date.now()}_${idx}`,
          ingredientName: item.name,
          ingredientNameKana: item.kana ?? item.name,
          nameNormalized: item.name.toLowerCase().replace(/[\s　]/g, ""),
          unit: item.unit,
          currentPrice: item.price,
          ...(item.quantity !== undefined && { quantity: item.quantity }),
          ...(item.supplier && { supplier: item.supplier }),
        })
      ));
      await completeOnboardingStep(companyId, "ingredientMaster");
      setStep(2);
    } catch {
      setS1Error("保存に失敗しました。再度お試しください");
    } finally {
      setS1Saving(false);
    }
  };

  // ── Step 2: メニュー取込 ─────────────────────────────────

  const handleS2Photo = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !user) return;
    setS2Error("");
    setS2Loading(true);
    try {
      const img = await compressImage(f);
      const token = await user.getIdToken();
      const res = await fetch("/api/ai/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: img, companyId, source: "menu" }),
      });
      if (res.status === 429) { setS2Error("本日の解析上限に達しました"); return; }
      if (!res.ok) { setS2Error("解析に失敗しました"); return; }
      const result = (await res.json()) as AiWorkflowResult;
      const items = result.menuCandidates
        .filter((c) => (c.estimatedPrice ?? 0) > 0)
        .map((c, i) => toDraft(c.name, c.estimatedPrice ?? 0, c.confidence, i));
      if (items.length === 0) { setS2Error("メニューを読み取れませんでした。別の方法をお試しください"); return; }
      setS2Products(items);
    } catch {
      setS2Error("通信エラーが発生しました");
    } finally {
      setS2Loading(false);
    }
  };

  const handleS2Url = async () => {
    if (!s2Url.trim() || !user) return;
    setS2Error("");
    setS2Loading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/menu/extract-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: s2Url.trim(), companyId }),
      });
      if (!res.ok) { setS2Error("URLからの読み取りに失敗しました。別の方法をお試しください"); return; }
      const data = (await res.json()) as { products: Array<{ name: string; price: number; confidence: number }> };
      if (data.products.length === 0) { setS2Error("メニューを読み取れませんでした"); return; }
      setS2Products(data.products.map((p, i) => toDraft(p.name, p.price, p.confidence, i)));
    } catch {
      setS2Error("通信エラーが発生しました");
    } finally {
      setS2Loading(false);
    }
  };

  const handleS2ManualAdd = () => {
    const name = s2ManualName.trim();
    const price = Number(s2ManualPrice);
    if (!name || !Number.isFinite(price) || price < 1) return;
    setS2Products((prev) => [...prev, toDraft(name, price, 1.0, prev.length)]);
    setS2ManualName("");
    setS2ManualPrice("");
  };

  const removeS2Product = (tmpId: string) => setS2Products((p) => p.filter((x) => x.tmpId !== tmpId));

  const goToStep3 = () => {
    setS3Products(s2Products);
    setStep(3);
  };

  // ── Step 3: 確認 ─────────────────────────────────────────

  const s3Delete = (tmpId: string) => setS3Products((p) => p.filter((x) => x.tmpId !== tmpId));

  const s3Edit = (tmpId: string) =>
    setS3Products((p) => p.map((x) => x.tmpId === tmpId ? { ...x, isEditing: true } : x));

  const s3UpdateField = (tmpId: string, field: "editName" | "editPrice", val: string) =>
    setS3Products((p) => p.map((x) => x.tmpId === tmpId ? { ...x, [field]: val } : x));

  const s3Confirm = (tmpId: string) =>
    setS3Products((p) => p.map((x) => {
      if (x.tmpId !== tmpId) return x;
      const name = x.editName.trim();
      const price = Number(x.editPrice);
      if (!name || !Number.isFinite(price) || price < 1) return { ...x, isEditing: false };
      return { ...x, name, price, isEditing: false };
    }));

  const handleS3Save = async () => {
    if (!user) return;
    if (s3Products.length === 0) {
      await skipOnboarding(user.uid).catch(console.error);
      router.replace("/");
      return;
    }
    setS3Saving(true);
    setS3Error("");
    try {
      await completeOnboardingStep(companyId, "menuImport");
      await completeOnboardingStep(companyId, "confirmation");
      const ids = await Promise.all(
        s3Products.map((p) =>
          addProduct(companyId, {
            name: p.name,
            nameKana: p.name,
            baseCost: 0,
            currentCost: 0,
            price: p.price,
            isEstimated: false,
            source: "user_confirmed",
          } as Parameters<typeof addProduct>[1])
        )
      );
      setS4Count(ids.length);
      setStep(4);
      runCostEstimation(ids, s3Products);
    } catch {
      setS3Error("保存に失敗しました。再度お試しください");
    } finally {
      setS3Saving(false);
    }
  };

  // ── Step 4: 原価推定 ──────────────────────────────────────

  const runCostEstimation = async (productIds: string[], products: DraftProduct[]) => {
    try {
      await Promise.all(
        productIds.map((id, i) => {
          const price = products[i]?.price ?? 0;
          const estimated = Math.round(price * 0.28);
          return updateProduct(companyId, id, {
            baseCost: estimated,
            currentCost: estimated,
            costSource: "estimated",
          });
        })
      );
      await completeOnboarding(companyId);
    } catch {
      await completeOnboarding(companyId).catch(console.error);
    } finally {
      setS4Done(true);
    }
  };

  // ── Render ───────────────────────────────────────────────

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">初期設定</p>
            <h1 className="text-xl font-bold text-gray-900">レシプロをはじめる</h1>
          </div>
          {step < 4 && (
            <button type="button" onClick={handleSkip} className="text-sm text-gray-400 underline underline-offset-2">
              スキップ
            </button>
          )}
        </div>

        {/* ステップインジケーター */}
        <StepIndicator current={step} />

        {/* Step 1 */}
        {step === 1 && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-semibold text-primary">Step 1</p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">食材マスターを作成</h2>
              <p className="mt-1 text-sm text-gray-600">
                まず最初に、仕入伝票を撮影して食材マスターを作成してください。
              </p>
            </div>

            {s1Loading ? (
              <LoadingCard label="伝票を解析しています..." />
            ) : s1Items.length > 0 ? (
              <>
                <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">
                    {s1Items.length}件の食材を読み取りました
                  </p>
                  <div className="space-y-2">
                    {s1Items.map((item, i) => (
                      <label key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleS1Item(i)}
                          className="h-4 w-4 accent-[#E85D2C]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.unit} · {item.price.toLocaleString()}円</p>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </label>
                    ))}
                  </div>
                  {s1Error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{s1Error}</p>}
                  <button
                    type="button"
                    onClick={handleS1Save}
                    disabled={s1Saving}
                    className="w-full min-h-12 rounded-xl font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {s1Saving && <Spinner />}
                    {s1Saving ? "保存中..." : `${s1Items.filter((x) => x.selected).length}件を保存して次へ`}
                  </button>
                  <button type="button" onClick={() => { setS1Items([]); setS1Error(""); }}
                    className="w-full text-sm text-gray-500 underline">
                    撮り直す
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => cam1.current?.click()}
                  className="w-full min-h-[160px] rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50 flex flex-col items-center justify-center gap-2 font-bold text-primary text-lg"
                >
                  <span className="text-4xl">📷</span>
                  タップして撮影
                </button>
                <button
                  type="button"
                  onClick={() => file1.current?.click()}
                  className="w-full rounded-xl border-2 border-primary bg-white py-3 font-bold text-primary"
                >
                  画像を選択
                </button>
                <input ref={cam1} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleS1File} />
                <input ref={file1} type="file" accept="image/*" className="hidden" onChange={handleS1File} />
                {s1Error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{s1Error}</p>}
                <button type="button" onClick={() => setStep(2)}
                  className="w-full text-sm text-gray-400 underline pt-1">
                  伝票がない場合はスキップ
                </button>
              </div>
            )}
          </section>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-semibold text-primary">Step 2</p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">メニューを取り込む</h2>
              <p className="mt-1 text-sm text-gray-600">
                店舗メニュー表の写真、または店舗URLを入力してください。
              </p>
            </div>

            {/* タブ */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
              {(["photo", "url", "manual"] as MenuMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setS2Method(m); setS2Error(""); }}
                  className="flex-1 py-2.5 text-sm font-bold transition-colors"
                  style={{
                    backgroundColor: s2Method === m ? PRIMARY : "white",
                    color: s2Method === m ? "white" : "#666",
                  }}
                >
                  {m === "photo" ? "📷 写真" : m === "url" ? "🔗 URL" : "✏️ 手入力"}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              {/* 写真 */}
              {s2Method === "photo" && (
                s2Loading ? <LoadingCard label="メニューを解析しています..." /> : (
                  <>
                    <button type="button" onClick={() => cam2.current?.click()}
                      className="w-full min-h-[120px] rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50 flex flex-col items-center justify-center gap-2 font-bold text-primary">
                      <span className="text-3xl">📷</span>
                      メニュー表を撮影
                    </button>
                    <button type="button" onClick={() => file2.current?.click()}
                      className="w-full rounded-xl border-2 border-primary bg-white py-3 font-bold text-primary">
                      画像を選択
                    </button>
                    <input ref={cam2} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleS2Photo} />
                    <input ref={file2} type="file" accept="image/*" className="hidden" onChange={handleS2Photo} />
                  </>
                )
              )}

              {/* URL */}
              {s2Method === "url" && (
                s2Loading ? <LoadingCard label="URLからメニューを読み取っています..." /> : (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-600">店舗URL</label>
                    <input
                      type="url"
                      value={s2Url}
                      onChange={(e) => setS2Url(e.target.value)}
                      placeholder="https://example-restaurant.jp"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={handleS2Url}
                      disabled={!s2Url.trim()}
                      className="w-full min-h-12 rounded-xl font-bold text-white disabled:opacity-40"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      メニューを読み取る
                    </button>
                  </div>
                )
              )}

              {/* 手入力 */}
              {s2Method === "manual" && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-600">商品名</label>
                  <input
                    type="text"
                    value={s2ManualName}
                    onChange={(e) => setS2ManualName(e.target.value)}
                    placeholder="例: 唐揚げ定食"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                  />
                  <label className="block text-xs font-semibold text-gray-600">販売価格 (円)</label>
                  <input
                    type="number"
                    value={s2ManualPrice}
                    onChange={(e) => setS2ManualPrice(e.target.value)}
                    placeholder="例: 850"
                    min="1"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleS2ManualAdd}
                    disabled={!s2ManualName.trim() || Number(s2ManualPrice) < 1}
                    className="w-full min-h-12 rounded-xl font-bold text-white disabled:opacity-40"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    追加
                  </button>
                </div>
              )}

              {s2Error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{s2Error}</p>}
            </div>

            {/* 取込済みプレビュー */}
            {s2Products.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">{s2Products.length}件のメニューを読み取りました</p>
                <div className="space-y-2">
                  {s2Products.slice(0, 6).map((p) => (
                    <div key={p.tmpId} className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.price.toLocaleString()}円</p>
                      </div>
                      <button type="button" onClick={() => removeS2Product(p.tmpId)}
                        className="text-xs text-gray-400 hover:text-red-500 shrink-0 px-1">✕</button>
                    </div>
                  ))}
                  {s2Products.length > 6 && (
                    <p className="text-xs text-gray-400">ほか {s2Products.length - 6} 件</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={goToStep3}
                  className="w-full min-h-12 rounded-xl font-bold text-white"
                  style={{ backgroundColor: PRIMARY }}
                >
                  次へ（確認画面）
                </button>
              </div>
            )}

            {s2Products.length === 0 && (
              <button type="button" onClick={goToStep3}
                className="w-full text-sm text-gray-400 underline pt-1">
                メニューを後で入力する場合はスキップ
              </button>
            )}
          </section>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-semibold text-primary">Step 3</p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">商品リストを確認</h2>
              <p className="mt-1 text-sm text-gray-600">こちらの商品リストでよろしいですか？</p>
            </div>

            {s3Products.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center space-y-3">
                <p className="text-gray-500 text-sm">商品が追加されていません</p>
                <button type="button" onClick={() => setStep(2)}
                  className="text-sm text-primary underline">
                  戻ってメニューを追加する
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {s3Products.map((p) => (
                  <div key={p.tmpId} className="bg-white rounded-2xl shadow-sm p-4">
                    {p.isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={p.editName}
                          onChange={(e) => s3UpdateField(p.tmpId, "editName", e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                          placeholder="商品名"
                        />
                        <input
                          type="number"
                          value={p.editPrice}
                          onChange={(e) => s3UpdateField(p.tmpId, "editPrice", e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                          placeholder="販売価格"
                          min="1"
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => {
                            s3UpdateField(p.tmpId, "editName", p.name);
                            s3UpdateField(p.tmpId, "editPrice", String(p.price));
                            setS3Products((prev) => prev.map((x) => x.tmpId === p.tmpId ? { ...x, isEditing: false } : x));
                          }}
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
                            キャンセル
                          </button>
                          <button type="button" onClick={() => s3Confirm(p.tmpId)}
                            className="flex-1 py-2 rounded-xl text-sm font-bold text-white"
                            style={{ backgroundColor: PRIMARY }}>
                            更新
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                          <p className="text-sm text-gray-500">{p.price.toLocaleString()}円</p>
                        </div>
                        <button type="button" onClick={() => s3Edit(p.tmpId)}
                          className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg shrink-0">
                          編集
                        </button>
                        <button type="button" onClick={() => s3Delete(p.tmpId)}
                          className="text-xs text-red-400 border border-red-200 px-2.5 py-1 rounded-lg shrink-0">
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {s3Error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{s3Error}</p>}

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleS3Save}
                disabled={s3Saving}
                className="w-full min-h-12 rounded-xl font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: PRIMARY }}
              >
                {s3Saving && <Spinner />}
                {s3Saving ? "保存中..." : s3Products.length > 0 ? `${s3Products.length}件を確定する` : "スキップして完了"}
              </button>
              {s3Products.length > 0 && (
                <button type="button" onClick={handleSkip}
                  className="w-full min-h-11 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-600">
                  あとで設定する
                </button>
              )}
            </div>
          </section>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-semibold text-primary">Step 4</p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">原価を推定しています</h2>
            </div>

            {!s4Done ? (
              <LoadingCard label="食材マスターと商品リストから原価を推定中です..." />
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4 text-center">
                <div className="text-4xl">🎉</div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">初期設定が完了しました！</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {s4Count > 0
                      ? `${s4Count}件の商品に仮原価を設定しました。`
                      : "設定が完了しました。"
                    }
                  </p>
                  <p className="mt-2 text-xs text-[#FFA000] font-semibold">
                    ※ 原価は推定値です。レシプロで正確な値に更新できます。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.replace("/")}
                  className="w-full min-h-12 rounded-xl font-bold text-white"
                  style={{ backgroundColor: PRIMARY }}
                >
                  ホームへ
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: "食材" },
    { n: 2, label: "メニュー" },
    { n: 3, label: "確認" },
    { n: 4, label: "原価" },
  ] as const;

  return (
    <div className="flex items-center gap-1">
      {steps.map(({ n, label }, i) => {
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: done ? "#0F9D58" : active ? PRIMARY : "#E5E7EB",
                  color: done || active ? "white" : "#9CA3AF",
                }}
              >
                {done ? "✓" : n}
              </div>
              <span className="text-[10px] mt-0.5" style={{ color: active ? PRIMARY : "#9CA3AF" }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="h-0.5 flex-1 mb-3" style={{ backgroundColor: done ? "#0F9D58" : "#E5E7EB" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-3">
      <span className="block h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <p className="text-sm text-gray-600 text-center">{label}</p>
      <p className="text-xs text-gray-400">そのままお待ちください</p>
    </div>
  );
}

function Spinner() {
  return <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />;
}

// ─── Image helpers ────────────────────────────────────────

async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let quality = 0.86;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (base64Bytes(dataUrl) > 1024 * 1024 && quality > 0.45) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function base64Bytes(dataUrl: string) {
  const b = dataUrl.split(",")[1] ?? "";
  return Math.ceil((b.length * 3) / 4);
}
