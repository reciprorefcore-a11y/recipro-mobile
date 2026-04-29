"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getIngredients, addIngredient } from "@/lib/firestore";
import { seedIngredients } from "@/lib/seedData";
import IngredientCard from "@/components/IngredientCard";
import AddIngredientModal from "@/components/AddIngredientModal";
import type { Ingredient } from "@/types";

type AddData = {
  ingredientName: string;
  ingredientNameKana: string;
  unit: string;
  currentPrice: number;
  supplier: string;
};

export default function SearchPage() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  const companyId = user?.uid ?? "";

  const fetchIngredients = async () => {
    if (!companyId) return;
    const data = await getIngredients(companyId);
    setIngredients(data);
  };

  useEffect(() => {
    if (!companyId) return;
    let ignore = false;

    getIngredients(companyId)
      .then((data) => {
        if (!ignore) setIngredients(data);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [companyId]);

  const filtered = ingredients.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.ingredientName.includes(q) ||
      item.ingredientNameKana.includes(q) ||
      item.nameNormalized.includes(q)
    );
  });

  const handleSeed = async () => {
    if (!companyId) return;
    setSeeding(true);
    setSeedMsg("");
    try {
      const count = await seedIngredients(companyId);
      await fetchIngredients();
      setSeedMsg(`✅ ${count}件投入しました`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setSeedMsg(`❌ ${e.message ?? "失敗しました"}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleAdd = async (data: AddData) => {
    if (!companyId) return;
    const uniqueId = `${companyId.slice(0, 8)}_${Date.now()}`;
    const nameNormalized = data.ingredientName.replace(/[\s　]/g, "");
    await addIngredient(companyId, { uniqueId, nameNormalized, ...data });
    await fetchIngredients();
  };

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 font-medium"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-arrow-right.svg" alt="" width={16} height={16}
              style={{ filter: "brightness(0) opacity(0.5)", transform: "rotate(180deg)" }} />
            戻る
          </Link>
          <h1 className="text-xl font-bold">食材を検索</h1>
        </div>

        {/* 開発用シードボタン */}
        {process.env.NODE_ENV === "development" && (
          <div className="space-y-1">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="w-full py-2 text-xs text-gray-500 border border-dashed border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {seeding ? "投入中..." : "🌱 シードデータを投入 (開発用)"}
            </button>
            {seedMsg && <p className="text-xs text-center text-gray-500">{seedMsg}</p>}
          </div>
        )}

        {/* 検索ボックス */}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-search.svg"
            alt=""
            width={18}
            height={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="食材名で検索..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 pl-10 text-[16px] outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* 新規追加ボタン */}
        <button
          onClick={() => setModalOpen(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-primary text-primary font-semibold hover:bg-orange-50 transition-colors"
        >
          ＋ 新しい食材を追加
        </button>

        {/* 件数 */}
        <p className="text-sm text-gray-500 font-medium">
          食材一覧 ({filtered.length}件)
        </p>

        {/* 食材リスト */}
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-8">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">
            {searchQuery
              ? "該当する食材がありません"
              : "食材がありません。シードデータを投入してください。"}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <IngredientCard key={item.id} ingredient={item} />
            ))}
          </div>
        )}
      </div>

      <AddIngredientModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAdd}
      />
    </main>
  );
}
