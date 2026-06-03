import { doc, runTransaction, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export const MOBILE_ID_START = 10000;

function counterRef(companyId: string) {
  return doc(db, "companies", companyId, "settings", "myCatalogIdCounter");
}

export async function getNextMyCatalogId(companyId: string): Promise<string> {
  const ref = counterRef(companyId);
  const nextId = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists()
      ? (snap.data().counter as number)
      : MOBILE_ID_START;
    tx.set(ref, { counter: current + 1 });
    return current;
  });
  return String(nextId);
}

export async function getCurrentCounter(companyId: string): Promise<number> {
  const snap = await getDoc(counterRef(companyId));
  return snap.exists() ? (snap.data().counter as number) : MOBILE_ID_START;
}

export async function resetCounter(
  companyId: string,
  value = MOBILE_ID_START
): Promise<void> {
  await setDoc(counterRef(companyId), { counter: value });
}

export function isMobileIssuedId(myCatalogId: string | undefined): boolean {
  if (!myCatalogId) return false;
  const num = parseInt(myCatalogId, 10);
  return Number.isFinite(num) && num >= MOBILE_ID_START;
}
