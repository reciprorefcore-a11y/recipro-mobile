import Anthropic from "@anthropic-ai/sdk";
import type { ReceiptAnalysisResult } from "@/types";

const SYSTEM_PROMPT = `あなたは飲食店の仕入伝票を解析する専門家です。
画像から以下を抽出してください:
1. 食材名(原材料名)
2. 単価(税抜)
3. 単位(kg, g, 個, L, ml, 本, 袋など)
出力は厳密に以下のJSON形式で返してください(他の説明文は不要):
{
  "items": [
    {
      "name": "食材名",
      "price": 数値,
      "unit": "単位",
      "confidence": 0.0〜1.0
    }
  ],
  "notes": "解析時の注意点(あれば)"
}
注意点:
- 手書きで読みにくい箇所はconfidenceを下げる
- 税込/税抜が不明な場合は税抜と仮定
- 1ケース価格と単価が両方ある場合は単価を採用
- 食材以外(消耗品、サービス料、消費税等)は除外`;

type AnalyzeRequestBody = {
  imageBase64?: string;
  companyId?: string;
};

type FirebaseLookupResponse = {
  users?: { localId?: string }[];
  error?: { message?: string };
};

export async function POST(request: Request) {
  try {
    const authResult = await verifyFirebaseUser(request);
    if (!authResult.ok) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as AnalyzeRequestBody;
    const imageBase64 = body.imageBase64?.trim();
    const companyId = body.companyId?.trim();

    if (!imageBase64 || !companyId) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    if (companyId !== authResult.uid) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Anthropic API key is not configured" }, { status: 500 });
    }

    const { data, mediaType } = parseImageData(imageBase64);
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 2000,
  system: SYSTEM_PROMPT,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data,
          },
        },
        {
          type: "text",
          text: "この仕入伝票画像を解析し、指定されたJSONのみを返してください。",
        },
      ],
    },
  ],
});
    const text = message.content.find((block) => block.type === "text")?.text;
    if (!text) {
      return Response.json({ error: "Image could not be analyzed" }, { status: 422 });
    }

    const result = parseAnalysisResult(text);
    return Response.json(result);
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    if (status === 429) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    console.error("Receipt analysis failed", error);
    return Response.json({ error: "Analysis failed" }, { status: 500 });
  }
}

async function verifyFirebaseUser(
  request: Request
): Promise<{ ok: true; uid: string } | { ok: false }> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!token || !firebaseApiKey) {
    return { ok: false };
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return { ok: false };
  }

  const data = (await response.json()) as FirebaseLookupResponse;
  const uid = data.users?.[0]?.localId;
  return uid ? { ok: true, uid } : { ok: false };
}

function parseImageData(imageBase64: string): {
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
} {
  const match = imageBase64.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/);
  if (!match) {
    return { data: imageBase64, mediaType: "image/jpeg" };
  }

  return {
    data: match[2],
    mediaType: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
  };
}

function parseAnalysisResult(text: string): ReceiptAnalysisResult {
  const jsonText = text.trim().replace(/^```json\s*|\s*```$/g, "");
  const parsed = JSON.parse(jsonText) as ReceiptAnalysisResult;

  return {
    items: Array.isArray(parsed.items)
      ? parsed.items
          .filter((item) => item.name && Number.isFinite(item.price))
          .map((item) => ({
            name: String(item.name),
            price: Number(item.price),
            unit: String(item.unit || "個"),
            confidence: clamp(Number(item.confidence), 0, 1),
          }))
      : [],
    notes: parsed.notes ? String(parsed.notes) : undefined,
  };
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}
