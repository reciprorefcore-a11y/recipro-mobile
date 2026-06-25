import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Local store ID used in this app (one store per company)
export const RECIPRO_LOCAL_STORE_ID = "main";

export interface ReciproIntegration {
  enabled: boolean;
  customerId: string;
  reciprocalStoreId: string;
  reciprocalStoreName: string;
  connectedAt: { seconds: number; nanoseconds: number };
  connectedBy: string;
  updatedAt: { seconds: number; nanoseconds: number };
}

function integrationDocRef(companyId: string) {
  return doc(
    db,
    "companies",
    companyId,
    "stores",
    RECIPRO_LOCAL_STORE_ID,
    "integrations",
    "recipro"
  );
}

export async function getReciproIntegration(
  companyId: string
): Promise<ReciproIntegration | null> {
  const snap = await getDoc(integrationDocRef(companyId));
  return snap.exists() ? (snap.data() as ReciproIntegration) : null;
}
