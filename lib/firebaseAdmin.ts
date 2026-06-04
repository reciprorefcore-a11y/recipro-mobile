import * as admin from "firebase-admin";

function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountJson) {
    console.error("[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_KEY is not set");
    return admin.initializeApp();
  }

  // NOTE: JSON.parse "前" に replace してはいけない
  // JSON 中の \n は2文字のエスケープシーケンスとして正常に parse される
  // pre-parse replace すると raw newline が string 内に入り JSON が壊れる
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceAccount = JSON.parse(serviceAccountJson) as any;

  // Vercel で稀に private_key の \n が \\n のまま残るケースにのみ対応
  // JSON.parse 後の値に対して実施するため安全
  if (typeof serviceAccount.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  console.log("[firebaseAdmin] Initializing with project:", serviceAccount.project_id ?? "(unknown)");

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export function getAdminDb(): admin.firestore.Firestore {
  return getApp().firestore();
}

export async function verifyIdToken(
  token: string
): Promise<{ uid: string } | null> {
  try {
    const decoded = await getApp().auth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (e) {
    console.error(
      "[firebaseAdmin] verifyIdToken failed:",
      e instanceof Error ? e.message : String(e)
    );
    return null;
  }
}
