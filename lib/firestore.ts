import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  writeBatch,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { GeneralSettings, Ingredient, IngredientWrite, OnboardingSettings, Order, PendingIngredient, PriceHistory, PriceMode, Product, Supplier, UserProfile } from "@/types";

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

export async function saveStoreInfo(
  uid: string,
  data: Partial<Pick<UserProfile, "storeName" | "address" | "zipCode" | "phone" | "fax" | "personInCharge">>
): Promise<void> {
  await setDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function saveConsent(uid: string, termsVersion: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    termsAgreedAt: serverTimestamp(),
    privacyAgreedAt: serverTimestamp(),
    termsVersion,
    updatedAt: serverTimestamp(),
  });
}

// ─── Ingredients ─────────────────────────────────────────

function ingredientsCol(companyId: string) {
  return collection(db, "companies", companyId, "ingredients");
}

export async function getIngredients(companyId: string): Promise<Ingredient[]> {
  const q = query(ingredientsCol(companyId), orderBy("updatedAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeIngredient(d.id, d.data(), companyId));
}

export async function getIngredient(
  companyId: string,
  ingredientId: string
): Promise<Ingredient | null> {
  const snap = await getDoc(
    doc(db, "companies", companyId, "ingredients", ingredientId)
  );
  if (!snap.exists()) return null;
  return normalizeIngredient(snap.id, snap.data(), companyId);
}

export async function addIngredient(
  companyId: string,
  data: IngredientWrite
): Promise<string> {
  const ref = await addDoc(ingredientsCol(companyId), {
    ...data,
    companyId,
    isActive: data.isActive ?? true,
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
  const current = await getIngredient(companyId, ingredientId);
  await updateDoc(
    doc(db, "companies", companyId, "ingredients", ingredientId),
    {
      currentPrice: newPrice,
      oldPrice: current?.currentPrice ?? null,
      updatedAt: serverTimestamp(),
    }
  );
}

export async function updateIngredient(
  companyId: string,
  ingredientId: string,
  data: Partial<
    Pick<
      Ingredient,
      | "ingredientName"
      | "ingredientNameKana"
      | "myCatalogId"
      | "supplier"
      | "supplierKana"
      | "spec"
      | "unit"
      | "currentPrice"
      | "oldPrice"
      | "category"
      | "isActive"
    >
  >
): Promise<void> {
  await updateDoc(doc(db, "companies", companyId, "ingredients", ingredientId), {
    ...toFirestoreUpdateData(data),
    updatedAt: serverTimestamp(),
  });
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
      oldPrice: ingredient.currentPrice,
      updatedAt: serverTimestamp(),
    });
    batch.set(historyRef, {
      ingredientId: ingredient.id,
      ingredientName: ingredient.ingredientName,
      price: newPrice,
      oldPrice: ingredient.currentPrice,
      source: "receipt_ai",
      recordedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

function normalizeIngredient(
  id: string,
  data: Record<string, unknown>,
  fallbackCompanyId: string
): Ingredient {
  return {
    id,
    uniqueId: stringValue(data.uniqueId) || id,
    companyId: stringValue(data.companyId) || fallbackCompanyId,
    ingredientName: stringValue(data.ingredientName),
    ingredientNameKana: optionalString(data.ingredientNameKana),
    myCatalogId: optionalString(data.myCatalogId),
    smaregiCode: optionalString(data.smaregiCode),
    smaregiDept: optionalString(data.smaregiDept),
    supplier: optionalString(data.supplier),
    supplierKana: optionalString(data.supplierKana),
    spec: optionalString(data.spec),
    unit: stringValue(data.unit) || "個",
    quantity: optionalQuantityValue(data.quantity),
    packQuantity: optionalQuantityValue(data.packQuantity),
    lotQuantity: optionalQuantityValue(data.lotQuantity),
    inputQuantity: optionalQuantityValue(data.inputQuantity),
    inputQuantityUnit: optionalString(data.inputQuantityUnit),
    caseQuantity: optionalQuantityValue(data.caseQuantity),
    irisu: optionalQuantityValue(data.irisu),
    countPerUnit: optionalQuantityValue(data.countPerUnit),
    outputQuantity: optionalQuantityValue(data.outputQuantity),
    currentPrice: numberValue(data.currentPrice),
    oldPrice: optionalNumber(data.oldPrice),
    globalCategory: optionalString(data.globalCategory),
    globalCategoryId: optionalString(data.globalCategoryId),
    category: optionalString(data.category),
    updatedAt: timestampToIso(data.updatedAt),
    isActive: data.isActive !== false,
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | undefined {
  const text = stringValue(value).trim();
  return text || undefined;
}

function numberValue(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function optionalQuantityValue(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const text = value.trim();
    return text || undefined;
  }
  return undefined;
}

function timestampToIso(value: unknown): string | undefined {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return undefined;
}

function toFirestoreUpdateData(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value === undefined ? null : value])
  );
}

// ─── Products ────────────────────────────────────────────

function productsCol(companyId: string) {
  return collection(db, "companies", companyId, "products");
}

export async function getProducts(companyId: string): Promise<Product[]> {
  const q = query(productsCol(companyId), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeProduct(d.id, d.data(), companyId));
}

export async function getProduct(
  companyId: string,
  productId: string
): Promise<Product | null> {
  const snap = await getDoc(doc(db, "companies", companyId, "products", productId));
  if (!snap.exists()) return null;
  return normalizeProduct(snap.id, snap.data(), companyId);
}

function normalizeProduct(
  id: string,
  data: Record<string, unknown>,
  fallbackCompanyId: string
): Product {
  const monthlySales = firstNumber(
    data.monthlySales,
    data.monthlySalesCount,
    data.salesCount,
    data.soldCount,
    data.monthlyQuantity,
    data.monthlyOrderCount
  );

  return {
    ...(data as Omit<Product, "id" | "companyId">),
    id,
    companyId: stringValue(data.companyId) || fallbackCompanyId,
    name: stringValue(data.name),
    nameKana: stringValue(data.nameKana),
    baseCost: numberValue(data.baseCost),
    currentCost: numberValue(data.currentCost),
    changedCost: optionalNumber(data.changedCost),
    price: numberValue(data.price),
    monthlySales,
    monthlySalesCount: optionalNumber(data.monthlySalesCount),
    salesCount: optionalNumber(data.salesCount),
    soldCount: optionalNumber(data.soldCount),
    monthlyQuantity: optionalNumber(data.monthlyQuantity),
    monthlyOrderCount: optionalNumber(data.monthlyOrderCount),
  } as Product;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const num = optionalNumber(value);
    if (num !== undefined) return num;
  }
  return undefined;
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

export async function getRecentPriceHistory(
  companyId: string,
  days = 30
): Promise<PriceHistory[]> {
  const since = Timestamp.fromDate(
    new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  );
  const q = query(
    collection(db, "companies", companyId, "priceHistory"),
    where("recordedAt", ">=", since),
    orderBy("recordedAt", "desc"),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceHistory));
}

// ─── Onboarding ───────────────────────────────────────────

function onboardingRef(companyId: string) {
  return doc(db, "companies", companyId, "settings", "onboarding");
}

export async function getOnboardingSettings(
  companyId: string
): Promise<OnboardingSettings | null> {
  const snap = await getDoc(onboardingRef(companyId));
  return snap.exists() ? (snap.data() as OnboardingSettings) : null;
}

export async function initOnboarding(companyId: string): Promise<void> {
  await setDoc(onboardingRef(companyId), {
    onboardingStartedAt: serverTimestamp(),
    onboardingCompleted: false,
    onboardingSkipped: false,
    completedSteps: {
      ingredientMaster: false,
      menuImport: false,
      confirmation: false,
    },
  });
}

export async function completeOnboardingStep(
  companyId: string,
  step: keyof OnboardingSettings["completedSteps"]
): Promise<void> {
  await updateDoc(onboardingRef(companyId), {
    [`completedSteps.${step}`]: true,
  });
}

export async function completeOnboarding(companyId: string): Promise<void> {
  await updateDoc(onboardingRef(companyId), {
    onboardingCompleted: true,
    onboardingCompletedAt: serverTimestamp(),
    "completedSteps.ingredientMaster": true,
    "completedSteps.menuImport": true,
    "completedSteps.confirmation": true,
  });
}

export async function skipOnboarding(companyId: string): Promise<void> {
  const snap = await getDoc(onboardingRef(companyId));
  const base = {
    onboardingSkipped: true,
    onboardingSkippedAt: serverTimestamp(),
  };
  if (snap.exists()) {
    await updateDoc(onboardingRef(companyId), base);
  } else {
    await setDoc(onboardingRef(companyId), {
      ...base,
      onboardingStartedAt: serverTimestamp(),
      onboardingCompleted: false,
      completedSteps: { ingredientMaster: false, menuImport: false, confirmation: false },
    });
  }
}

// ─── Pending Ingredients ──────────────────────────────────

function pendingIngredientsCol(companyId: string) {
  return collection(db, "companies", companyId, "pendingIngredients");
}

export async function addPendingIngredient(
  companyId: string,
  data: Pick<PendingIngredient, "ingredientName" | "ingredientNameKana" | "unit" | "currentPrice" | "supplier" | "supplierKana" | "spec">
): Promise<string> {
  const ref = await addDoc(pendingIngredientsCol(companyId), {
    ...data,
    companyId,
    detectedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getPendingIngredients(companyId: string): Promise<PendingIngredient[]> {
  const q = query(pendingIngredientsCol(companyId), orderBy("detectedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    companyId,
    ingredientName: stringValue(d.data().ingredientName),
    ingredientNameKana: optionalString(d.data().ingredientNameKana),
    unit: stringValue(d.data().unit) || "個",
    currentPrice: numberValue(d.data().currentPrice),
    supplier: optionalString(d.data().supplier),
    supplierKana: optionalString(d.data().supplierKana),
    spec: optionalString(d.data().spec),
    detectedAt: d.data().detectedAt,
  } as PendingIngredient));
}

export async function deletePendingIngredient(companyId: string, pendingId: string): Promise<void> {
  await deleteDoc(doc(db, "companies", companyId, "pendingIngredients", pendingId));
}

export async function promotePendingIngredient(
  companyId: string,
  pendingId: string,
  myCatalogId: string
): Promise<string> {
  const pendingRef = doc(db, "companies", companyId, "pendingIngredients", pendingId);
  const pendingSnap = await getDoc(pendingRef);
  if (!pendingSnap.exists()) throw new Error("Pending ingredient not found");

  const data = pendingSnap.data();
  const uniqueId = `${companyId.slice(0, 8)}_${Date.now()}`;

  const ingredientId = await addIngredient(companyId, {
    uniqueId,
    myCatalogId,
    ingredientName: stringValue(data.ingredientName),
    ingredientNameKana: optionalString(data.ingredientNameKana),
    unit: stringValue(data.unit) || "個",
    currentPrice: numberValue(data.currentPrice),
    supplier: optionalString(data.supplier),
    supplierKana: optionalString(data.supplierKana),
    spec: optionalString(data.spec),
  });

  await deleteDoc(pendingRef);
  return ingredientId;
}

// ─── General Settings ─────────────────────────────────────

function generalSettingsRef(companyId: string) {
  return doc(db, "companies", companyId, "settings", "general");
}

export async function getGeneralSettings(
  companyId: string
): Promise<GeneralSettings | null> {
  const snap = await getDoc(generalSettingsRef(companyId));
  return snap.exists() ? (snap.data() as GeneralSettings) : null;
}

export async function savePriceMode(
  companyId: string,
  priceMode: PriceMode
): Promise<void> {
  const snap = await getDoc(generalSettingsRef(companyId));
  const data = { priceMode, priceModeSetAt: serverTimestamp() };
  if (snap.exists()) {
    await updateDoc(generalSettingsRef(companyId), data);
  } else {
    await setDoc(generalSettingsRef(companyId), data);
  }
}

// ─── Suppliers ────────────────────────────────────────────

export async function getSuppliers(companyId: string): Promise<Supplier[]> {
  const snap = await getDocs(
    query(
      collection(db, "companies", companyId, "suppliers"),
      orderBy("usageCount", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Supplier));
}

// ─── Orders ──────────────────────────────────────────────

export async function saveOrder(
  companyId: string,
  order: Omit<Order, "id" | "companyId" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "companies", companyId, "orders"), {
    ...order,
    companyId,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getOrders(companyId: string, maxCount = 20): Promise<Order[]> {
  const q = query(
    collection(db, "companies", companyId, "orders"),
    orderBy("createdAt", "desc"),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
}
