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

// ─── Page ────────────────────────────────────────────────

export default function ReceiptPage() {
  const { user } = useAuth();
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const multiFileRef = useRef<HTMLInputElement>(null);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [multiProgress, setMultiProgress] = useState<{ current: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualUnit, setManualUnit] = useState("個");
  const [manualPrice, setManualPrice] = useState("");
  const [manualQuantity, setManualQuantity] = useState("1");

  const companyId = user?.uid ?? "";

  const selectedCount = useMemo(
    () => matchedItems.filter((i) => i.selected).length,
    [matchedItems]
  );
  const newSelectedCount = useMemo(
    () => matchedItems.filter((i) => i.selected && i.matchType === "new").length,
    [matchedItems]
  );
  const matchedSelectedCount = selectedCount - newSelectedCount;

  useEffect(() => {
    if (!companyId) return;
    getIngredients(companyId)
      .then((data) => setIngredients(data))
      .catch(() => setError("食材マスタの読み込みに失敗しました"));
  }, [companyId]);

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
      setMatchedItems((prev) => mergeMatchedItems(prev, matchDetectedItems(result.items, ingredients)));
      setAnalyzedCount((prev) => prev + 1);
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
        setMatchedItems((prev) => mergeMatchedItems(prev, matchDetectedItems(result.items, ingredients)));
        success++;
      } catch {
        fail++;
      }
    }

    setMultiProgress(null);
    setAnalyzedCount((prev) => prev + success);
    setFailedCount((prev) => prev + fail);
    if (fail > 0 && success === 0) {
      setError("すべての伝票の解析に失敗しました");
    } else if (fail > 0) {
      setError(`${fail}枚の解析に失敗しました。成功した分は表示されています`);
    }
  };

  // ─ 手入力追加 ─
  const handleManualAdd = () => {
    const name = manualName.trim();
    const price = Number(manualPrice);
    const qty = Number(manualQuantity) || 1;
    if (!name || !Number.isFinite(price) || price < 1) return;
    const item: DetectedItem = { name, price, unit: manualUnit, quantity: qty, confidence: 1.0 };
    setMatchedItems((prev) => mergeMatchedItems(prev, matchDetectedItems([item], ingredients)));
    setManualName("");
    setManualPrice("");
    setManualQuantity("1");
    setManualMode(false);
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

  // ─ 保存 ─
  const handleUpdate = async () => {
    const sanitizedCompanyId = sanitizeText(companyId);
    if (!sanitizedCompanyId) {
      setError("保存に失敗しました。会社IDを取得できません。再ログインしてください。");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const matchedUpdates = matchedItems
        .filter((item) => item.selected && item.matchedIngredient)
        .map((item) => ({
          ingredient: item.matchedIngredient as Ingredient,
          newPrice: toFiniteNumber(item.price, `${item.name}の価格`),
        }));

      const newItems = matchedItems
        .filter((item) => item.selected && item.matchType === "new")
        .map(sanitizeNewReceiptItem);

      if (matchedUpdates.length === 0 && newItems.length === 0) {
        setError("更新または追加する食材を選択してください");
        setSaving(false);
        return;
      }

      if (matchedUpdates.length > 0) {
        await updateIngredientPricesFromReceipt(sanitizedCompanyId, matchedUpdates);
      }

      if (newItems.length > 0) {
        const uniquePrefix = `${sanitizedCompanyId.slice(0, 8)}_${Date.now()}`;
        await Promise.all(
          newItems.map(async (item, idx) => {
            const uniqueId = `${uniquePrefix}_${idx}`;
            const ingredientId = await addIngredient(sanitizedCompanyId, {
              uniqueId,
              ingredientName: item.ingredientName,
              ingredientNameKana: item.ingredientNameKana,
              nameNormalized: item.nameNormalized,
              unit: item.unit,
              currentPrice: item.currentPrice,
              supplier: item.supplier,
            });
            await addPriceHistory(sanitizedCompanyId, {
              ingredientId,
              ingredientName: item.ingredientName,
              price: item.currentPrice,
              quantity: item.quantity,
              source: "receipt_ai_new",
            });
          })
        );
      }

      const parts: string[] = [];
      if (matchedUpdates.length > 0) parts.push(`${matchedUpdates.length}件更新`);
      if (newItems.length > 0) parts.push(`${newItems.length}件新規追加`);
      setDoneMessage(parts.join("、") + "しました");
      setSaving(false);
      window.setTimeout(() => router.push("/search"), 2500);
    } catch (err) {
      console.error("save failed", err);
      setError(`保存に失敗しました。再度お試しください。詳細: ${getErrorMessage(err)}`);
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

        {/* ── ローディング（単発） ── */}
        {loading && (
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4 text-center">
            <span className="mx-auto block h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-gray-900">伝票を解析しています</h2>
              <p className="text-sm text-gray-500">そのままお待ちください</p>
            </div>
          </section>
        )}

        {/* ── 複数枚処理中 ── */}
        {!loading && multiProgress && (
          <MultiImageAnalyzeProgress
            current={multiProgress.current}
            total={multiProgress.total}
            label={`${multiProgress.total}枚の伝票を処理中...`}
          />
        )}

        {/* ── 通常状態 ── */}
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

                {/* 撮影のコツ（初回のみ） */}
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
                  <button
                    type="button"
                    onClick={() => setManualMode(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleManualAdd}
                    disabled={!manualName.trim() || Number(manualPrice) < 1}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                    style={{ backgroundColor: PRIMARY }}
                  >
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

            {/* 解析結果リスト */}
            {matchedItems.length > 0 && !doneMessage && (
              <section className="space-y-3">
                <div className="bg-white rounded-2xl shadow-sm p-4 space-y-1">
                  <h2 className="text-lg font-bold text-gray-900">解析結果</h2>
                  <p className="text-sm text-gray-500">確認・編集してから保存してください</p>
                  {matchedItems.some((i) => i.matchType === "new") && (
                    <div className="mt-2 bg-green-50 rounded-xl px-3 py-2 flex items-start gap-2">
                      <span className="text-green-600 text-sm">✦</span>
                      <p className="text-xs text-green-700">
                        <span className="font-bold">新規追加</span>の食材は食材マスタに自動登録されます。単位・価格を確認してください。
                      </p>
                    </div>
                  )}
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
                  onClick={handleUpdate}
                  disabled={saving || selectedCount === 0}
                  className="w-full rounded-xl py-4 font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {saving && <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                  {saving ? "保存中..."
                    : selectedCount === 0 ? "項目を選択してください"
                    : buildButtonLabel(matchedSelectedCount, newSelectedCount)}
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

  const isNew = item.matchType === "new";
  const hasChange = !isNew && item.oldPrice !== undefined && item.oldPrice !== item.price;
  const total = Math.floor(Number(editPrice || 0) * Number(editQuantity || 1));

  if (item.isEditing) {
    return (
      <article className="bg-orange-50 border-2 border-primary rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          {isNew && (
            <span className="text-xs font-bold text-white bg-green-500 px-2 py-0.5 rounded-full">
              新規追加
            </span>
          )}
          <span className="text-xs text-primary font-semibold">編集中</span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">食材名</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
            placeholder="例: 豚バラスライス"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">単位</label>
          <select
            value={editUnit}
            onChange={(e) => setEditUnit(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          {errors.unit && <p className="text-xs text-red-500 mt-1">{errors.unit}</p>}
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1">数量</label>
            <input
              type="number"
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              min="1"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
              placeholder="1"
            />
            {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>}
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1">単価 (円)</label>
            <input
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              min="1"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
              placeholder="例: 580"
            />
            {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">仕入先 (任意)</label>
          <input
            type="text"
            value={editSupplier}
            onChange={(e) => setEditSupplier(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-primary bg-white"
            placeholder="例: 田中精肉店"
          />
        </div>

        <p className="text-sm text-gray-500">
          合計 (参考): <span className="font-bold text-gray-800">{total.toLocaleString()}円</span>
          <span className="text-xs ml-1">({editQuantity || 1} × {Number(editPrice || 0).toLocaleString()}円)</span>
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ isEditing: false })}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ backgroundColor: PRIMARY }}
          >
            更新
          </button>
        </div>
      </article>
    );
  }

  const statusClass = isNew
    ? "text-green-700 bg-green-50"
    : hasChange
    ? "text-blue-700 bg-blue-50"
    : "text-gray-600 bg-gray-100";

  const priceLabel = isNew
    ? `新規追加 → ${item.price.toLocaleString()}円`
    : `${item.oldPrice?.toLocaleString() ?? "—"}円 → ${item.price.toLocaleString()}円（${hasChange ? "変更あり" : "変更なし"}）`;

  return (
    <article
      className={`bg-white rounded-2xl shadow-sm p-4 space-y-3 transition-opacity ${
        !item.selected ? "opacity-50" : ""
      }`}
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
            {isNew && (
              <span className="text-xs font-bold text-white bg-green-500 px-2 py-0.5 rounded-full">
                新規追加
              </span>
            )}
            {item.confidence < 0.8 && (
              <span className="text-xs text-amber-600">⚠ 要確認</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {item.unit}
            {item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : ""}
            ・信頼度 {Math.round(item.confidence * 100)}%
            {item.supplier ? `・${item.supplier}` : ""}
          </p>
          {!isNew && item.matchedIngredient && (
            <p className="text-xs text-gray-400 mt-0.5">
              マッチ: {item.matchedIngredient.ingredientName}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onUpdate({ isEditing: true })}
          className="shrink-0 text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
        >
          編集
        </button>
      </div>

      <p className={`rounded-xl px-3 py-2 text-sm font-bold ${statusClass}`}>
        {priceLabel}
      </p>
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

function buildButtonLabel(matched: number, added: number): string {
  const parts: string[] = [];
  if (matched > 0) parts.push(`更新 ${matched}件`);
  if (added > 0) parts.push(`新規追加 ${added}件`);
  return `${parts.join(" + ")} を保存する`;
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
      const candidates = [
        ing.ingredientName, ing.ingredientNameKana,
      ].map(normalizeName);
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

type SanitizedNewReceiptItem = {
  ingredientName: string;
  ingredientNameKana: string;
  nameNormalized: string;
  unit: string;
  currentPrice: number;
  quantity: number | null;
  supplier: string;
};

function sanitizeNewReceiptItem(item: MatchedItem): SanitizedNewReceiptItem {
  const ingredientName = sanitizeText(item.name);
  if (!ingredientName) throw new Error("新規追加の食材名が空です");

  const ingredientNameKana = sanitizeText(item.ingredientNameKana) || ingredientName;
  const nameNormalized = normalizeName(ingredientName);
  const unit = sanitizeText(item.unit) || "個";
  const currentPrice = toFiniteNumber(item.price, `${ingredientName}の価格`);
  const quantity = toNullableFiniteNumber(item.quantity, `${ingredientName}の数量`);

  return {
    ingredientName,
    ingredientNameKana,
    nameNormalized,
    unit,
    currentPrice,
    quantity,
    supplier: sanitizeText(item.supplier),
  };
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

function toNullableFiniteNumber(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  return toFiniteNumber(value, label);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "原因不明のエラー";
}
