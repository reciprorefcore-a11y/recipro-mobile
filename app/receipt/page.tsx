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
import type {
  DetectedItem,
  Ingredient,
  MatchedItem,
  ReceiptAnalysisResult,
} from "@/types";

const PRIMARY = "#E85D2C";
const UNITS = [
  "kg", "g", "個", "L", "ml", "本", "袋", "ケース", "パック", "枚", "cc",
] as const;

// ─── Page ────────────────────────────────────────────────

export default function ReceiptPage() {
  const { user } = useAuth();
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageBase64, setImageBase64] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

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

  // ─ ファイル選択 ─
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setMatchedItems([]);
    setDoneMessage("");
    try {
      const compressed = await compressImage(file);
      setImageBase64(compressed);
      setPreviewUrl(compressed);
    } catch {
      setError("もう一度撮影してください");
    }
  };

  // ─ AI 解析 ─
  const handleAnalyze = async () => {
    if (!imageBase64 || !user || !companyId) return;
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/receipt/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64, companyId }),
      });

      if (response.status === 429) { setError("本日の解析上限に達しました"); return; }
      if (response.status === 422) { setError("もう一度撮影してください"); return; }
      if (!response.ok) { setError("解析に失敗しました。再度お試しください"); return; }

      const result = (await response.json()) as ReceiptAnalysisResult;
      setMatchedItems(matchDetectedItems(result.items, ingredients));
      if (result.items.length === 0) setError("もう一度撮影してください");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
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
    } catch (error) {
      console.error("save failed", error);
      setError(`保存に失敗しました。再度お試しください。詳細: ${getErrorMessage(error)}`);
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

        {matchedItems.length === 0 ? (
          /* ── 撮影・選択UI ─────────────────────────────── */
          <>
            <section className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
              <button type="button" onClick={() => cameraInputRef.current?.click()}
                className="w-full min-h-[180px] rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50 text-primary font-bold text-xl flex flex-col items-center justify-center gap-3">
                <span className="text-4xl">📷</span>
                タップして撮影
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-primary bg-white py-3 font-bold text-primary">
                画像を選択
              </button>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={handleFileChange} />
              <input ref={fileInputRef} type="file" accept="image/*"
                className="hidden" onChange={handleFileChange} />
            </section>

            <section className="bg-white rounded-2xl shadow-sm p-4">
              <h2 className="font-bold text-gray-900 mb-2">撮影のコツ</h2>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>・明るい場所で撮影</li>
                <li>・伝票全体を入れる</li>
                <li>・まっすぐ撮影</li>
              </ul>
            </section>

            {previewUrl && (
              <section className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="選択した伝票"
                  className="w-full max-h-[360px] rounded-xl object-contain bg-gray-100" />
                <button type="button" onClick={handleAnalyze} disabled={loading}
                  className="w-full rounded-xl py-4 font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: PRIMARY }}>
                  {loading && <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                  {loading ? "解析中..." : "AIで解析"}
                </button>
              </section>
            )}
          </>
        ) : (
          /* ── 解析結果UI ───────────────────────────────── */
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

            <button type="button" onClick={handleUpdate}
              disabled={saving || selectedCount === 0}
              className="w-full rounded-xl py-4 font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: PRIMARY }}>
              {saving && <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
              {saving ? "保存中..."
                : selectedCount === 0 ? "項目を選択してください"
                : buildButtonLabel(matchedSelectedCount, newSelectedCount)}
            </button>
          </section>
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
  // ─ ローカル編集ドラフト ─
  const [editName, setEditName] = useState(item.name);
  const [editUnit, setEditUnit] = useState(item.unit);
  const [editPrice, setEditPrice] = useState(String(item.price));
  const [editQuantity, setEditQuantity] = useState(String(item.quantity ?? 1));
  const [editSupplier, setEditSupplier] = useState(item.supplier ?? "");
  const [errors, setErrors] = useState<ValidationErrors>({});

  // 編集モードに入ったら現在の値でリセット
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

  // ── 編集モード ──────────────────────────────────────
  if (item.isEditing) {
    return (
      <article className="bg-orange-50 border-2 border-primary rounded-2xl p-4 space-y-3">
        {/* バッジ行 */}
        <div className="flex items-center gap-2">
          {isNew && (
            <span className="text-xs font-bold text-white bg-green-500 px-2 py-0.5 rounded-full">
              新規追加
            </span>
          )}
          <span className="text-xs text-primary font-semibold">編集中</span>
        </div>

        {/* 食材名 */}
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

        {/* 単位 */}
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

        {/* 数量 × 価格 */}
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

        {/* 仕入先 */}
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

        {/* 合計参考 */}
        <p className="text-sm text-gray-500">
          合計 (参考): <span className="font-bold text-gray-800">{total.toLocaleString()}円</span>
          <span className="text-xs ml-1">({editQuantity || 1} × {Number(editPrice || 0).toLocaleString()}円)</span>
        </p>

        {/* アクションボタン */}
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

  // ── コンパクト表示 ────────────────────────────────────
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

        {/* 編集ボタン */}
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
    const exact = ingredients.find((ing) => ing.ingredientName === item.name);
    if (exact) return toMatchedItem(item, exact, "exact");

    const normalizedName = normalizeName(item.name);
    const normalized = ingredients.find((ing) =>
      [ing.ingredientName, ing.ingredientNameKana, ing.nameNormalized]
        .map(normalizeName)
        .includes(normalizedName)
    );
    if (normalized) return toMatchedItem(item, normalized, "normalized");

    const partial = ingredients.find((ing) => {
      const candidates = [
        ing.ingredientName, ing.ingredientNameKana, ing.nameNormalized,
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

function normalizeName(value: string) {
  return value
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

async function compressImage(file: File): Promise<string> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(imageUrl);
    const canvas = document.createElement("canvas");
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.86;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (estimateBase64Bytes(dataUrl) > 1024 * 1024 && quality > 0.45) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function estimateBase64Bytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}
