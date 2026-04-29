import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { Product } from "@/types";

const now = new Date();
const daysAgo = (d: number) =>
  Timestamp.fromDate(new Date(now.getTime() - d * 24 * 60 * 60 * 1000));

type SeedItem = {
  ingredientName: string;
  ingredientNameKana: string;
  unit: string;
  currentPrice: number;
  supplier: string;
  updatedDaysAgo: number;
};

const SEED_ITEMS: SeedItem[] = [
  { ingredientName: "豚バラスライス", ingredientNameKana: "ぶたばらすらいす", unit: "kg",   currentPrice: 580,  supplier: "田中精肉店",   updatedDaysAgo: 14 },
  { ingredientName: "玉ねぎ",         ingredientNameKana: "たまねぎ",         unit: "kg",   currentPrice: 280,  supplier: "青果市場",     updatedDaysAgo: 10 },
  { ingredientName: "にんにく",       ingredientNameKana: "にんにく",         unit: "kg",   currentPrice: 1200, supplier: "青果市場",     updatedDaysAgo: 8  },
  { ingredientName: "鶏もも肉",       ingredientNameKana: "とりももにく",     unit: "kg",   currentPrice: 720,  supplier: "田中精肉店",   updatedDaysAgo: 7  },
  { ingredientName: "トマト缶",       ingredientNameKana: "とまとかん",       unit: "缶",   currentPrice: 220,  supplier: "食品卸センター", updatedDaysAgo: 5 },
  { ingredientName: "オリーブオイル", ingredientNameKana: "おりーぶおいる",   unit: "L",    currentPrice: 1800, supplier: "食品卸センター", updatedDaysAgo: 3 },
  { ingredientName: "モッツァレラチーズ", ingredientNameKana: "もっつぁれらちーず", unit: "kg", currentPrice: 2400, supplier: "チーズ専門店", updatedDaysAgo: 2 },
  { ingredientName: "バジル",         ingredientNameKana: "ばじる",           unit: "パック", currentPrice: 380, supplier: "青果市場",   updatedDaysAgo: 1  },
  { ingredientName: "小麦粉",         ingredientNameKana: "こむぎこ",         unit: "kg",   currentPrice: 320,  supplier: "食品卸センター", updatedDaysAgo: 1 },
  { ingredientName: "塩",             ingredientNameKana: "しお",             unit: "kg",   currentPrice: 180,  supplier: "食品卸センター", updatedDaysAgo: 0 },
];

type SeedProduct = Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">;

const SEED_PRODUCTS: SeedProduct[] = [
  {
    name: "マルゲリータピザ",
    nameKana: "まるげりーたぴざ",
    baseCost: 280,
    currentCost: 320,
    price: 1280,
    monthlySales: 800,
  },
  {
    name: "カルボナーラ",
    nameKana: "かるぼなーら",
    baseCost: 320,
    currentCost: 380,
    price: 1480,
    monthlyRevenue: 444000, // 売上ベース推定 = 300食
  },
  {
    name: "ティラミス",
    nameKana: "てぃらみす",
    baseCost: 180,
    currentCost: 200,
    price: 680,
    // どちらもなし → デフォルト800食
  },
  {
    name: "シーザーサラダ",
    nameKana: "しーざーさらだ",
    baseCost: 200,
    currentCost: 180, // 原価ダウン
    price: 880,
    monthlySales: 500,
    // -10円 × 500食 = -5,000円(改善)
  },
];

export async function seedProducts(companyId: string): Promise<number> {
  const col = collection(db, "companies", companyId, "products");
  const now = Timestamp.now();
  await Promise.all(
    SEED_PRODUCTS.map((item) =>
      addDoc(col, {
        ...item,
        companyId,
        createdAt: now,
        updatedAt: now,
      })
    )
  );
  return SEED_PRODUCTS.length;
}

export async function seedIngredients(companyId: string): Promise<number> {
  const col = collection(db, "companies", companyId, "ingredients");
  await Promise.all(
    SEED_ITEMS.map((item) => {
      const ts = daysAgo(item.updatedDaysAgo);
      const uniqueId = `${companyId.slice(0, 8)}_${item.ingredientNameKana}`;
      const nameNormalized = item.ingredientName.replace(/[\s　]/g, "");
      return addDoc(col, {
        uniqueId,
        ingredientName: item.ingredientName,
        ingredientNameKana: item.ingredientNameKana,
        nameNormalized,
        unit: item.unit,
        currentPrice: item.currentPrice,
        supplier: item.supplier,
        createdAt: ts,
        updatedAt: ts,
      });
    })
  );
  return SEED_ITEMS.length;
}
