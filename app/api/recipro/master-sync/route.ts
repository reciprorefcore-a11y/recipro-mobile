import { NextResponse } from "next/server";
import { verifyIdToken, getAdminDb } from "@/lib/firebaseAdmin";
import { getReciproAdminToken } from "@/lib/server/reciproAdminAuth";
import { decodeJwtPayload } from "@/lib/jwtUtils";
import * as admin from "firebase-admin";
import type { ReciproIntegration } from "@/lib/reciproIntegration";

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
  const companyId = verified.uid;

  // 2. ボディ取得
  const body = await req.json().catch(() => null);
  const { storeId, setData } = body ?? {};

  if (!storeId || !Array.isArray(setData)) {
    return NextResponse.json(
      { error: "storeId and setData are required" },
      { status: 400 }
    );
  }

  // 3. 連携設定を読む
  const db = getAdminDb();
  const integrationSnap = await db
    .collection("companies")
    .doc(companyId)
    .collection("stores")
    .doc(storeId)
    .collection("integrations")
    .doc("recipro")
    .get();

  if (!integrationSnap.exists) {
    return NextResponse.json({ error: "レシプロ連携が設定されていません" }, { status: 403 });
  }

  const integration = integrationSnap.data() as ReciproIntegration;

  if (!integration.enabled) {
    return NextResponse.json({ error: "レシプロ連携が無効です" }, { status: 403 });
  }

  const { customerId, reciprocalStoreId } = integration;

  if (!customerId || !reciprocalStoreId) {
    return NextResponse.json({ error: "連携設定が不完全です" }, { status: 403 });
  }

  // 4. ALLOWED_CUSTOMER_IDS チェック
  const allowed = getAllowedCustomerIds();
  if (allowed.length === 0 || !allowed.includes(customerId)) {
    return NextResponse.json(
      { error: "この顧客IDは許可されていません" },
      { status: 403 }
    );
  }

  // 5. admin トークン取得
  let adminToken: string;
  try {
    adminToken = await getReciproAdminToken();
  } catch {
    return NextResponse.json(
      { error: "管理者認証に失敗しました" },
      { status: 500 }
    );
  }

  // 6. setAdminMaster を admin として呼ぶ
  let reciproRes: Response;
  try {
    reciproRes = await fetch(
      "https://asia-northeast1-recipro-project-fafd0.cloudfunctions.net/setAdminMaster",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          data: { customerID: customerId, storeID: reciprocalStoreId, setData },
        }),
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Reciproサーバーへの接続に失敗しました" },
      { status: 502 }
    );
  }

  if (!reciproRes.ok) {
    const text = await reciproRes.text().catch(() => "");
    return NextResponse.json(
      { error: "Reciproへの反映に失敗しました", detail: text },
      { status: reciproRes.status }
    );
  }

  // 7. masterChangeLogs に記録（失敗は警告のみ）
  try {
    const adminEmail = decodeJwtPayload(adminToken)?.email ?? null;
    const triggerEmail = decodeJwtPayload(clientToken)?.email ?? null;

    await db
      .collection("masterChangeLogs")
      .doc(customerId)
      .collection("entries")
      .add({
        customerID: customerId,
        storeID: reciprocalStoreId,
        createdAtIso: new Date().toISOString(),
        triggerUserEmail: triggerEmail,
        reciproAdminEmail: adminEmail,
        source: "master-sync",
        summary: {
          newCount: setData.length,
          updatedCount: 0,
          unchangedCount: 0,
          removedCount: 0,
        },
        changes: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.warn("[master-sync] ログ書き込み失敗（反映は成功済み）:", err);
  }

  return NextResponse.json({ ok: true, count: setData.length });
}
