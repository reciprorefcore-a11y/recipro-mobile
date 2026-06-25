export type MasterCandidate = {
  id: string;
  name: string;
  score: number;
  reason: string;
};

function normalizeName(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s　]/g, "")
    .replace(/[ァ-ン]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function findMasterCandidates(
  ocrName: string,
  ocrSupplier: string | undefined,
  ocrPrice: number | undefined,
  masterRecords: Record<string, string>[],
  maxResults = 3
): MasterCandidate[] {
  const normInput = normalizeName(ocrName);
  if (normInput.length < 2) return [];

  type Scored = MasterCandidate & { _score: number };
  const scored: Scored[] = [];

  for (const rec of masterRecords) {
    const id = rec["［マイカタログID］"];
    if (!id) continue;
    const masterName = rec["［商品名］"] ?? "";
    const normMaster = normalizeName(masterName);
    const normKana = normalizeName(rec["［商品名カナ］"] ?? "");

    let score = 0;
    const reasons: string[] = [];

    if (normMaster === normInput || (normKana.length >= 2 && normKana === normInput)) {
      score += 100;
      reasons.push("商品名完全一致");
    } else if (normMaster.length >= 2 && (normMaster.includes(normInput) || normInput.includes(normMaster))) {
      score += 60;
      reasons.push("商品名部分一致");
    } else if (normKana.length >= 2 && (normKana.includes(normInput) || normInput.includes(normKana))) {
      score += 50;
      reasons.push("読み仮名部分一致");
    } else {
      continue;
    }

    if (ocrSupplier) {
      const normOcrSup = normalizeName(ocrSupplier);
      const normMasterSup = normalizeName(rec["［取引先名］"] ?? "");
      if (
        normOcrSup.length >= 2 &&
        normMasterSup.length >= 2 &&
        (normMasterSup.includes(normOcrSup) || normOcrSup.includes(normMasterSup))
      ) {
        score += 20;
        reasons.push("取引先一致");
      }
    }

    if (ocrPrice && ocrPrice > 0) {
      const masterPrice = Number(rec["［単価］"]);
      if (Number.isFinite(masterPrice) && masterPrice > 0) {
        const ratio = Math.abs(masterPrice - ocrPrice) / ocrPrice;
        if (ratio < 0.05) {
          score += 15;
          reasons.push("単価ほぼ同一");
        } else if (ratio < 0.2) {
          score += 5;
          reasons.push("単価近似");
        }
      }
    }

    scored.push({ id, name: masterName, score, reason: reasons.join("・"), _score: score });
  }

  return scored
    .sort((a, b) => b._score - a._score)
    .slice(0, maxResults)
    .map(({ id, name, score, reason }) => ({ id, name, score, reason }));
}

export function nextMobileIdFromMaster(masterRecords: Record<string, string>[]): string {
  const mobileIds = masterRecords
    .map((r) => Number(r["［マイカタログID］"]))
    .filter((n) => Number.isFinite(n) && n >= 10000);
  const maxId = mobileIds.length > 0 ? Math.max(...mobileIds) : 9999;
  return String(maxId + 1);
}
