import * as admin from "firebase-admin";

function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountJson) {
    console.error("[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_KEY is not set");
    return admin.initializeApp();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceAccount = JSON.parse(serviceAccountJson) as any;

  // Vercel環境では private_key の \n がエスケープされたまま残ることがある
  // JSON.parse 後に修正する
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
