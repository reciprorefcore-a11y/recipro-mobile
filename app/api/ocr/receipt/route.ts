import Anthropic from "@anthropic-ai/sdk";
import { verifyIdToken } from "@/lib/firebaseAdmin";

export type OcrItem = {
  name: string;
  spec?: string;
  price?: number;
  quantity?: number;
  supplier?: string;
};

const SYSTEM_PROMPT = `あなたは飲食店の食材管理システムです。
納品書・伝票・レシートの画像から食材情報を抽出し、厳密にJSONのみを返してください。
説明文・Markdownは禁止です。

出力形式:
{
  "items": [
    {
      "name": "商品名（必須）",
      "spec": "規格（例: 1kg, 5L, 10個入）",
      "price": 1200,
      "quantity": 2,
      "supplier": "取引先名"
    }
  ]
}

- price は単価（円）の数値。読み取れない場合は null
- quantity は数量の数値。読み取れない場合は null
- spec, supplier は読み取れない場合は省略または null`;

type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function detectMediaType(blob: Blob): MediaType {
  const t = blob.type;
  if (t === "image/png") return "image/png";
  if (t === "image/gif") return "image/gif";
  if (t === "image/webp") return "image/webp";
  return "image/jpeg";
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const user = await verifyIdToken(token);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const file = formData.get("image");
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "画像ファイルが見つかりません" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY が未設定です" }, { status: 500 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mediaType = detectMediaType(file);

  const anthropic = new Anthropic({ apiKey });
  let rawText: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: "この画像から食材情報を抽出してください。" },
          ],
        },
      ],
    });
    const block = message.content.find((b) => b.type === "text");
    rawText = block?.type === "text" ? block.text : "";
  } catch (err) {
    console.error("[ocr/receipt] Anthropic error:", err);
    return Response.json({ error: "OCR解析に失敗しました" }, { status: 502 });
  }

  let items: OcrItem[] = [];
  try {
    const cleaned = rawText.trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleaned) as { items?: unknown[] };
    if (Array.isArray(parsed.items)) {
      items = parsed.items
        .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
        .filter((i) => typeof i.name === "string" && (i.name as string).trim())
        .map((i) => ({
          name: String(i.name).trim(),
          spec: i.spec ? String(i.spec).trim() : undefined,
          price:
            typeof i.price === "number" && Number.isFinite(i.price)
              ? i.price
              : undefined,
          quantity:
            typeof i.quantity === "number" && Number.isFinite(i.quantity)
              ? i.quantity
              : undefined,
          supplier: i.supplier ? String(i.supplier).trim() : undefined,
        }));
    }
  } catch {
    console.error("[ocr/receipt] JSON parse error, raw:", rawText);
    return Response.json(
      { error: "AIの応答をパースできませんでした", raw: rawText },
      { status: 422 }
    );
  }

  return Response.json({ items, total: items.length });
}
