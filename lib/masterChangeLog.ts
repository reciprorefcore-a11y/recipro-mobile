import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type ChangeEntry = {
  id: string;
  type: "new" | "updated";
  productName: string;
  diffs: { field: string; oldValue: string; newValue: string }[];
};

export type ChangeLogSummary = {
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  removedCount: number;
};

export type MasterChangeLog = {
  id: string;
  customerID: string;
  storeID: string;
  createdAtIso: string;
  triggerUserEmail: string | null;
  reciproAdminEmail: string | null;
  source: "master-import" | "ocr-import" | "master-sync";
  summary: ChangeLogSummary;
  changes: ChangeEntry[];
};

type LogInput = Omit<MasterChangeLog, "id">;

function entriesCol(customerID: string) {
  return collection(db, "masterChangeLogs", customerID, "entries");
}

export async function saveChangeLog(customerID: string, entry: LogInput): Promise<string> {
  const ref = await addDoc(entriesCol(customerID), {
    ...entry,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getChangeLogs(
  customerID: string,
  maxCount = 50
): Promise<MasterChangeLog[]> {
  const q = query(entriesCol(customerID), orderBy("createdAt", "desc"), limit(maxCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      customerID: String(data.customerID ?? ""),
      storeID: String(data.storeID ?? ""),
      createdAtIso: String(data.createdAtIso ?? ""),
      triggerUserEmail: data.triggerUserEmail ?? null,
      reciproAdminEmail: data.reciproAdminEmail ?? null,
      source: data.source ?? "master-import",
      summary: data.summary ?? { newCount: 0, updatedCount: 0, unchangedCount: 0, removedCount: 0 },
      changes: Array.isArray(data.changes) ? data.changes : [],
    } as MasterChangeLog;
  });
}
