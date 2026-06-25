import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebaseAdmin";
import { getReciproAdminToken } from "@/lib/server/reciproAdminAuth";
import { decodeJwtPayload } from "@/lib/jwtUtils";

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
  const { displayId, password, companyId } = body ?? {};

  if (!displayId || !password || !companyId) {
    return NextResponse.json(
      { error: "displayId, password, companyId are required" },
      { status: 400 }
    );
  }

  if (uid !== companyId) {
    return NextResponse.json(
      { error: "companyId mismatch" },
      { status: 403 }
    );
  }

  // 3. Recipro 本部ユーザーとして signInWithPassword
  const email = `${String(displayId).toLowerCase()}@reci-pro.com`;
  const apiKey = process.env.NEXT_PUBLIC_RECIPRO_FIREBASE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Recipro API key not configured" },
      { status: 500 }
    );
  }

  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
      cache: "no-store",
    }
  );

  if (!signInRes.ok) {
    return NextResponse.json(
      { error: "IDまたはパスワードが正しくありません" },
      { status: 401 }
    );
  }

  const signInData = await signInRes.json();
  const hqToken: string = signInData.idToken;

  // 4. JWT から customerId を取得
  const claims = decodeJwtPayload(hqToken);
  const customerId = typeof claims?.customerID === "string" ? claims.customerID : null;

  if (!customerId) {
    return NextResponse.json(
      { error: "customerID claim not found in Recipro token" },
      { status: 401 }
    );
  }

  // 5. ALLOWED_CUSTOMER_IDS チェック
  const allowed = getAllowedCustomerIds();
  if (allowed.length === 0 || !allowed.includes(customerId)) {
    return NextResponse.json(
      { error: "この顧客IDは連携許可されていません" },
      { status: 403 }
    );
  }

  // 6. admin トークンで getAdminStoreList を呼ぶ
  let adminToken: string;
  try {
    adminToken = await getReciproAdminToken();
  } catch {
    return NextResponse.json(
      { error: "管理者認証に失敗しました" },
      { status: 500 }
    );
  }

  let storeListRes: Response;
  try {
    storeListRes = await fetch(
      "https://asia-northeast1-recipro-project-fafd0.cloudfunctions.net/getAdminStoreList",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ data: { customerID: customerId } }),
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Reciproサーバーへの接続に失敗しました" },
      { status: 502 }
    );
  }

  if (!storeListRes.ok) {
    return NextResponse.json(
      { error: "店舗一覧の取得に失敗しました" },
      { status: 502 }
    );
  }

  const storeListData = await storeListRes.json();
  const stores: Array<{ id: string; name: string }> = Array.isArray(storeListData?.result)
    ? storeListData.result.filter(
        (s: unknown): s is { id: string; name: string } =>
          typeof s === "object" &&
          s !== null &&
          typeof (s as { id: unknown }).id === "string" &&
          typeof (s as { name: unknown }).name === "string"
      )
    : [];

  // 7. displayId/password/token は返さない
  return NextResponse.json({ customerId, stores });
}
