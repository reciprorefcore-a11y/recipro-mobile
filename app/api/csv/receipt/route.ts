import { verifyIdToken } from "@/lib/firebaseAdmin";
import { generateReceiptCsvString, type ReceiptCsvInput } from "@/lib/csvGenerator";
import iconv from "iconv-lite";

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) return new Response("Unauthorized", { status: 401 });

  const user = await verifyIdToken(token);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json()) as { items?: ReceiptCsvInput[] };
  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return new Response("Bad Request", { status: 400 });
  }

  const csvString = generateReceiptCsvString(body.items);
  const encoded = iconv.encode(csvString, "Shift_JIS");
  const buffer = new Uint8Array(encoded);
  const filename = encodeURIComponent(`伝票_${todayString()}.csv`);

  return new Response(buffer, {
    headers: {
      "Content-Type": "text/csv; charset=Shift_JIS",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}
