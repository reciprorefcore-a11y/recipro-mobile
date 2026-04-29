import Anthropic from "@anthropic-ai/sdk";

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

type RequestBody = {
  url?: string;
  companyId?: string;
};

type ExtractedProduct = {
  name: string;
  price: number;
  confidence: number;
};

type FirebaseLookupResponse = {
  users?: { localId?: string }[];
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
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !firebaseApiKey) return { ok: false };

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      cache: "no-store",
    }
  );
  if (!res.ok) return { ok: false };
  const data = (await res.json()) as FirebaseLookupResponse;
  const uid = data.users?.[0]?.localId;
  return uid ? { ok: true, uid } : { ok: false };
}
