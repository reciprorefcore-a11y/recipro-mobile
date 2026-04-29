import type { Timestamp } from "firebase/firestore";

export type Product = {
  id: string;
  companyId: string;
  name: string;
  nameKana: string;
  baseCost: number;
  currentCost: number;
  price: number;
  monthlySales?: number;
  monthlyRevenue?: number;
  category?: string;
  ingredients?: string[];
  posSourceId?: string; // 将来用: スマレジ等のPOS商品ID
  updatedAt: Timestamp;
  createdAt: Timestamp;
};

export type UserProfile = {
  uid: string;
  email: string;
  companyName: string;
  storeName: string;
  role: "owner";
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Ingredient = {
  id: string;
  uniqueId: string;
  ingredientName: string;
  ingredientNameKana: string;
  nameNormalized: string;
  unit: string;
  currentPrice: number;
  supplier?: string;
  category?: string;
  updatedAt: Timestamp;
  createdAt: Timestamp;
};

export type PriceHistory = {
  id?: string;
  ingredientId: string;
  ingredientName: string;
  price: number;
  quantity?: number | null; // 将来の数量分析用
  source?: "manual" | "receipt_ai" | "receipt_ai_new";
  recordedAt: Timestamp;
};

export type DetectedItem = {
  name: string;
  ingredientNameKana?: string; // AIが返却、なければ食材名をそのまま使用
  price: number;
  unit: string;
  quantity?: number; // 購入数量
  confidence: number;
  supplier?: string; // 仕入先
};

export type ReceiptAnalysisResult = {
  items: DetectedItem[];
  notes?: string;
};

export type MatchedItem = DetectedItem & {
  matchedIngredient?: Ingredient;
  matchType: "exact" | "normalized" | "partial" | "new";
  oldPrice?: number;
  selected: boolean;
  isEditing: boolean; // 編集モード状態
};
