import {
  collection,
  doc,
  addDoc,
  getDocs,
  writeBatch,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { IngredientSnapshot, SnapshotItem } from "@/types";

function snapshotsCol(companyId: string) {
  return collection(db, "companies", companyId, "ingredientSnapshots");
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as unknown as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    ) as T;
  }
  return value;
}

export async function saveIngredientSnapshot(
  companyId: string,
  userId: string,
  description: string,
  items: SnapshotItem[]
): Promise<string> {
  const ref = await addDoc(snapshotsCol(companyId), {
    companyId,
    createdAt: serverTimestamp(),
    createdBy: userId,
    status: "active",
    description,
    items: stripUndefined(items),
  });
  return ref.id;
}

export async function getRecentSnapshots(
  companyId: string,
  maxCount = 20
): Promise<IngredientSnapshot[]> {
  const q = query(snapshotsCol(companyId), orderBy("createdAt", "desc"), limit(maxCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as IngredientSnapshot));
}

export async function rollbackSnapshot(
  companyId: string,
  snapshot: IngredientSnapshot
): Promise<void> {
  const batch = writeBatch(db);
  const historyCol = collection(db, "companies", companyId, "priceHistory");

  for (const item of snapshot.items) {
    const ingredientRef = doc(db, "companies", companyId, "ingredients", item.ingredientId);

    if (item.isNew) {
      batch.update(ingredientRef, { isActive: false, updatedAt: serverTimestamp() });
    } else {
      batch.update(ingredientRef, {
        currentPrice: item.oldPrice,
        oldPrice: item.newPrice,
        updatedAt: serverTimestamp(),
      });
      const historyRef = doc(historyCol);
      batch.set(historyRef, {
        ingredientId: item.ingredientId,
        ingredientName: item.ingredientName,
        price: item.oldPrice,
        source: "rollback",
        recordedAt: serverTimestamp(),
      });
    }
  }

  batch.update(doc(snapshotsCol(companyId), snapshot.id), {
    status: "rolled_back",
    rolledBackAt: serverTimestamp(),
  });

  await batch.commit();
}
