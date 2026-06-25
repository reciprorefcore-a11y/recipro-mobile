import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/server/adminAuth";

export async function GET(req: Request) {
  const result = await requireAdminFromRequest(req);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, uid: result.uid });
}
