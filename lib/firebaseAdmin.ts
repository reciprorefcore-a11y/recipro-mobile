import * as admin from "firebase-admin";

function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  // Fallback for environments with Application Default Credentials (e.g. Cloud Run)
  return admin.initializeApp();
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
  } catch {
    return null;
  }
}
