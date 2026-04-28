import type { Timestamp } from "firebase/firestore";

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
  recordedAt: Timestamp;
};
