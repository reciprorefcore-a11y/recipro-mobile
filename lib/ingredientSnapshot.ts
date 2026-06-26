import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { IngredientSnapshot, SnapshotItem } from "@/types";

export type CleanupPreview = {
  keepCount: number;
  deleteCount: number;
  deleteItems: IngredientSnapshot[];
};

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

function yearMonth(ts: Timestamp): string {
  const d = ts.toDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthlyReps(items: IngredientSnapshot[]): IngredientSnapshot[] {
  const byMonth = new Map<string, IngredientSnapshot[]>();
  for (const s of items) {
    const m = yearMonth(s.createdAt);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(s);
  }

  const reps: IngredientSnapshot[] = [];
  for (const monthItems of byMonth.values()) {
    const pinned = monthItems.filter((s) => s.pinned);
    const unpinned = monthItems.filter((s) => !s.pinned);
    reps.push(...pinned);
    if (unpinned.length > 0) {
      // desc 順なので末尾が最古
      reps.push(unpinned[unpinned.length - 1]);
    }
  }

  return reps.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

async function fetchAll(companyId: string): Promise<IngredientSnapshot[]> {
  const q = query(snapshotsCol(companyId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as IngredientSnapshot));
}

// ─── 保存 ────────────────────────────────────────────────

export async function saveIngredientSnapshot(
  companyId: string,
  userId: string,
  description: string,
  items: SnapshotItem[],
  type: "manual" | "before-import" = "manual"
): Promise<string> {
  const ref = await addDoc(snapshotsCol(companyId), {
    companyId,
    createdAt: serverTimestamp(),
    createdBy: userId,
    status: "active",
    description,
    items: stripUndefined(items),
    type,
  });
  return ref.id;
}

// ─── 取得 ────────────────────────────────────────────────

/** 直近20件。21件目があれば hasMore=true */
export async function getRecentSnapshots(companyId: string): Promise<{
  snapshots: IngredientSnapshot[];
  hasMore: boolean;
}> {
  const q = query(snapshotsCol(companyId), orderBy("createdAt", "desc"), limit(21));
  const snap = await getDocs(q);
  const hasMore = snap.docs.length > 20;
  const docs = snap.docs.slice(0, 20);
  return {
    snapshots: docs.map((d) => ({ id: d.id, ...d.data() } as IngredientSnapshot)),
    hasMore,
  };
}

/** 21件目以降を全件取得し月別代表（ピン留め全部 + 最古1件/月）を返す */
export async function getOlderMonthlyReps(
  companyId: string
): Promise<IngredientSnapshot[]> {
  const all = await fetchAll(companyId);
  return buildMonthlyReps(all.slice(20));
}

// ─── ピン留め ────────────────────────────────────────────

export async function togglePinSnapshot(
  companyId: string,
  snapshotId: string,
  pinned: boolean,
  userId: string
): Promise<void> {
  await updateDoc(doc(snapshotsCol(companyId), snapshotId), {
    pinned,
    pinnedAt: pinned ? serverTimestamp() : null,
    pinnedBy: pinned ? userId : null,
  });
}

// ─── 整理 ────────────────────────────────────────────────

export async function previewCleanup(companyId: string): Promise<CleanupPreview> {
  const all = await fetchAll(companyId);

  const keepRecent = all.slice(0, 20);
  const older = all.slice(20);

  const byMonth = new Map<string, IngredientSnapshot[]>();
  for (const s of older) {
    const m = yearMonth(s.createdAt);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(s);
  }

  const keepMonthly: IngredientSnapshot[] = [];
  for (const monthItems of byMonth.values()) {
    const pinned = monthItems.filter((s) => s.pinned);
    const unpinned = monthItems.filter((s) => !s.pinned);
    keepMonthly.push(...pinned);
    if (unpinned.length > 0) {
      keepMonthly.push(unpinned[unpinned.length - 1]);
    }
  }

  const keepIds = new Set([
    ...keepRecent.map((s) => s.id),
    ...keepMonthly.map((s) => s.id),
  ]);

  const toDelete = all.filter((s) => !keepIds.has(s.id));

  return {
    keepCount: keepIds.size,
    deleteCount: toDelete.length,
    deleteItems: toDelete,
  };
}

export async function executeCleanup(
  companyId: string
): Promise<{ deleted: number }> {
  const preview = await previewCleanup(companyId);
  if (preview.deleteItems.length === 0) return { deleted: 0 };

  const BATCH_SIZE = 400;
  let batch = writeBatch(db);
  let ops = 0;

  for (const item of preview.deleteItems) {
    const ref = doc(snapshotsCol(companyId), item.id);
    batch.delete(ref);
    ops++;
    if (ops >= BATCH_SIZE) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  return { deleted: preview.deleteItems.length };
}

// ─── ロールバック ─────────────────────────────────────────

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
