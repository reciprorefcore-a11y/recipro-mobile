import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  collection,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Ingredient, PriceHistory, Product, UserProfile } from "@/types";

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

export async function updateIngredientPricesFromReceipt(
  companyId: string,
  updates: { ingredient: Ingredient; newPrice: number }[]
): Promise<void> {
  if (updates.length === 0) return;

  const batch = writeBatch(db);
  const historyCol = collection(db, "companies", companyId, "priceHistory");

  updates.forEach(({ ingredient, newPrice }) => {
    const ingredientRef = doc(
      db,
      "companies",
      companyId,
      "ingredients",
      ingredient.id
    );
    const historyRef = doc(historyCol);

    batch.update(ingredientRef, {
      currentPrice: newPrice,
      updatedAt: serverTimestamp(),
    });
    batch.set(historyRef, {
      ingredientId: ingredient.id,
      ingredientName: ingredient.ingredientName,
      price: newPrice,
      source: "receipt_ai",
      recordedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

// ─── Products ────────────────────────────────────────────

function productsCol(companyId: string) {
  return collection(db, "companies", companyId, "products");
}

export async function getProducts(companyId: string): Promise<Product[]> {
  const q = query(productsCol(companyId), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
}

export async function getProduct(
  companyId: string,
  productId: string
): Promise<Product | null> {
  const snap = await getDoc(doc(db, "companies", companyId, "products", productId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Product;
}

export async function addProduct(
  companyId: string,
  data: Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(productsCol(companyId), {
    ...data,
    companyId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(
  companyId: string,
  productId: string,
  data: Partial<Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">>
): Promise<void> {
  await updateDoc(doc(db, "companies", companyId, "products", productId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
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
