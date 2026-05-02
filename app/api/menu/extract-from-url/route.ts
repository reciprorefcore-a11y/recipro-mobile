import Anthropic from "@anthropic-ai/sdk";
import { verifyIdToken } from "@/lib/firebaseAdmin";

const SYSTEM_PROMPT = `あなたは飲食店のメニュー解析AIです。
与えられたウェブページのテキストからメニュー項目（商品名と価格）を抽出してください。
出力は厳密にJSONのみ。説明文やMarkdownは禁止。
形式:
{
  "products": [
    { "name": "商品名", "price": 980, "confidence": 0.9 }
  ]
}
メニュー項目が見つからない場合は products を空配列にしてください。`;

// Block private/internal network ranges to prevent SSRF
const PRIVATE_HOST_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|::1|fc00:|fe80:)/i;

type RequestBody = {
  url?: string;
  companyId?: string;
};

type ExtractedProduct = {
  name: string;
  price: number;
  confidence: number;
};

export async function POST(request: Request) {
  try {
    const authResult = await verifyFirebaseUser(request);
    if (!authResult.ok) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;
    const url = body.url?.trim();
    const companyId = body.companyId?.trim();

    if (!url || !companyId) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    if (companyId !== authResult.uid) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return Response.json({ error: "Invalid URL" }, { status: 422 });
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return Response.json({ error: "Invalid URL protocol" }, { status: 422 });
    }
    if (PRIVATE_HOST_RE.test(parsedUrl.hostname)) {
      return Response.json({ error: "Invalid URL" }, { status: 422 });
    }

    // Fetch page content with timeout
    let html: string;
    try {
      const pageRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ReciproBot/1.0; +https://recipro.jp)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ja,en;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!pageRes.ok) {
        return Response.json({ error: "Failed to fetch URL" }, { status: 422 });
      }
      const contentType = pageRes.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        return Response.json({ error: "URL is not an HTML page" }, { status: 422 });
      }
      html = await pageRes.text();
    } catch {
      return Response.json({ error: "Failed to fetch URL" }, { status: 422 });
    }

    const pageText = extractText(html).slice(0, 8000);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "AI not configured" }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `以下のウェブページのテキストからメニュー項目を抽出してください:\n\n${pageText}`,
        },
      ],
    });

    const text = message.content.find((b) => b.type === "text")?.text ?? "";
    const jsonText = text.trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(jsonText) as { products?: unknown[] };

    const products: ExtractedProduct[] = Array.isArray(parsed.products)
      ? parsed.products
          .filter(
            (p): p is { name: unknown; price: unknown; confidence?: unknown } =>
              typeof p === "object" && p !== null
          )
          .filter((p) => p.name && Number.isFinite(Number(p.price)) && Number(p.price) > 0)
          .map((p) => ({
            name: String(p.name),
            price: Number(p.price),
            confidence: Math.min(1, Math.max(0, Number(p.confidence) || 0.7)),
          }))
      : [];

    return Response.json({ products });
  } catch (error) {
    console.error("extract-from-url failed", error);
    return Response.json({ error: "Failed to extract menu" }, { status: 500 });
  }
}

function extractText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function verifyFirebaseUser(
  request: Request
): Promise<{ ok: true; uid: string } | { ok: false }> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return { ok: false };
  const result = await verifyIdToken(token);
  return result ? { ok: true, uid: result.uid } : { ok: false };
}
