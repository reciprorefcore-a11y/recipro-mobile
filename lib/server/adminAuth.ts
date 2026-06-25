import { verifyIdToken } from "@/lib/firebaseAdmin";

export function isAdminUser(uid: string): boolean {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  if (!raw.trim()) return false;
  return raw.split(",").map((s) => s.trim()).includes(uid);
}

export async function requireAdminFromRequest(
  req: Request
): Promise<{ ok: true; uid: string } | { ok: false; status: number; error: string }> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return { ok: false, status: 401, error: "Unauthorized" };

  const verified = await verifyIdToken(token);
  if (!verified) return { ok: false, status: 401, error: "Invalid token" };

  if (!isAdminUser(verified.uid)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, uid: verified.uid };
}
