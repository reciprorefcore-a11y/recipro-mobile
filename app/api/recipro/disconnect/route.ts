import { NextResponse } from "next/server";
import { verifyIdToken, getAdminDb } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";
import { RECIPRO_LOCAL_STORE_ID } from "@/lib/reciproIntegration";

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
  const { companyId } = body ?? {};

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  if (uid !== companyId) {
    return NextResponse.json({ error: "companyId mismatch" }, { status: 403 });
  }

  // 3. enabled=false に更新（履歴を残す）
  const db = getAdminDb();
  const ref = db
    .collection("companies")
    .doc(companyId)
    .collection("stores")
    .doc(RECIPRO_LOCAL_STORE_ID)
    .collection("integrations")
    .doc("recipro");

  await ref.set(
    {
      enabled: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
