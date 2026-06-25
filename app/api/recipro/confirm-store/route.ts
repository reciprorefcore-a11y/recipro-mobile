import { NextResponse } from "next/server";
import { verifyIdToken, getAdminDb } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";
import { RECIPRO_LOCAL_STORE_ID } from "@/lib/reciproIntegration";

function getAllowedCustomerIds(): string[] {
  return (process.env.ALLOWED_CUSTOMER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  // 1. モバイルユーザーのトークン検証
  const clientToken = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  const verified = clientToken ? await verifyIdToken(clientToken) : null;
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = verified.uid;

  // 2. ボディ取得
  const body = await req.json().catch(() => null);
  const { companyId, customerId, reciprocalStoreId, reciprocalStoreName } = body ?? {};

  if (!companyId || !customerId || !reciprocalStoreId || !reciprocalStoreName) {
    return NextResponse.json(
      { error: "companyId, customerId, reciprocalStoreId, reciprocalStoreName are required" },
      { status: 400 }
    );
  }

  if (uid !== companyId) {
    return NextResponse.json({ error: "companyId mismatch" }, { status: 403 });
  }

  // 3. ALLOWED_CUSTOMER_IDS チェック
  const allowed = getAllowedCustomerIds();
  if (allowed.length === 0 || !allowed.includes(customerId)) {
    return NextResponse.json(
      { error: "この顧客IDは連携許可されていません" },
      { status: 403 }
    );
  }

  // 4. Firestore に保存
  const db = getAdminDb();
  const ref = db
    .collection("companies")
    .doc(companyId)
    .collection("stores")
    .doc(RECIPRO_LOCAL_STORE_ID)
    .collection("integrations")
    .doc("recipro");

  const existing = await ref.get();
  await ref.set({
    enabled: true,
    customerId,
    reciprocalStoreId,
    reciprocalStoreName,
    connectedAt: existing.exists
      ? (existing.data() as { connectedAt: unknown }).connectedAt
      : admin.firestore.FieldValue.serverTimestamp(),
    connectedBy: uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
