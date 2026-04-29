"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
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
    () => matchedItems.filter((item) => item.selected).length,
    [matchedItems]
  );
  const newSelectedCount = useMemo(
    () => matchedItems.filter((item) => item.selected && item.matchType === "new").length,
    [matchedItems]
  );
  const matchedSelectedCount = selectedCount - newSelectedCount;

  useEffect(() => {
    if (!companyId) return;
    getIngredients(companyId).catch(() => {
      setError("食材マスタの読み込みに失敗しました");
    }).then((data) => {
      if (data) setIngredients(data);
    });
  }, [companyId]);

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

      if (response.status === 429) {
        setError("本日の解析上限に達しました");
        return;
      }
      if (response.status === 422) {
        setError("もう一度撮影してください");
        return;
      }
      if (!response.ok) {
        setError("解析に失敗しました。再度お試しください");
        return;
      }

      const result = (await response.json()) as ReceiptAnalysisResult;
      setMatchedItems(matchDetectedItems(result.items, ingredients));
      if (result.items.length === 0) {
        setError("もう一度撮影してください");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelected = (index: number) => {
    setMatchedItems((items) =>
      items.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleUpdate = async () => {
    if (!companyId) return;

    const matchedUpdates = matchedItems
      .filter((item) => item.selected && item.matchedIngredient)
      .map((item) => ({
        ingredient: item.matchedIngredient as Ingredient,
        newPrice: item.price,
      }));

    const newItems = matchedItems.filter(
      (item) => item.selected && item.matchType === "new"
    );

    if (matchedUpdates.length === 0 && newItems.length === 0) {
      setError("更新または追加する食材を選択してください");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // 既存食材の価格更新 (priceHistory も内部で記録)
      if (matchedUpdates.length > 0) {
        await updateIngredientPricesFromReceipt(companyId, matchedUpdates);
      }

      // 新規食材の一括登録
      if (newItems.length > 0) {
        await Promise.all(
          newItems.map(async (item, idx) => {
            const uniqueId = `${companyId.slice(0, 8)}_${Date.now()}_${idx}`;
            const nameNormalized = item.name.replace(/[\s　]/g, "");
            const ingredientNameKana = item.ingredientNameKana ?? item.name;

            const ingredientId = await addIngredient(companyId, {
              uniqueId,
              ingredientName: item.name,
              ingredientNameKana,
              nameNormalized,
              unit: item.unit,
              currentPrice: item.price,
            });

            await addPriceHistory(companyId, {
              ingredientId,
              ingredientName: item.name,
              price: item.price,
              source: "receipt_ai_new",
            });
          })
        );
      }

      const parts: string[] = [];
      if (matchedUpdates.length > 0) parts.push(`${matchedUpdates.length}件更新`);
      if (newItems.length > 0) parts.push(`${newItems.length}件新規追加`);
      setDoneMessage(parts.join("、") + "しました");

      window.setTimeout(() => router.push("/search"), 2500);
    } catch {
      setError("保存に失敗しました。再度お試しください");
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 font-medium"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-arrow-right.svg"
              alt=""
              width={16}
              height={16}
              style={{ filter: "brightness(0) opacity(0.5)", transform: "rotate(180deg)" }}
            />
            戻る
          </Link>
          <h1 className="text-xl font-bold">伝票を撮影</h1>
        </div>

        {matchedItems.length === 0 ? (
          <>
            <section className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full min-h-[180px] rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50 text-primary font-bold text-xl flex flex-col items-center justify-center gap-3"
              >
                <span className="text-4xl">📷</span>
                タップして撮影
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-primary bg-white py-3 font-bold text-primary"
              >
                画像を選択
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
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
                <img
                  src={previewUrl}
                  alt="選択した伝票"
                  className="w-full max-h-[360px] rounded-xl object-contain bg-gray-100"
                />
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="w-full rounded-xl py-4 font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {loading && (
                    <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  )}
                  {loading ? "解析中..." : "AIで解析"}
                </button>
              </section>
            )}
          </>
        ) : (
          <section className="space-y-3">
            {/* ヘッダー */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-1">
              <h2 className="text-lg font-bold text-gray-900">解析結果</h2>
              <p className="text-sm text-gray-500">
                更新・追加する食材を確認してください
              </p>
              {/* 新規追加がある場合の説明 */}
              {matchedItems.some((i) => i.matchType === "new") && (
                <div className="mt-2 bg-green-50 rounded-xl px-3 py-2 flex items-start gap-2">
                  <span className="text-green-600 text-sm">✦</span>
                  <p className="text-xs text-green-700">
                    <span className="font-bold">新規追加</span>の食材は食材マスタに自動登録されます
                  </p>
                </div>
              )}
            </div>

            {/* 結果リスト */}
            {matchedItems.map((item, index) => (
              <ResultItem
                key={`${item.name}-${index}`}
                item={item}
                onToggle={() => toggleSelected(index)}
              />
            ))}

            {/* 保存ボタン */}
            <button
              type="button"
              onClick={handleUpdate}
              disabled={saving || selectedCount === 0}
              className="w-full rounded-xl py-4 font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: PRIMARY }}
            >
              {saving && (
                <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {saving
                ? "保存中..."
                : selectedCount === 0
                ? "項目を選択してください"
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

function buildButtonLabel(matched: number, added: number): string {
  const parts: string[] = [];
  if (matched > 0) parts.push(`更新 ${matched}件`);
  if (added > 0) parts.push(`新規追加 ${added}件`);
  return `${parts.join(" + ")} を保存する`;
}

function ResultItem({
  item,
  onToggle,
}: {
  item: MatchedItem;
  onToggle: () => void;
}) {
  const isNew = item.matchType === "new";
  const hasChange =
    !isNew && item.oldPrice !== undefined && item.oldPrice !== item.price;

  const statusClass = isNew
    ? "text-green-700 bg-green-50"
    : hasChange
    ? "text-blue-700 bg-blue-50"
    : "text-gray-600 bg-gray-100";

  const priceLabel = isNew
    ? `新規追加 → ${item.price.toLocaleString()}円`
    : `${item.oldPrice?.toLocaleString() ?? "—"}円 → ${item.price.toLocaleString()}円（${
        hasChange ? "変更あり" : "変更なし"
      }）`;

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
          className="mt-1 h-5 w-5 accent-[#E85D2C] cursor-pointer"
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
              <span className="text-xs text-amber-600" aria-label="読み取り注意">
                ⚠ 要確認
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {item.unit}・信頼度 {Math.round(item.confidence * 100)}%
          </p>
          {!isNew && item.matchedIngredient && (
            <p className="text-xs text-gray-400 mt-0.5">
              マッチ: {item.matchedIngredient.ingredientName}
            </p>
          )}
        </div>
      </div>

      <p className={`rounded-xl px-3 py-2 text-sm font-bold ${statusClass}`}>
        {priceLabel}
      </p>
    </article>
  );
}

function matchDetectedItems(
  detectedItems: DetectedItem[],
  ingredients: Ingredient[]
): MatchedItem[] {
  return detectedItems.map((item) => {
    const exact = ingredients.find(
      (ing) => ing.ingredientName === item.name
    );
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
        ing.ingredientName,
        ing.ingredientNameKana,
        ing.nameNormalized,
      ].map(normalizeName);
      return candidates.some(
        (c) =>
          c.length >= 2 &&
          normalizedName.length >= 2 &&
          (c.includes(normalizedName) || normalizedName.includes(c))
      );
    });
    if (partial) return toMatchedItem(item, partial, "partial");

    // 新規食材: デフォルトで選択 ON
    return { ...item, matchType: "new", selected: true };
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
