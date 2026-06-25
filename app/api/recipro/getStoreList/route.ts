import { NextResponse } from "next/server";
import { getReciproAdminToken } from "@/lib/server/reciproAdminAuth";
import { decodeJwtPayload } from "@/lib/jwtUtils";

function getAllowedCustomerIds(): string[] {
  return (process.env.ALLOWED_CUSTOMER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  // 1. クライアントの headquarters トークン取得
  const clientToken = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!clientToken) {
    return NextResponse.json(
      { error: "Authorization header missing" },
      { status: 401 }
    );
  }

  // 2. JWTをデコードして customerID を取得
  const claims = decodeJwtPayload(clientToken);
  const tokenCustomerID = claims?.customerID;

  if (!tokenCustomerID) {
    return NextResponse.json(
      { error: "customerID claim missing in client token" },
      { status: 401 }
    );
  }

  // 3. リクエストボディ取得
  const body = await req.json().catch(() => null);
  const { customerID } = body ?? {};

  if (!customerID) {
    return NextResponse.json(
      { error: "Invalid request body: customerID is required" },
      { status: 400 }
    );
  }

  // 4. セキュリティチェック1: トークン内 customerID とリクエストの customerID の一致確認
  if (tokenCustomerID !== customerID) {
    return NextResponse.json(
      { error: "customerID mismatch between token and request" },
      { status: 403 }
    );
  }

  // 5. セキュリティチェック2: サーバー側ホワイトリスト確認
  const allowed = getAllowedCustomerIds();
  if (allowed.length === 0) {
    return NextResponse.json(
      { error: "Server is not configured with ALLOWED_CUSTOMER_IDS" },
      { status: 500 }
    );
  }
  if (!allowed.includes(customerID)) {
    return NextResponse.json(
      { error: `customerID ${customerID} is not in the allow list` },
      { status: 403 }
    );
  }

  // 6. サーバー側で admin トークン取得
  let adminToken: string;
  try {
    adminToken = await getReciproAdminToken();
  } catch {
    return NextResponse.json(
      { error: "Failed to authenticate as admin" },
      { status: 500 }
    );
  }

  // 7. 外部 Recipro getAdminStoreList を admin として呼ぶ
  let reciproRes: Response;
  try {
    reciproRes = await fetch(
      "https://asia-northeast1-recipro-project-fafd0.cloudfunctions.net/getAdminStoreList",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ data: { customerID } }),
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Recipro Cloud Function" },
      { status: 502 }
    );
  }

  // 8. レスポンスをそのままクライアントに転送
  const reciproBody = await reciproRes.text();
  return new NextResponse(reciproBody, {
    status: reciproRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
