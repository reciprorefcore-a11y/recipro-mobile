import { verifyIdToken, getAdminDb } from "@/lib/firebaseAdmin";
import { generateCsvString } from "@/lib/csvGenerator";
import iconv from "iconv-lite";
import type { Ingredient } from "@/types";

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await verifyIdToken(token);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const companyId = user.uid;
  const db = getAdminDb();

  const snap = await db
    .collection("companies")
    .doc(companyId)
    .collection("ingredients")
    .get();

  const ingredients: Ingredient[] = snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      uniqueId: data.uniqueId ?? docSnap.id,
      companyId,
      ingredientName: data.ingredientName ?? "",
      unit: data.unit ?? "",
      currentPrice: data.currentPrice ?? 0,
      isActive: data.isActive !== false,
      ...data,
    } as Ingredient;
  });

  const csvString = generateCsvString(ingredients);
  const encoded = iconv.encode(csvString, "Shift_JIS");
  const buffer = new Uint8Array(encoded);
  const filename = `ingredient_master_${todayString()}.csv`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "text/csv; charset=Shift_JIS",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
