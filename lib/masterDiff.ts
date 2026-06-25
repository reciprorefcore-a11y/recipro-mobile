export type DiffField = {
  field: string;
  oldValue: string;
  newValue: string;
};

export type NewItem = {
  id: string;
  record: Record<string, string>;
};

export type UpdatedItem = {
  id: string;
  diffs: DiffField[];
  currentRecord: Record<string, string>;
  nextRecord: Record<string, string>;
};

export type RemovedItem = {
  id: string;
  record: Record<string, string>;
};

export type MasterDiff = {
  newItems: NewItem[];
  updatedItems: UpdatedItem[];
  unchangedItems: { id: string }[];
  removedItems: RemovedItem[];
};

const COMPARE_FIELDS = [
  "［商品名］",
  "［規格］",
  "［単価］",
  "［旧単価］",
  "［入数単位］",
  "［取引先名］",
] as const;

export function computeMasterDiff(
  current: Record<string, string>[],
  next: Record<string, string>[]
): MasterDiff {
  const currentMap = new Map<string, Record<string, string>>();
  for (const row of current) {
    const id = row["［マイカタログID］"];
    if (id) currentMap.set(id, row);
  }

  const newItems: NewItem[] = [];
  const updatedItems: UpdatedItem[] = [];
  const unchangedItems: { id: string }[] = [];
  const visitedIds = new Set<string>();

  for (const row of next) {
    const id = row["［マイカタログID］"];
    if (!id) continue;
    visitedIds.add(id);
    const currentRow = currentMap.get(id);
    if (!currentRow) {
      newItems.push({ id, record: row });
    } else {
      const diffs: DiffField[] = [];
      for (const field of COMPARE_FIELDS) {
        const oldValue = currentRow[field] ?? "";
        const newValue = row[field] ?? "";
        if (oldValue !== newValue) diffs.push({ field, oldValue, newValue });
      }
      if (diffs.length > 0) {
        updatedItems.push({ id, diffs, currentRecord: currentRow, nextRecord: row });
      } else {
        unchangedItems.push({ id });
      }
    }
  }

  const removedItems: RemovedItem[] = [];
  for (const [id, row] of currentMap) {
    if (!visitedIds.has(id)) removedItems.push({ id, record: row });
  }

  return { newItems, updatedItems, unchangedItems, removedItems };
}

export function diffIdRange(ids: string[]): { infomart: number; mobile: number; other: number } {
  let infomart = 0, mobile = 0, other = 0;
  for (const id of ids) {
    const n = Number(id);
    if (Number.isFinite(n) && n >= 1 && n <= 9999) infomart++;
    else if (Number.isFinite(n) && n >= 10000) mobile++;
    else other++;
  }
  return { infomart, mobile, other };
}
