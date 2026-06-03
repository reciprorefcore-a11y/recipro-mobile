"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  getIngredients,
  updateIngredientPricesFromReceipt,
  addIngredient,
  addPriceHistory,
} from "@/lib/firestore";
import { compressImage } from "@/lib/imageUtils";
import { getNextMyCatalogId, isMobileIssuedId } from "@/lib/myCatalogIdGenerator";
import { findSimilarIngredient } from "@/lib/ingredientMatcher";
import type { ReceiptCsvInput } from "@/lib/csvGenerator";
import type {
  AiWorkflowResult,
  DetectedItem,
  Ingredient,
  MatchedItem,
} from "@/types";
import MultiImageUploadPanel from "@/components/MultiImageUploadPanel";
import MultiImageAnalyzeProgress from "@/components/MultiImageAnalyzeProgress";

const PRIMARY = "#E85D2C";
const UNITS = [
  "kg", "g", "個", "L", "ml", "本", "袋", "ケース", "パック", "枚", "cc",
] as const;

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function getEffectiveMyCatalogId(item: MatchedItem): string | undefined {
  return item.matchedIngredient?.myCatalogId ?? item.myCatalogId;
}

// ─── Page ────────────────────────────────────────────────

export default function ReceiptPage() {
  const { user } = useAuth();
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const multiFileRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const similarityResolverRef = useRef<((accepted: boolean) => void) | null>(null);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [assigningIds, setAssigningIds] = useState(false);
  const [multiProgress, setMultiProgress] = useState<{ current: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualUnit, setManualUnit] = useState("個");
  const [manualPrice, setManualPrice] = useState("");
  const [manualQuantity, setManualQuantity] = useState("1");
  const [similarityModal, setSimilarityModal] = useState<{
    newItemName: string;
    candidate: Ingredient;
  } | null>(null);

  const companyId = user?.uid ?? "";

  const allItemsHaveIds = useMemo(
    () =>
      !assigningIds &&
      matchedItems.length > 0 &&
      matchedItems.every((i) => !!getEffectiveMyCatalogId(i)),
    [assigningIds, matchedItems]
  );

  const selectedCount = useMemo(
    () => matchedItems.filter((i) => i.selected).length,
    [matchedItems]
  );

  useEffect(() => {
    if (!companyId) return;
    getIngredients(companyId)
      .then(setIngredients)
      .catch(() => setError("食材マスタの読み込みに失敗しました"));
  }, [companyId]);

  // ─ ID発行・類似チェック ─
  const processNewItems = async (items: MatchedItem[], ingList: Ingredient[]) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setAssigningIds(true);

    const updates = new Map<number, Partial<MatchedItem>>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.matchType !== "new" || item.myCatalogId) continue;

      const similar = findSimilarIngredient(item.name, ingList);
      if (similar) {
        const accepted = await new Promise<boolean>((resolve) => {
          setSimilarityModal({ newItemName: item.name, candidate: similar });
          similarityResolverRef.current = resolve;
        });
        setSimilarityModal(null);

        if (accepted) {
          updates.set(i, {
            matchedIngredient: similar,
            matchType: "exact",
            oldPrice: similar.currentPrice,
          });
          continue;
        }
      }

      const newId = await getNextMyCatalogId(companyId);
      updates.set(i, { myCatalogId: newId });
    }

    if (updates.size > 0) {
      setMatchedItems((current) =>
        current.map((item, i) =>
          updates.has(i) ? { ...item, ...updates.get(i)! } : item
        )
      );
    }

    setAssigningIds(false);
    processingRef.current = false;
  };

  // ─ 単発カメラ ─
  const handleCameraFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setError("");
    setLoading(true);
    try {
      const img = await compressImage(file);
      const token = await user.getIdToken();
      const res = await fetch("/api/ai/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: img, companyId, source: "receipt" }),
      });
      if (res.status === 429) { setError("本日の解析上限に達しました"); return; }
      if (!res.ok) { setError("解析に失敗しました。再度お試しください"); return; }
      const result = (await res.json()) as AiWorkflowResult;
      if (!result.items.length) { setError("食材を読み取れませんでした。もう一度撮影してください"); return; }
      const merged = mergeMatchedItems(matchedItems, matchDetectedItems(result.items, ingredients));
      setMatchedItems(merged);
      setAnalyzedCount((prev) => prev + 1);
      processNewItems(merged, ingredients);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // ─ 複数枚選択 ─
  const handleMultiFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !user) return;
    setError("");
    let success = 0;
    let fail = 0;
    let merged = matchedItems;

    for (let i = 0; i < files.length; i++) {
      setMultiProgress({ current: i + 1, total: files.length });
      try {
        const img = await compressImage(files[i]);
        const token = await user.getIdToken();
        const res = await fetch("/api/ai/workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ imageBase64: img, companyId, source: "receipt" }),
        });
        if (res.status === 429) {
          setError("本日の解析上限に達しました");
          fail += files.length - i;
          break;
        }
        if (!res.ok) { fail++; continue; }
        const result = (await res.json()) as AiWorkflowResult;
        if (!result.items.length) { fail++; continue; }
        merged = mergeMatchedItems(merged, matchDetectedItems(result.items, ingredients));
        success++;
      } catch {
        fail++;
      }
    }

    setMultiProgress(null);
    setMatchedItems(merged);
    setAnalyzedCount((prev) => prev + success);
    setFailedCount((prev) => prev + fail);
    if (fail > 0 && success === 0) {
      setError("すべての伝票の解析に失敗しました");
    } else if (fail > 0) {
      setError(`${fail}枚の解析に失敗しました。成功した分は表示されています`);
    }
    if (success > 0) {
      processNewItems(merged, ingredients);
    }
  };

  // ─ 手入力追加 ─
  const handleManualAdd = () => {
    const name = manualName.trim();
    const price = Number(manualPrice);
    const qty = Number(manualQuantity) || 1;
    if (!name || !Number.isFinite(price) || price < 1) return;
    const item: DetectedItem = { name, price, unit: manualUnit, quantity: qty, confidence: 1.0 };
    const merged = mergeMatchedItems(matchedItems, matchDetectedItems([item], ingredients));
    setMatchedItems(merged);
    setManualName("");
    setManualPrice("");
    setManualQuantity("1");
    setManualMode(false);
    processNewItems(merged, ingredients);
  };

  // ─ チェックボックス ─
  const toggleSelected = (index: number) => {
    setMatchedItems((items) =>
      items.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  // ─ 編集内容の更新 ─
  type ItemUpdate = Partial<
    Pick<MatchedItem, "name" | "unit" | "price" | "quantity" | "supplier" | "isEditing">
  >;
  const updateItem = (index: number, updates: ItemUpdate) => {
    setMatchedItems((items) =>
      items.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  // ─ 類似確認モーダル ─
  const handleSimilarityAccept = () => {
    similarityResolverRef.current?.(true);
    similarityResolverRef.current = null;
  };
  const handleSimilarityReject = () => {
    similarityResolverRef.current?.(false);
    similarityResolverRef.current = null;
  };

  // ─ 全確認して送信 ─
  const handleSubmitAll = async () => {
    if (!user || !allItemsHaveIds || selectedCount === 0) return;
    setSaving(true);
    setError("");

    try {
      const sanitizedId = sanitizeText(companyId);
      if (!sanitizedId) throw new Error("会社IDが取得できません");

      const selectedItems = matchedItems.filter((i) => i.selected);

      // 単価更新
      const priceUpdates = selectedItems
        .filter((i) => i.matchedIngredient?.myCatalogId)
        .map((i) => ({
          ingredient: i.matchedIngredient as Ingredient,
          newPrice: toFiniteNumber(i.price, `${i.name}の価格`),
        }));

      // 新規食材追加
      const newItems = selectedItems.filter(
        (i) => !i.matchedIngredient && i.myCatalogId
      );

      if (priceUpdates.length > 0) {
        await updateIngredientPricesFromReceipt(sanitizedId, priceUpdates);
      }

      if (newItems.length > 0) {
        const prefix = `${sanitizedId.slice(0, 8)}_${Date.now()}`;
        await Promise.all(
          newItems.map(async (item, idx) => {
            const ingredientId = await addIngredient(sanitizedId, {
              uniqueId: `${prefix}_${idx}`,
              myCatalogId: item.myCatalogId!,
              ingredientName: sanitizeText(item.name),
              ingredientNameKana: sanitizeText(item.ingredientNameKana) || sanitizeText(item.name),
              unit: item.unit,
              currentPrice: toFiniteNumber(item.price, `${item.name}の価格`),
              supplier: item.supplier,
            });
            await addPriceHistory(sanitizedId, {
              ingredientId,
              ingredientName: sanitizeText(item.name),
              price: toFiniteNumber(item.price, `${item.name}の価格`),
              source: "receipt_ai_new",
            });
          })
        );
      }

      // CSV生成・ダウンロード
      const csvItems: ReceiptCsvInput[] = selectedItems
        .flatMap((item) => {
          const id = getEffectiveMyCatalogId(item);
          if (!id) return [];
          const row: ReceiptCsvInput = {
            myCatalogId: id,
            ingredientName: sanitizeText(item.name),
            ingredientNameKana: item.ingredientNameKana,
            unit: item.unit,
            currentPrice: item.price,
            oldPrice: item.oldPrice,
            supplier: item.supplier,
          };
          return [row];
        });

      const token = await user.getIdToken();
      const csvRes = await fetch("/api/csv/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: csvItems }),
      });
      if (csvRes.ok) {
        const blob = await csvRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `伝票_${todayString()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      const parts: string[] = [];
      if (priceUpdates.length > 0) parts.push(`${priceUpdates.length}件更新`);
      if (newItems.length > 0) parts.push(`${newItems.length}件新規追加`);
      setDoneMessage((parts.join("、") || "0件") + "・CSVダウンロード完了");
      setSaving(false);
      window.setTimeout(() => router.push("/search"), 3000);
    } catch (err) {
      console.error("submit failed", err);
      setError("保存に失敗しました。再度お試しください");
      setSaving(false);
    }
  };

  // ─ Render ─
  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1 text-gray-500 hover:text-gray-700 font-medium">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-arrow-right.svg" alt="" width={16} height={16}
              style={{ filter: "brightness(0) opacity(0.5)", transform: "rotate(180deg)" }} />
            戻る
          </Link>
          <h1 className="text-xl font-bold">伝票を撮影</h1>
        </div>

        {/* ローディング（単発） */}
        {loading && (
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4 text-center">
            <span className="mx-auto block h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-gray-900">伝票を解析しています</h2>
              <p className="text-sm text-gray-500">そのままお待ちください</p>
            </div>
          </section>
        )}

        {/* 複数枚処理中 */}
        {!loading && multiProgress && (
          <MultiImageAnalyzeProgress
            current={multiProgress.current}
            total={multiProgress.total}
            label={`${multiProgress.total}枚の伝票を処理中...`}
          />
        )}

        {!loading && !multiProgress && (
          <>
            {/* アップロードセクション */}
            {!doneMessage && (
              <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                {analyzedCount > 0 && (
                  <p className="text-xs font-semibold text-gray-500">別の伝票を追加</p>
                )}
                <MultiImageUploadPanel
                  cameraRef={cameraRef}
                  multiRef={multiFileRef}
                  onCameraChange={handleCameraFile}
                  onMultiChange={handleMultiFile}
                  onManualClick={() => setManualMode((v) => !v)}
                  compact={analyzedCount > 0}
                />
                {analyzedCount === 0 && !manualMode && (
                  <div className="rounded-xl border border-gray-100 p-3 space-y-1">
                    <p className="text-xs font-semibold text-gray-600">撮影のコツ</p>
                    <ul className="space-y-0.5 text-xs text-gray-500">
                      <li>・明るい場所で撮影</li>
                      <li>・伝票全体を入れる</li>
                      <li>・まっすぐ撮影</li>
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* 手入力フォーム */}
            {manualMode && !doneMessage && (
              <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                <p className="text-sm font-bold text-gray-800">✏️ 手入力で追加</p>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">食材名</label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="例: 豚バラスライス"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">単位</label>
                    <select
                      value={manualUnit}
                      onChange={(e) => setManualUnit(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
                    >
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">単価 (円)</label>
                    <input
                      type="number"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                      placeholder="例: 580"
                      min="1"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">数量</label>
                  <input
                    type="number"
                    value={manualQuantity}
                    onChange={(e) => setManualQuantity(e.target.value)}
                    placeholder="1"
                    min="1"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setManualMode(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
                    キャンセル
                  </button>
                  <button type="button" onClick={handleManualAdd}
                    disabled={!manualName.trim() || Number(manualPrice) < 1}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                    style={{ backgroundColor: PRIMARY }}>
                    追加
                  </button>
                </div>
              </section>
            )}

            {/* サマリーバナー */}
            {analyzedCount > 0 && !doneMessage && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                <p className="text-sm font-bold text-gray-800">
                  {analyzedCount}枚の伝票から、合計{matchedItems.length}件の食材を読み取りました
                </p>
                {failedCount > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">{failedCount}件解析失敗</p>
                )}
              </div>
            )}

            {/* ID発行中バナー */}
            {assigningIds && !doneMessage && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
                <p className="text-sm text-blue-700 font-medium">新規食材のID発行中...</p>
              </div>
            )}

            {/* 解析結果リスト */}
            {matchedItems.length > 0 && !doneMessage && (
              <section className="space-y-3">
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <h2 className="text-base font-bold text-gray-900">解析結果</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    確認・編集してから「全て確認して送信」を押してください
                  </p>
                </div>

                {matchedItems.map((item, index) => (
                  <ResultItem
                    key={index}
                    item={item}
                    onToggle={() => toggleSelected(index)}
                    onUpdate={(updates) => updateItem(index, updates)}
                  />
                ))}

                <button
                  type="button"
                  onClick={handleSubmitAll}
                  disabled={saving || !allItemsHaveIds || selectedCount === 0}
                  className="w-full rounded-xl py-4 font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {saving && (
                    <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  )}
                  {saving
                    ? "保存・CSV生成中..."
                    : !allItemsHaveIds
                    ? "ID発行中..."
                    : selectedCount === 0
                    ? "食材を選択してください"
                    : `全て確認して送信 (${selectedCount}件)`}
                </button>
              </section>
            )}
          </>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>
        )}
        {doneMessage && (
          <p className="text-sm text-green-700 bg-green-50 rounded-xl p-3">
            ✅ {doneMessage}　食材一覧に移動します。
          </p>
        )}
      </div>

      {/* 類似食材確認モーダル */}
      {similarityModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-[480px] bg-white rounded-t-2xl p-6 space-y-4 pb-8">
            <h2 className="text-base font-bold text-text">食材の確認</h2>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">「{similarityModal.newItemName}」</span>
              は既存の食材と似ています。
            </p>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="text-xs text-sub-text">既存の食材</p>
              <p className="font-semibold text-text">
                {similarityModal.candidate.ingredientName}
              </p>
              <p className="text-xs text-sub-text">
                ID: {similarityModal.candidate.myCatalogId ?? "—"}
                {similarityModal.candidate.supplier ? ` ・ ${similarityModal.candidate.supplier}` : ""}
              </p>
            </div>
            <p className="text-sm text-gray-600">
              「{similarityModal.newItemName}」は「{similarityModal.candidate.ingredientName}」と同じ食材ですか？
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSimilarityReject}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-sub-text hover:bg-gray-50"
              >
                違う → 新規ID発行
              </button>
              <button
                onClick={handleSimilarityAccept}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: PRIMARY }}
              >
                同じ → 既存ID使用
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── ResultItem ──────────────────────────────────────────

type ItemUpdate = Partial<
  Pick<MatchedItem, "name" | "unit" | "price" | "quantity" | "supplier" | "isEditing">
>;

type ValidationErrors = Partial<Record<"name" | "unit" | "price" | "quantity", string>>;

function ResultItem({
  item,
  onToggle,
  onUpdate,
}: {
  item: MatchedItem;
  onToggle: () => void;
  onUpdate: (updates: ItemUpdate) => void;
}) {
  const [editName, setEditName] = useState(item.name);
  const [editUnit, setEditUnit] = useState(item.unit);
  const [editPrice, setEditPrice] = useState(String(item.price));
  const [editQuantity, setEditQuantity] = useState(String(item.quantity ?? 1));
  const [editSupplier, setEditSupplier] = useState(item.supplier ?? "");
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (item.isEditing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditName(item.name);
      setEditUnit(item.unit);
      setEditPrice(String(item.price));
      setEditQuantity(String(item.quantity ?? 1));
      setEditSupplier(item.supplier ?? "");
      setErrors({});
    }
  }, [item.isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = () => {
    const errs: ValidationErrors = {};
    if (!editName.trim()) errs.name = "食材名は必須です";
    if (!editUnit) errs.unit = "単位は必須です";
    const qty = Number(editQuantity);
    if (!Number.isFinite(qty) || qty < 1) errs.quantity = "1以上の整数";
    const price = Number(editPrice);
    if (!Number.isFinite(price) || price < 1) errs.price = "1以上の価格";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onUpdate({
      name: editName.trim(),
      unit: editUnit,
      price,
      quantity: Math.floor(qty),
      supplier: editSupplier.trim() || undefined,
      isEditing: false,
    });
  };

  const effectiveId = getEffectiveMyCatalogId(item);
  const isNew = !item.matchedIngredient || item.matchType === "new";
  const isMobileId = isMobileIssuedId(effectiveId);
  const hasChange = !isNew && item.oldPrice !== undefined && item.oldPrice !== item.price;
  const total = Math.floor(Number(editPrice || 0) * Number(editQuantity || 1));

  if (item.isEditing) {
    return (
      <article className="bg-orange-50 border-2 border-primary rounded-2xl p-4 space-y-3">
        <span className="text-xs text-primary font-semibold">編集中</span>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">食材名</label>
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
            placeholder="例: 豚バラスライス" />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">単位</label>
          <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white">
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          {errors.unit && <p className="text-xs text-red-500 mt-1">{errors.unit}</p>}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1">数量</label>
            <input type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)}
              min="1" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white" />
            {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>}
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1">単価 (円)</label>
            <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
              min="1" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white" />
            {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">仕入先 (任意)</label>
          <input type="text" value={editSupplier} onChange={(e) => setEditSupplier(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
            placeholder="例: 田中精肉店" />
        </div>
        <p className="text-sm text-gray-500">
          合計: <span className="font-bold text-gray-800">{total.toLocaleString()}円</span>
          <span className="text-xs ml-1">({editQuantity || 1} × {Number(editPrice || 0).toLocaleString()}円)</span>
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => onUpdate({ isEditing: false })}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            キャンセル
          </button>
          <button type="button" onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: PRIMARY }}>
            更新
          </button>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`bg-white rounded-2xl shadow-sm p-4 space-y-2.5 transition-opacity ${!item.selected ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.selected}
          onChange={onToggle}
          className="mt-1 h-5 w-5 accent-[#E85D2C] cursor-pointer shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900">{item.name}</h3>
            {effectiveId ? (
              isMobileId ? (
                <span className="text-xs font-bold text-white bg-blue-500 px-2 py-0.5 rounded-full">
                  新規追加 (ID: {effectiveId})
                </span>
              ) : (
                <span className="text-xs font-bold text-white bg-green-600 px-2 py-0.5 rounded-full">
                  単価更新
                </span>
              )
            ) : (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                ID発行中...
              </span>
            )}
            {item.confidence < 0.8 && (
              <span className="text-xs text-amber-600">⚠ 要確認</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {item.unit}
            {item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : ""}
            {item.supplier ? ` ・ ${item.supplier}` : ""}
            {!isMobileId && effectiveId ? ` ・ ID: ${effectiveId}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => onUpdate({ isEditing: true })}
          className="shrink-0 text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50">
          編集
        </button>
      </div>

      <div className={`rounded-xl px-3 py-2 text-sm font-bold ${
        isNew ? "text-blue-700 bg-blue-50"
        : hasChange ? "text-green-700 bg-green-50"
        : "text-gray-600 bg-gray-100"
      }`}>
        {isNew
          ? `新規 → ${item.price.toLocaleString()}円`
          : `${item.oldPrice?.toLocaleString() ?? "—"}円 → ${item.price.toLocaleString()}円（${hasChange ? "変更あり" : "変更なし"}）`}
      </div>
    </article>
  );
}

// ─── ヘルパー関数 ─────────────────────────────────────────

function mergeMatchedItems(existing: MatchedItem[], incoming: MatchedItem[]): MatchedItem[] {
  const result = [...existing];
  for (const item of incoming) {
    const key = normalizeName(item.name);
    const idx = result.findIndex((x) => normalizeName(x.name) === key);
    if (idx >= 0) {
      result[idx] = {
        ...result[idx],
        price: item.price,
        confidence: Math.max(result[idx].confidence, item.confidence),
      };
    } else {
      result.push(item);
    }
  }
  return result;
}

function matchDetectedItems(
  detectedItems: DetectedItem[],
  ingredients: Ingredient[]
): MatchedItem[] {
  return detectedItems.map((item) => {
    if (item.myCatalogId) {
      const catalogMatched = ingredients.find(
        (ing) => ing.myCatalogId === item.myCatalogId
      );
      if (catalogMatched) return toMatchedItem(item, catalogMatched, "exact");
    }

    const exact = ingredients.find(
      (ing) =>
        ing.ingredientName === item.name &&
        Boolean(item.ingredientNameKana) &&
        ing.ingredientNameKana === item.ingredientNameKana
    );
    if (exact) return toMatchedItem(item, exact, "exact");

    const normalizedName = normalizeName(item.name);
    const normalized = ingredients.find((ing) =>
      [ing.ingredientName, ing.ingredientNameKana]
        .map(normalizeName)
        .includes(normalizedName)
    );
    if (normalized) return toMatchedItem(item, normalized, "normalized");

    const partial = ingredients.find((ing) => {
      const candidates = [ing.ingredientName, ing.ingredientNameKana].map(normalizeName);
      return candidates.some(
        (c) =>
          c.length >= 2 &&
          normalizedName.length >= 2 &&
          (c.includes(normalizedName) || normalizedName.includes(c))
      );
    });
    if (partial) return toMatchedItem(item, partial, "partial");

    return { ...item, matchType: "new", selected: true, isEditing: false, quantity: item.quantity ?? 1 };
  });
}

function toMatchedItem(
  item: DetectedItem,
  ingredient: Ingredient,
  matchType: MatchedItem["matchType"]
): MatchedItem {
  return {
    ...item,
    matchedIngredient: ingredient,
    matchType,
    oldPrice: ingredient.currentPrice,
    selected: true,
    isEditing: false,
    quantity: item.quantity ?? 1,
  };
}

function normalizeName(value: string | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s　]/g, "")
    .replace(/[ァ-ン]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60)
    );
}

function sanitizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toFiniteNumber(value: unknown, label: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${label}が不正です`);
  }
  return num;
}
