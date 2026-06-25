let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getReciproAdminToken(): Promise<string> {
  const now = Date.now();

  // キャッシュが有効ならそれを返す（失効5分前までOK）
  if (cachedToken && cachedToken.expiresAt > now + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const apiKey = process.env.RECIPRO_FIREBASE_API_KEY;
  const email = process.env.RECIPRO_ADMIN_EMAIL;
  const password = process.env.RECIPRO_ADMIN_PASSWORD;

  if (!apiKey || !email || !password) {
    throw new Error("Recipro admin credentials are not configured on server.");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to get Recipro admin token: ${res.status}`);
  }

  const data = await res.json();
  const expiresInSec = parseInt(data.expiresIn ?? "3600", 10);

  cachedToken = {
    token: data.idToken,
    expiresAt: now + expiresInSec * 1000,
  };

  return cachedToken.token;
}
