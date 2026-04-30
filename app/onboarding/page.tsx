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
  getGeneralSettings,
  savePriceMode,
} from "@/lib/firestore";
import { compressImage } from "@/lib/imageUtils";
import { applyPriceMode } from "@/lib/priceUtils";
import type { AiWorkflowResult, PriceMode } from "@/types";
import MultiImageUploadPanel from "@/components/MultiImageUploadPanel";
import MultiImageAnalyzeProgress from "@/components/MultiImageAnalyzeProgress";
import PriceModeModal from "@/components/PriceModeModal";
import { IconDoneAll, IconLinkCamera, IconLink, IconEditDocumentNew } from "@/components/icons";

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
const INGREDIENT_UNITS = ["kg", "g", "個", "L", "ml", "本", "袋", "ケース", "パック", "枚", "cc"] as const;

function makeTmpId(i: number) {
  return `tmp_${Date.now()}_${i}`;
}

function toDraft(name: string, price: number, confidence: number, i: number): DraftProduct {
  return { tmpId: makeTmpId(i), name, price, confidence, isEditing: false, editName: name, editPrice: String(price) };
}

function normalizeForMerge(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s　]/g, "")
    .replace(/[ァ-ン]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

function mergeIngredients(existing: DraftIngredient[], incoming: DraftIngredient[]): DraftIngredient[] {
  const result = [...existing];
  for (const item of incoming) {
    const key = normalizeForMerge(item.name);
    const idx = result.findIndex((x) => normalizeForMerge(x.name) === key);
    if (idx >= 0) {
      result[idx] = {
        ...result[idx],
        price: item.price,
        supplier: item.supplier ?? result[idx].supplier,
        confidence: Math.max(result[idx].confidence, item.confidence),
      };
    } else {
      result.push(item);
    }
  }
  return result;
}

function mergeProducts(existing: DraftProduct[], incoming: DraftProduct[]): DraftProduct[] {
  const result = [...existing];
  for (const item of incoming) {
    const key = item.name.trim().toLowerCase().replace(/[\s　]/g, "");
    const idx = result.findIndex(
      (x) => x.name.trim().toLowerCase().replace(/[\s　]/g, "") === key
    );
    if (idx >= 0) {
      result[idx] = {
        ...result[idx],
        price: item.price,
        confidence: Math.max(result[idx].confidence, item.confidence),
      };
    } else {
      result.push({ ...item, tmpId: makeTmpId(result.length) });
    }
  }
  return result;
}

// ─── Page ────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const initChecked = useRef(false);

  // Step 1 — 複数枚対応
  const cam1 = useRef<HTMLInputElement>(null);
  const file1Multi = useRef<HTMLInputElement>(null);
  const [s1Loading, setS1Loading] = useState(false);
  const [s1MultiProgress, setS1MultiProgress] = useState<{ current: number; total: number } | null>(null);
  const [s1Items, setS1Items] = useState<DraftIngredient[]>([]);
  const [s1AnalyzedCount, setS1AnalyzedCount] = useState(0);
  const [s1FailedCount, setS1FailedCount] = useState(0);
  const [s1Saved, setS1Saved] = useState(false);
  const [s1SavedCount, setS1SavedCount] = useState(0);
  const [s1Saving, setS1Saving] = useState(false);
  const [s1Error, setS1Error] = useState("");
  const [s1ManualMode, setS1ManualMode] = useState(false);
  const [s1ManualName, setS1ManualName] = useState("");
  const [s1ManualUnit, setS1ManualUnit] = useState("個");
  const [s1ManualPrice, setS1ManualPrice] = useState("");

  // Step 2
  const cam2 = useRef<HTMLInputElement>(null);
  const file2Multi = useRef<HTMLInputElement>(null);
  const [s2Method, setS2Method] = useState<MenuMethod>("photo");
  const [s2Loading, setS2Loading] = useState(false);
  const [s2PhotoProgress, setS2PhotoProgress] = useState<{ current: number; total: number } | null>(null);
  const [s2PhotoAnalyzedCount, setS2PhotoAnalyzedCount] = useState(0);
  const [s2PhotoFailedCount, setS2PhotoFailedCount] = useState(0);
  const [s2Urls, setS2Urls] = useState<string[]>([]);
  const [s2UrlInput, setS2UrlInput] = useState("");
  const [s2UrlProgress, setS2UrlProgress] = useState<{ current: number; total: number } | null>(null);
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

  // Price mode
  const [priceModeModal, setPriceModeModal] = useState(false);
  const [priceMode, setPriceMode] = useState<PriceMode | null>(null);
  const priceModeChecked = useRef(false);

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
  }, [user, router]);

  useEffect(() => {
    if (step !== 2 || !user || priceModeChecked.current) return;
    priceModeChecked.current = true;
    getGeneralSettings(user.uid).then((s) => {
      if (!s?.priceMode) {
        setPriceModeModal(true);
      } else {
        setPriceMode(s.priceMode);
      }
    });
  }, [step, user]);

  const handleSkip = async () => {
    if (!user) return;
    await skipOnboarding(user.uid).catch(console.error);
    router.replace("/");
  };

  const handlePriceModeSelect = async (mode: PriceMode) => {
    if (!user) return;
    await savePriceMode(user.uid, mode).catch(console.error);
    setPriceMode(mode);
    setPriceModeModal(false);
  };

  // ── Step 1: 食材マスター（単発カメラ）─────────────────────
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
      const newItems: DraftIngredient[] = result.items.map((item) => ({
        name: item.name,
        kana: item.ingredientNameKana,
        price: item.price,
        unit: item.unit,
        quantity: item.quantity,
        supplier: item.supplier,
        confidence: item.confidence,
        selected: true,
      }));
      setS1Items((prev) => mergeIngredients(prev, newItems));
      setS1AnalyzedCount((prev) => prev + 1);
    } catch {
      setS1Error("通信エラーが発生しました");
    } finally {
      setS1Loading(false);
    }
  };

  // ── Step 1: 複数枚選択 ────────────────────────────────────
  const handleS1MultiFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !user) return;
    setS1Error("");
    let successCount = 0;
    let failCount = 0;
    let localItems: DraftIngredient[] = [];

    for (let i = 0; i < files.length; i++) {
      setS1MultiProgress({ current: i + 1, total: files.length });
      try {
        const img = await compressImage(files[i]);
        const token = await user.getIdToken();
        const res = await fetch("/api/ai/workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ imageBase64: img, companyId, source: "receipt" }),
        });
        if (res.status === 429) {
          setS1Error("本日の解析上限に達しました");
          failCount += files.length - i;
          break;
        }
        if (!res.ok) { failCount++; continue; }
        const result = (await res.json()) as AiWorkflowResult;
        if (!result.items.length) { failCount++; continue; }
        const newItems: DraftIngredient[] = result.items.map((item) => ({
          name: item.name,
          kana: item.ingredientNameKana,
          price: item.price,
          unit: item.unit,
          quantity: item.quantity,
          supplier: item.supplier,
          confidence: item.confidence,
          selected: true,
        }));
        localItems = mergeIngredients(localItems, newItems);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setS1MultiProgress(null);
    if (localItems.length > 0) {
      setS1Items((prev) => mergeIngredients(prev, localItems));
      setS1AnalyzedCount((prev) => prev + successCount);
    }
    setS1FailedCount((prev) => prev + failCount);

    if (failCount > 0 && successCount === 0) {
      setS1Error("すべての伝票の解析に失敗しました");
    } else if (failCount > 0) {
      setS1Error(`${failCount}枚の解析に失敗しました。成功した分は表示されています`);
    }
  };

  // ── Step 1: 手入力追加 ────────────────────────────────────
  const handleS1ManualAdd = () => {
    const name = s1ManualName.trim();
    const price = Number(s1ManualPrice);
    if (!name || !Number.isFinite(price) || price < 1) return;
    const newItem: DraftIngredient = {
      name,
      unit: s1ManualUnit,
      price,
      confidence: 1.0,
      selected: true,
    };
    setS1Items((prev) => mergeIngredients(prev, [newItem]));
    setS1ManualName("");
    setS1ManualPrice("");
    setS1ManualMode(false);
  };

  const toggleS1Item = (i: number) => {
    setS1Items((prev) => prev.map((item, idx) => idx === i ? { ...item, selected: !item.selected } : item));
  };

  const handleS1Save = async () => {
    if (!user) return;
    const selected = s1Items.filter((i) => i.selected);
    if (selected.length === 0) {
      setStep(2);
      return;
    }
    setS1Saving(true);
    setS1Error("");
    try {
      await Promise.all(selected.map((item, idx) =>
        addIngredient(companyId, {
          uniqueId: `${companyId.slice(0, 8)}_ob_${Date.now()}_${idx}`,
          ingredientName: item.name,
          ingredientNameKana: item.kana ?? item.name,
          nameNormalized: normalizeForMerge(item.name),
          unit: item.unit,
          currentPrice: item.price,
          ...(item.quantity !== undefined && { quantity: item.quantity }),
          ...(item.supplier && { supplier: item.supplier }),
        })
      ));
      await completeOnboardingStep(companyId, "ingredientMaster");
      setS1SavedCount(selected.length);
      setS1Saved(true);
    } catch {
      setS1Error("保存に失敗しました。再度お試しください");
    } finally {
      setS1Saving(false);
    }
  };

  // ── Step 2: 単発カメラ撮影 ─────────────────────────────────
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
      if (!items.length) { setS2Error("メニューを読み取れませんでした。別の方法をお試しください"); return; }
      setS2Products((prev) => mergeProducts(prev, items));
      setS2PhotoAnalyzedCount((prev) => prev + 1);
    } catch {
      setS2Error("通信エラーが発生しました");
    } finally {
      setS2Loading(false);
    }
  };

  // ── Step 2: 複数枚メニュー写真 ────────────────────────────
  const handleS2MultiPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !user) return;
    setS2Error("");
    setS2Loading(true);
    let successCount = 0;
    let failCount = 0;
    let localItems: DraftProduct[] = [];

    for (let i = 0; i < files.length; i++) {
      setS2PhotoProgress({ current: i + 1, total: files.length });
      try {
        const img = await compressImage(files[i]);
        const token = await user.getIdToken();
        const res = await fetch("/api/ai/workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ imageBase64: img, companyId, source: "menu" }),
        });
        if (res.status === 429) {
          setS2Error("本日の解析上限に達しました");
          failCount += files.length - i;
          break;
        }
        if (!res.ok) { failCount++; continue; }
        const result = (await res.json()) as AiWorkflowResult;
        const items = result.menuCandidates
          .filter((c) => (c.estimatedPrice ?? 0) > 0)
          .map((c, j) => toDraft(c.name, c.estimatedPrice ?? 0, c.confidence, j));
        if (!items.length) { failCount++; continue; }
        localItems = mergeProducts(localItems, items);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setS2PhotoProgress(null);
    setS2Loading(false);
    if (localItems.length > 0) {
      setS2Products((prev) => mergeProducts(prev, localItems));
      setS2PhotoAnalyzedCount((prev) => prev + successCount);
    }
    setS2PhotoFailedCount((prev) => prev + failCount);

    if (failCount > 0 && successCount === 0) {
      setS2Error("メニューを読み取れませんでした。別の方法をお試しください");
    } else if (failCount > 0) {
      setS2Error(`${failCount}枚の解析に失敗しました`);
    }
  };

  // ── Step 2: URL追加・削除 ──────────────────────────────────
  const handleS2AddUrl = () => {
    const url = s2UrlInput.trim();
    if (!url) return;
    setS2Urls((prev) => [...prev, url]);
    setS2UrlInput("");
  };

  const handleS2RemoveUrl = (idx: number) => {
    setS2Urls((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Step 2: URL一括処理 ────────────────────────────────────
  const handleS2ProcessUrls = async () => {
    if (!user) return;
    const urlList = s2UrlInput.trim()
      ? [...s2Urls, s2UrlInput.trim()]
      : [...s2Urls];
    if (!urlList.length) return;
    if (s2UrlInput.trim()) {
      setS2Urls(urlList);
      setS2UrlInput("");
    }
    setS2Error("");
    setS2Loading(true);
    let localItems: DraftProduct[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urlList.length; i++) {
      setS2UrlProgress({ current: i + 1, total: urlList.length });
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/menu/extract-from-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: urlList[i], companyId }),
        });
        if (!res.ok) { failCount++; continue; }
        const data = (await res.json()) as { products: Array<{ name: string; price: number; confidence: number }> };
        if (!data.products.length) { failCount++; continue; }
        const items = data.products.map((p, j) => toDraft(p.name, p.price, p.confidence, j));
        localItems = mergeProducts(localItems, items);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setS2UrlProgress(null);
    setS2Loading(false);
    if (localItems.length > 0) {
      setS2Products((prev) => mergeProducts(prev, localItems));
    }

    if (failCount > 0 && successCount === 0) {
      setS2Error("URLからの読み取りに失敗しました。別の方法をお試しください");
    } else if (failCount > 0) {
      setS2Error(`${failCount}件のURLの読み取りに失敗しました`);
    } else if (!localItems.length) {
      setS2Error("メニューを読み取れませんでした");
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

  // ── Step 3 ────────────────────────────────────────────────

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
            price: applyPriceMode(p.price, priceMode ?? "taxExcluded"),
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

  // ── Step 4 ────────────────────────────────────────────────

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

        <StepIndicator current={step} />

        {/* ─── Step 1 ─────────────────────────────────── */}
        {step === 1 && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-semibold text-primary">Step 1</p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">食材マスターを作成</h2>
              <p className="mt-1 text-sm text-gray-600">
                お持ちの仕入伝票を撮影してください。複数枚まとめて選択も可能です。
              </p>
            </div>

            {/* 保存完了 */}
            {s1Saved ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4 text-center">
                <IconDoneAll size={64} className="text-green-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {s1SavedCount}件の食材マスタができました
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    完璧じゃなくて大丈夫です。後でいつでも食材を追加できます。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full min-h-12 rounded-xl font-bold text-white"
                  style={{ backgroundColor: PRIMARY }}
                >
                  次へ
                </button>
              </div>

            /* 複数枚処理中 */
            ) : s1MultiProgress ? (
              <MultiImageAnalyzeProgress
                current={s1MultiProgress.current}
                total={s1MultiProgress.total}
                label={`${s1MultiProgress.total}枚の伝票を処理中...`}
              />

            /* 単発解析中 */
            ) : s1Loading ? (
              <LoadingCard label="伝票を解析しています..." />

            /* 累積リスト表示 */
            ) : s1Items.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
                {/* サマリー */}
                <div className="rounded-xl bg-orange-50 border border-orange-200 px-3 py-2.5">
                  <p className="text-sm font-bold text-gray-800">
                    {s1AnalyzedCount > 1
                      ? `${s1AnalyzedCount}枚の伝票から、合計${s1Items.length}件の食材を読み取りました`
                      : `合計 ${s1Items.length} 件の食材を読み取りました`}
                  </p>
                  {s1FailedCount > 0 && (
                    <p className="text-xs text-amber-600 mt-0.5">{s1FailedCount}件解析失敗</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">他にも仕入伝票はありますか？</p>
                </div>

                {/* 食材リスト */}
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {s1Items.map((item, i) => (
                    <label
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleS1Item(i)}
                        className="h-4 w-4 accent-[#E85D2C] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          {item.unit} · {item.price.toLocaleString()}円
                          {item.supplier ? ` · ${item.supplier}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </label>
                  ))}
                </div>

                {s1Error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{s1Error}</p>}

                {/* 追加アップロード（コンパクト） */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500">別の伝票を追加</p>
                  <MultiImageUploadPanel
                    cameraRef={cam1}
                    multiRef={file1Multi}
                    onCameraChange={handleS1File}
                    onMultiChange={handleS1MultiFile}
                    onManualClick={() => setS1ManualMode(true)}
                    compact
                  />
                </div>

                {/* 手入力フォーム */}
                {s1ManualMode && (
                  <S1ManualForm
                    name={s1ManualName}
                    unit={s1ManualUnit}
                    price={s1ManualPrice}
                    onNameChange={setS1ManualName}
                    onUnitChange={setS1ManualUnit}
                    onPriceChange={setS1ManualPrice}
                    onAdd={handleS1ManualAdd}
                    onCancel={() => setS1ManualMode(false)}
                  />
                )}

                {/* 次へ進む */}
                <button
                  type="button"
                  onClick={handleS1Save}
                  disabled={s1Saving || s1Items.filter((x) => x.selected).length === 0}
                  className="w-full min-h-12 rounded-xl font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {s1Saving && <Spinner />}
                  {s1Saving
                    ? "保存中..."
                    : `${s1Items.filter((x) => x.selected).length}件を保存して次へ進む`}
                </button>
              </div>

            /* 初期アップロードUI */
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                <MultiImageUploadPanel
                  cameraRef={cam1}
                  multiRef={file1Multi}
                  onCameraChange={handleS1File}
                  onMultiChange={handleS1MultiFile}
                  onManualClick={() => setS1ManualMode(true)}
                />

                {s1ManualMode && (
                  <S1ManualForm
                    name={s1ManualName}
                    unit={s1ManualUnit}
                    price={s1ManualPrice}
                    onNameChange={setS1ManualName}
                    onUnitChange={setS1ManualUnit}
                    onPriceChange={setS1ManualPrice}
                    onAdd={handleS1ManualAdd}
                    onCancel={() => setS1ManualMode(false)}
                  />
                )}

                {s1Error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{s1Error}</p>}
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full text-sm text-gray-400 underline pt-1"
                >
                  伝票がない場合はスキップ
                </button>
              </div>
            )}
          </section>
        )}

        {/* ─── Step 2 ─────────────────────────────────── */}
        {step === 2 && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-semibold text-primary">Step 2</p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">メニューを取り込む</h2>
              <p className="mt-1 text-sm text-gray-600">
                店舗メニュー表の写真、またはメニューURLを入力してください。
              </p>
            </div>

            {/* タブ */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
              {(["photo", "url", "manual"] as MenuMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setS2Method(m); setS2Error(""); }}
                  className="flex-1 py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: s2Method === m ? PRIMARY : "white",
                    color: s2Method === m ? "white" : "#666",
                  }}
                >
                  {m === "photo" ? (
                    <><IconLinkCamera size={16} />写真</>
                  ) : m === "url" ? (
                    <><IconLink size={16} />URL</>
                  ) : (
                    <><IconEditDocumentNew size={16} />手入力</>
                  )}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              {/* 写真タブ */}
              {s2Method === "photo" && (
                s2PhotoProgress ? (
                  <MultiImageAnalyzeProgress
                    current={s2PhotoProgress.current}
                    total={s2PhotoProgress.total}
                    label={`${s2PhotoProgress.total}枚のメニュー写真を処理中...`}
                  />
                ) : s2Loading ? (
                  <LoadingCard label="メニューを解析しています..." />
                ) : (
                  <MultiImageUploadPanel
                    cameraRef={cam2}
                    multiRef={file2Multi}
                    onCameraChange={handleS2Photo}
                    onMultiChange={handleS2MultiPhoto}
                    cameraLabel="メニューを撮影する"
                    multiLabel="メニュー写真から複数選ぶ"
                  />
                )
              )}

              {/* URLタブ */}
              {s2Method === "url" && (
                s2UrlProgress ? (
                  <MultiImageAnalyzeProgress
                    current={s2UrlProgress.current}
                    total={s2UrlProgress.total}
                    label={`${s2UrlProgress.total}件のURLを処理中...`}
                  />
                ) : s2Loading ? (
                  <LoadingCard label="URLからメニューを読み取っています..." />
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">メニューURL</label>
                      <p className="text-xs text-gray-500 mb-2">
                        ぐるなび・食べログ等のメニューページURLを入力してください
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={s2UrlInput}
                          onChange={(e) => setS2UrlInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleS2AddUrl(); }}
                          placeholder="https://example-restaurant.jp/menu"
                          className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={handleS2AddUrl}
                          disabled={!s2UrlInput.trim()}
                          className="px-3 py-2.5 rounded-xl font-bold text-white disabled:opacity-40 shrink-0"
                          style={{ backgroundColor: PRIMARY }}
                        >
                          追加
                        </button>
                      </div>
                    </div>

                    {/* URLリスト */}
                    {s2Urls.length > 0 && (
                      <div className="space-y-1.5">
                        {s2Urls.map((url, i) => (
                          <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                            <span className="flex-1 text-xs text-gray-700 truncate">{url}</span>
                            <button
                              type="button"
                              onClick={() => handleS2RemoveUrl(i)}
                              className="text-xs text-gray-400 hover:text-red-500 shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 読み取りボタン */}
                    <button
                      type="button"
                      onClick={handleS2ProcessUrls}
                      disabled={!s2Urls.length && !s2UrlInput.trim()}
                      className="w-full min-h-12 rounded-xl font-bold text-white disabled:opacity-40"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      メニューを読み取る
                      {s2Urls.length > 0 && ` (${s2Urls.length + (s2UrlInput.trim() ? 1 : 0)}件)`}
                    </button>
                  </div>
                )
              )}

              {/* 手入力タブ */}
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
                <p className="text-sm font-semibold text-gray-700">
                  {s2PhotoAnalyzedCount > 1
                    ? `${s2PhotoAnalyzedCount}枚のメニュー写真から、合計${s2Products.length}件のメニューを読み取りました`
                    : `${s2Products.length}件のメニューを読み取りました`}
                  {s2PhotoFailedCount > 0 && (
                    <span className="text-xs text-amber-600 ml-2">{s2PhotoFailedCount}件解析失敗</span>
                  )}
                </p>
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

        {/* ─── Step 3 ─────────────────────────────────── */}
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

        {/* ─── Step 4 ─────────────────────────────────── */}
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
                <IconDoneAll size={64} className="text-green-500 mx-auto" />
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

      <PriceModeModal
        isOpen={priceModeModal}
        onClose={() => setPriceModeModal(false)}
        onSelect={handlePriceModeSelect}
      />
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────

function S1ManualForm({
  name, unit, price,
  onNameChange, onUnitChange, onPriceChange,
  onAdd, onCancel,
}: {
  name: string; unit: string; price: string;
  onNameChange: (v: string) => void;
  onUnitChange: (v: string) => void;
  onPriceChange: (v: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-4 space-y-3 bg-gray-50">
      <p className="text-xs font-semibold text-gray-600">手入力で追加</p>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">食材名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="例: 豚バラスライス"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 mb-1">単位</label>
          <select
            value={unit}
            onChange={(e) => onUnitChange(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            {INGREDIENT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 mb-1">単価 (円)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            placeholder="例: 580"
            min="1"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={!name.trim() || Number(price) < 1}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ backgroundColor: PRIMARY }}
        >
          追加
        </button>
      </div>
    </div>
  );
}

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
