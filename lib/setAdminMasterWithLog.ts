import { computeMasterDiff } from "./masterDiff";
import { saveChangeLog } from "./masterChangeLog";
import { decodeJwtPayload } from "./jwtUtils";

export interface SetAdminMasterArgs {
  customerID: string;
  storeID: string;
  setData: Record<string, string>[];
  reciproToken: string;
  current: Record<string, string>[];
  source: "master-import" | "ocr-import";
  triggerUserEmail: string | null;
}

export interface SetAdminMasterResult {
  ok: boolean;
  status: number;
  data: unknown;
}

function extractEmailFromJwt(token: string): string | null {
  const payload = decodeJwtPayload(token);
  return payload && typeof payload.email === "string" ? payload.email : null;
}

export async function setAdminMasterWithLog(
  args: SetAdminMasterArgs
): Promise<SetAdminMasterResult> {
  const { customerID, storeID, setData, reciproToken, current, source, triggerUserEmail } = args;

  // 1. 差分計算（ログ用）
  const diff = computeMasterDiff(current, setData);

  // 2. プロキシ経由で setAdminMaster（サーバー側が admin トークンで代理実行）
  const res = await fetch("/api/recipro/setMaster", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${reciproToken}`,
    },
    body: JSON.stringify({ customerID, storeID, setData }),
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    return { ok: false, status: res.status, data };
  }

  // 3. Firestore にログ書き込み（失敗は警告のみ、setAdminMaster の成功は返す）
  const reciproAdminEmail = extractEmailFromJwt(reciproToken);

  const changes = [
    ...diff.newItems.map((item) => ({
      id: item.id,
      type: "new" as const,
      productName: item.record["［商品名］"] ?? "",
      diffs: [],
    })),
    ...diff.updatedItems.map((item) => ({
      id: item.id,
      type: "updated" as const,
      productName: item.nextRecord["［商品名］"] ?? "",
      diffs: item.diffs,
    })),
  ];

  try {
    await saveChangeLog(customerID, {
      customerID,
      storeID,
      createdAtIso: new Date().toISOString(),
      triggerUserEmail,
      reciproAdminEmail,
      source,
      summary: {
        newCount: diff.newItems.length,
        updatedCount: diff.updatedItems.length,
        unchangedCount: diff.unchangedItems.length,
        removedCount: diff.removedItems.length,
      },
      changes,
    });
  } catch (err) {
    console.warn("[setAdminMasterWithLog] ログ書き込み失敗（反映は成功済み）:", err);
  }

  return { ok: true, status: res.status, data };
}
