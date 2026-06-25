import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { reciproAuth } from "./reciproFirebase";
import { decodeJwtPayload, decodeJwtExp } from "./jwtUtils";

export { decodeJwtExp };

export function formatTokenExpiry(exp: number | null): {
  label: string;
  expired: boolean;
} {
  if (exp === null) return { label: "有効期限不明", expired: false };
  const now = Math.floor(Date.now() / 1000);
  const diff = exp - now;
  if (diff <= 0) return { label: "有効期限切れ", expired: true };
  const m = Math.floor(diff / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return { label: `あと約 ${h} 時間`, expired: false };
  return { label: `あと約 ${m} 分`, expired: false };
}

export interface ReciproSignInResult {
  idToken: string;
  customerID: string;
  storeID: string;
  displayName: string;
}

export async function signInHeadquarters(
  displayId: string,
  password: string
): Promise<ReciproSignInResult> {
  const email = displayId.trim().toLowerCase() + "@reci-pro.com";
  const cred = await signInWithEmailAndPassword(reciproAuth, email, password);
  const idToken = await cred.user.getIdToken();
  const payload = decodeJwtPayload(idToken) ?? {};
  return {
    idToken,
    customerID: typeof payload.customerID === "string" ? payload.customerID : "",
    storeID: typeof payload.storeID === "string" ? payload.storeID : "",
    displayName: typeof payload.name === "string" ? payload.name : "",
  };
}

export async function getFreshReciproToken(
  forceRefresh = false
): Promise<string | null> {
  const user = reciproAuth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export async function signOutRecipro(): Promise<void> {
  await fbSignOut(reciproAuth);
}
