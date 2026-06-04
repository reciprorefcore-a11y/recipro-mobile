import * as admin from "firebase-admin";

// ── Firestore 用 Admin SDK（サーバーサイド書き込み） ──────────────

function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceAccount = JSON.parse(serviceAccountJson) as any;

  // Vercel で稀に private_key の \n が \\n のまま残るケース対応
  // JSON.parse 後の値にのみ適用する（pre-parse は正常なJSONを壊す）
  if (typeof serviceAccount.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  const projectId: string = serviceAccount.project_id ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  console.log("[firebaseAdmin] init projectId:", projectId || "(empty)", "hasPrivateKey:", !!serviceAccount.private_key, "hasClientEmail:", !!serviceAccount.client_email);

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: projectId || undefined,
  });
}

export function getAdminDb(): admin.firestore.Firestore {
  return getApp().firestore();
}

// ── トークン検証: Firebase REST API 方式 ─────────────────────────
//
// Admin SDK の verifyIdToken は service account key の設定ミスで
// 失敗しやすい。代わりに Firebase Identity Toolkit REST API を使う。
// NEXT_PUBLIC_FIREBASE_API_KEY (クライアントでも使用済み) だけで動作し、
// Google サーバーがトークンの署名・期限・プロジェクトを検証してくれる。

export async function verifyIdToken(
  token: string
): Promise<{ uid: string } | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.error("[verifyIdToken] NEXT_PUBLIC_FIREBASE_API_KEY is not set");
    return null;
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[verifyIdToken] lookup failed:", res.status, body.slice(0, 200));
      return null;
    }

    const data = (await res.json()) as { users?: Array<{ localId: string }> };
    const uid = data.users?.[0]?.localId;
    if (!uid) {
      console.warn("[verifyIdToken] no user returned from lookup");
      return null;
    }

    return { uid };
  } catch (e) {
    console.error("[verifyIdToken] error:", e instanceof Error ? e.message : String(e));
    return null;
  }
}
