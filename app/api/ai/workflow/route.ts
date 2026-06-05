import Anthropic from "@anthropic-ai/sdk";
import { verifyIdToken } from "@/lib/firebaseAdmin";
import { toKatakana } from "@/lib/textUtils";
import type { AiWorkflowResult } from "@/types";

const SYSTEM_PROMPT = `あなたは飲食店の原価管理AIです。
ユーザーには処理の複雑さを見せず、バックエンドで以下を一括実行します:
1. 伝票画像または入力情報の解析
2. 食材抽出
3. 商品・メニュー候補の推定
4. 使用食材の推定
5. 原価計算
6. 損失算出
7. 改善候補の生成

出力は厳密にJSONのみ。説明文やMarkdownは禁止。
形式:
{
  "items": [
    {
      "name": "食材名",
      "ingredientNameKana": "カタカナ読み（必ずカタカナで出力）",
      "price": 123,
      "unit": "kg",
      "quantity": 1,
      "confidence": 0.9,
      "supplier": "仕入先"
    }
  ],
  "menuCandidates": [
    {
      "name": "商品名",
      "confidence": 0.85,
      "estimatedMonthlySales": 900,
      "ingredients": ["食材A", "食材B"],
      "estimatedCost": 320,
      "estimatedPrice": 1280,
      "costRate": 0.25
    }
  ],
  "usageSummary": "使用食材の予測概要",
  "estimatedMonthlyLoss": 32000,
  "lossCauses": ["原因1", "原因2"],
  "highCostMenus": ["メニュー1"],
  "priceChangeCandidates": [{"title": "候補", "description": "説明", "impact": 12000}],
  "ingredientChangeCandidates": [{"title": "候補", "description": "説明", "impact": 8000}],
  "notes": "注意点"
}`;

const MAX_IMAGE_BYTES = 13_000_000; // ~10 MB after base64 decode

type AiWorkflowRequestBody = {
  imageBase64?: string;
  companyId?: string;
  source?: "receipt" | "menu";
};

export async function POST(request: Request) {
  try {
    const authResult = await verifyFirebaseUser(request);
    if (!authResult.ok) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as AiWorkflowRequestBody;
    const imageBase64 = body.imageBase64?.trim();
    const companyId = body.companyId?.trim();
    const source = body.source ?? "menu";

    if (!companyId) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    if (imageBase64 && imageBase64.length > MAX_IMAGE_BYTES) {
      return Response.json({ error: "Image too large" }, { status: 413 });
    }

    if (companyId !== authResult.uid) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Anthropic API key is not configured" }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserContent(source, imageBase64),
        },
      ],
    });

    const text = message.content.find((block) => block.type === "text")?.text;
    if (!text) {
      return Response.json({ error: "AI result is empty" }, { status: 422 });
    }

    return Response.json(parseWorkflowResult(text));
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    if (status === 429) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    console.error("AI workflow failed", error);
    return Response.json({ error: "AI workflow failed" }, { status: 500 });
  }
}

function buildUserContent(source: "receipt" | "menu", imageBase64?: string) {
  const text =
    source === "receipt"
      ? "この仕入伝票画像を解析し、食材・メニュー候補・原価影響・改善候補を一括推定してください。"
      : "飲食店メニューの原価影響分析として、代表的な商品候補・使用食材・原価影響・改善候補を一括推定してください。";

  if (!imageBase64) {
    return [{ type: "text" as const, text }];
  }

  const { data, mediaType } = parseImageData(imageBase64);
  return [
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: mediaType,
        data,
      },
    },
    { type: "text" as const, text },
  ];
}

async function verifyFirebaseUser(
  request: Request
): Promise<{ ok: true; uid: string } | { ok: false }> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return { ok: false };
  const result = await verifyIdToken(token);
  return result ? { ok: true, uid: result.uid } : { ok: false };
}

function parseImageData(imageBase64: string): {
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
} {
  const match = imageBase64.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/);
  if (!match) return { data: imageBase64, mediaType: "image/jpeg" };
  return {
    data: match[2],
    mediaType: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
  };
}

function parseWorkflowResult(text: string): AiWorkflowResult {
  const jsonText = text.trim().replace(/^```json\s*|\s*```$/g, "");
  const parsed = JSON.parse(jsonText) as Partial<AiWorkflowResult>;

  return {
    items: Array.isArray(parsed.items)
      ? parsed.items
          .filter((item) => item.name && Number.isFinite(Number(item.price)))
          .map((item) => ({
            name: String(item.name),
            ingredientNameKana: item.ingredientNameKana
              ? toKatakana(String(item.ingredientNameKana))
              : undefined,
            price: Number(item.price),
            unit: String(item.unit || "個"),
            quantity: optionalNumber(item.quantity),
            confidence: clamp(Number(item.confidence), 0, 1),
            supplier: item.supplier ? String(item.supplier) : undefined,
          }))
      : [],
    menuCandidates: Array.isArray(parsed.menuCandidates)
      ? parsed.menuCandidates.map((item) => ({
          name: String(item.name || "名称未設定"),
          confidence: clamp(Number(item.confidence), 0, 1),
          estimatedMonthlySales: optionalNumber(item.estimatedMonthlySales),
          ingredients: Array.isArray(item.ingredients)
            ? item.ingredients.map(String)
            : [],
          estimatedCost: optionalNumber(item.estimatedCost),
          estimatedPrice: optionalNumber(item.estimatedPrice),
          costRate: optionalNumber(item.costRate),
        }))
      : [],
    usageSummary: String(parsed.usageSummary || "使用食材を自動で予測しています。"),
    estimatedMonthlyLoss: optionalNumber(parsed.estimatedMonthlyLoss),
    lossCauses: toStringArray(parsed.lossCauses),
    highCostMenus: toStringArray(parsed.highCostMenus),
    priceChangeCandidates: toImprovementArray(parsed.priceChangeCandidates),
    ingredientChangeCandidates: toImprovementArray(parsed.ingredientChangeCandidates),
    notes: parsed.notes ? String(parsed.notes) : undefined,
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function toImprovementArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item as { title?: unknown; description?: unknown; impact?: unknown };
    return {
      title: String(record.title || "改善候補"),
      description: String(record.description || ""),
      impact: optionalNumber(record.impact),
    };
  });
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
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
