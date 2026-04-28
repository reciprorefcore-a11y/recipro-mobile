import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Ingredient, PriceHistory, UserProfile } from "@/types";

// ─── User ────────────────────────────────────────────────

export async function createUserProfile(
  uid: string,
  data: Pick<UserProfile, "email" | "companyName" | "storeName">
) {
  await setDoc(doc(db, "users", uid), {
    uid,
    ...data,
    role: "owner",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

// ─── Ingredients ─────────────────────────────────────────

function ingredientsCol(companyId: string) {
  return collection(db, "companies", companyId, "ingredients");
}

export async function getIngredients(companyId: string): Promise<Ingredient[]> {
  const q = query(ingredientsCol(companyId), orderBy("updatedAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ingredient));
}

export async function getIngredient(
  companyId: string,
  ingredientId: string
): Promise<Ingredient | null> {
  const snap = await getDoc(
    doc(db, "companies", companyId, "ingredients", ingredientId)
  );
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Ingredient;
}

export async function addIngredient(
  companyId: string,
  data: Omit<Ingredient, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(ingredientsCol(companyId), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateIngredientPrice(
  companyId: string,
  ingredientId: string,
  newPrice: number
): Promise<void> {
  await updateDoc(
    doc(db, "companies", companyId, "ingredients", ingredientId),
    { currentPrice: newPrice, updatedAt: serverTimestamp() }
  );
}

// ─── Price History ────────────────────────────────────────

export async function addPriceHistory(
  companyId: string,
  data: Omit<PriceHistory, "id" | "recordedAt">
): Promise<void> {
  await addDoc(collection(db, "companies", companyId, "priceHistory"), {
    ...data,
    recordedAt: serverTimestamp(),
  });
}
