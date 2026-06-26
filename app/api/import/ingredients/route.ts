import { verifyIdToken, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import iconv from "iconv-lite";
import { parseReciproXlsx, type XlsxRow } from "@/lib/xlsxImporter";

// Vercel: Hobby=10s cap, Pro=最大300s
export const maxDuration = 60;

// CSVをパース (csvGenerator.ts のカラム順に準拠)
function parseCsvText(text: string): XlsxRow[] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        cells.push(current); current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    rows.push(cells);
  }

  const c = (row: string[], idx: number) => (row[idx] ?? "").trim();
  const optNum = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : undefined; };

  return rows.slice(1).flatMap((row) => {
    const myCatalogId = c(row, 0);
    const ingredientName = c(row, 6);
    if (!myCatalogId || !ingredientName) return [];
    return [{
      myCatalogId,
      ingredientName,
      ingredientNameKana: c(row, 24) || undefined,
      spec: c(row, 7) || undefined,
      unit: c(row, 8) || "個",
      currentPrice: optNum(c(row, 9)) ?? 0,
      oldPrice: optNum(c(row, 10)),
      supplier: c(row, 11) || undefined,
      supplierKana: c(row, 23) || undefined,
      smaregiCode: c(row, 5) || undefined,
      irisu: c(row, 25) || undefined,
    }];
  });
}

function makeSupplierDocId(name: string): string {
  return encodeURIComponent(name.trim()).replace(/%/g, "_").slice(0, 50);
}

type ExistingItem = {
  id: string;
  currentPrice: number;
  ingredientName: string;
  supplier?: string;
};

export async function POST(request: Request) {
  // ── 認証チェック ──────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return Response.json(
      { error: "ログインが必要です。再ログインしてお試しください。" },
      { status: 401 }
    );
  }

  const user = await verifyIdToken(token);
  if (!user) {
    return Response.json(
      { error: "認証に失敗しました。ログインし直してお試しください。" },
      { status: 401 }
    );
  }

  // ── リクエストのパース ────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    console.error("[import/ingredients] formData parse error:", e);
    return Response.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const file = formData.get("file");
  const preview = formData.get("preview") === "true";

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "ファイルが見つかりません" }, { status: 400 });
  }

  const fileName = file instanceof File ? file.name : "file";
  const isXlsx = /\.(xlsx|xls)$/i.test(fileName);

  // ── ファイルのパース ──────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer();
  let rows: XlsxRow[];

  try {
    if (isXlsx) {
      rows = await parseReciproXlsx(Buffer.from(arrayBuffer));
    } else {
      const csvText = iconv.decode(Buffer.from(arrayBuffer), "Shift_JIS");
      rows = parseCsvText(csvText);
    }
  } catch (e) {
    console.error("[import/ingredients] parse error:", e);
    return Response.json(
      { error: `ファイルの解析に失敗しました: ${e instanceof Error ? e.message : "不明なエラー"}` },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return Response.json(
      { error: "有効なデータが含まれていません。ファイル形式を確認してください。" },
      { status: 400 }
    );
  }

  // 取引先を集計
  const supplierMap = new Map<string, string | undefined>();
  for (const row of rows) {
    if (row.supplier && !supplierMap.has(row.supplier)) {
      supplierMap.set(row.supplier, row.supplierKana);
    }
  }
  const suppliers = [...supplierMap.entries()].map(([name, nameKana]) => ({ name, nameKana }));

  // ── Firestore 接続 ────────────────────────────────────────
  let db: FirebaseFirestore.Firestore;
  try {
    db = getAdminDb();
  } catch (e) {
    console.error("[import/ingredients] getAdminDb failed:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "データベース接続に失敗しました。FIREBASE_SERVICE_ACCOUNT_KEY を確認してください。" },
      { status: 500 }
    );
  }

  const companyId = user.uid;
  const ingredientsCol = db.collection("companies").doc(companyId).collection("ingredients");

  // ── 既存食材を取得してdiff計算 ────────────────────────────
  let existingByMyCatalogId: Map<string, ExistingItem>;
  let totalExisting: number;

  try {
    const existingSnap = await ingredientsCol.get();
    existingByMyCatalogId = new Map();
    for (const d of existingSnap.docs) {
      const data = d.data();
      const mid = data.myCatalogId as string | undefined;
      if (mid) {
        existingByMyCatalogId.set(mid, {
          id: d.id,
          currentPrice: typeof data.currentPrice === "number" ? data.currentPrice : 0,
          ingredientName: typeof data.ingredientName === "string" ? data.ingredientName : "",
          supplier: typeof data.supplier === "string" ? data.supplier : undefined,
        });
      }
    }
    totalExisting = existingSnap.size;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[import/ingredients] fetch existing error:", msg);
    return Response.json({ error: `既存データの取得に失敗しました: ${msg}` }, { status: 500 });
  }

  // diff計算
  const importIds = new Set<string>();
  let toAdd = 0, toUpdate = 0, unchanged = 0;

  for (const row of rows) {
    if (!row.myCatalogId || !row.ingredientName) continue;
    importIds.add(row.myCatalogId);
    const existing = existingByMyCatalogId.get(row.myCatalogId);
    if (!existing) {
      toAdd++;
    } else if (existing.currentPrice !== row.currentPrice) {
      toUpdate++;
    } else {
      unchanged++;
    }
  }

  // localOnly: 既存でimportにマッチしない食材（削除されない）
  const localOnly = totalExisting - (toUpdate + unchanged);

  // ── プレビューモード (保存なし) ──────────────────────────
  if (preview) {
    return Response.json({
      total: rows.length,
      toAdd,
      toUpdate,
      unchanged,
      localOnly: Math.max(0, localOnly),
      supplierCount: suppliers.length,
      suppliers: suppliers.map((s) => s.name),
    });
  }

  // ── 取り込み実行 ──────────────────────────────────────────
  try {
    const suppliersCol = db.collection("companies").doc(companyId).collection("suppliers");
    const [existingSupplierSnap] = await Promise.all([suppliersCol.get()]);

    const existingSupplierNames = new Set(
      existingSupplierSnap.docs.map((d) => d.data().name as string)
    );

    const now = FieldValue.serverTimestamp();

    // ── スナップショット保存（更新前の価格を記録）──────────
    const snapshotItems: Array<{
      ingredientId: string;
      ingredientName: string;
      oldPrice: number;
      newPrice: number;
      supplier?: string;
      isNew: boolean;
    }> = [];

    for (const row of rows) {
      if (!row.myCatalogId || !row.ingredientName) continue;
      const existing = existingByMyCatalogId.get(row.myCatalogId);
      if (existing && existing.currentPrice !== row.currentPrice) {
        snapshotItems.push({
          ingredientId: existing.id,
          ingredientName: existing.ingredientName,
          oldPrice: existing.currentPrice,
          newPrice: row.currentPrice,
          ...(existing.supplier ? { supplier: existing.supplier } : {}),
          isNew: false,
        });
      }
    }

    if (snapshotItems.length > 0) {
      const snapshotRef = db.collection("companies").doc(companyId).collection("ingredientSnapshots").doc();
      await snapshotRef.set({
        companyId,
        createdAt: now,
        createdBy: companyId,
        status: "active",
        type: "before-import",
        description: `レシプロ取り込み: ${toAdd}件追加 ${toUpdate}件更新`,
        items: snapshotItems,
      });
    }

    // ── 食材バッチ書き込み ────────────────────────────────
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let opsInBatch = 0;
    let added = 0, updated = 0, skipped = 0, actualUnchanged = 0;

    const flushBatch = async () => {
      if (opsInBatch > 0) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    };

    for (const row of rows) {
      if (!row.myCatalogId || !row.ingredientName) { skipped++; continue; }

      const existing = existingByMyCatalogId.get(row.myCatalogId);

      if (existing && existing.currentPrice === row.currentPrice) {
        // 価格変化なし — Firestoreを更新せずスキップ
        actualUnchanged++;
        continue;
      }

      const supplierDocId = row.supplier ? makeSupplierDocId(row.supplier) : undefined;

      if (existing) {
        // 更新: categoryは保持（上書きしない）、source/lastSyncedFromReciproAtを設定
        batch.update(ingredientsCol.doc(existing.id), {
          ingredientName: row.ingredientName,
          ...(row.ingredientNameKana && { ingredientNameKana: row.ingredientNameKana }),
          ...(row.smaregiCode && { smaregiCode: row.smaregiCode }),
          ...(row.spec && { spec: row.spec }),
          unit: row.unit,
          currentPrice: row.currentPrice,
          oldPrice: existing.currentPrice,
          ...(row.supplier && { supplier: row.supplier }),
          ...(supplierDocId && { supplierId: supplierDocId }),
          ...(row.supplierKana && { supplierKana: row.supplierKana }),
          ...(row.irisu && { irisu: row.irisu }),
          source: "recipro",
          lastSyncedFromReciproAt: now,
          isActive: true,
          updatedAt: now,
        });
        updated++;
      } else {
        // 新規追加
        const uniqueId = `${companyId.slice(0, 8)}_recipro_${row.myCatalogId}`;
        const newRef = ingredientsCol.doc();
        batch.set(newRef, {
          myCatalogId: row.myCatalogId,
          ingredientName: row.ingredientName,
          companyId,
          ...(row.ingredientNameKana && { ingredientNameKana: row.ingredientNameKana }),
          ...(row.smaregiCode && { smaregiCode: row.smaregiCode }),
          ...(row.spec && { spec: row.spec }),
          unit: row.unit,
          currentPrice: row.currentPrice,
          ...(row.oldPrice !== undefined && { oldPrice: row.oldPrice }),
          ...(row.supplier && { supplier: row.supplier }),
          ...(supplierDocId && { supplierId: supplierDocId }),
          ...(row.supplierKana && { supplierKana: row.supplierKana }),
          ...(row.irisu && { irisu: row.irisu }),
          source: "recipro",
          lastSyncedFromReciproAt: now,
          uniqueId,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        added++;
      }

      opsInBatch++;
      if (opsInBatch >= BATCH_SIZE) {
        await flushBatch();
      }
    }
    await flushBatch();

    // ── 取引先マスタ upsert ──────────────────────────────
    const newSuppliers: string[] = [];
    const supplierBatch = db.batch();

    for (const { name, nameKana } of suppliers) {
      const docId = makeSupplierDocId(name);
      const ref = suppliersCol.doc(docId);
      if (existingSupplierNames.has(name)) {
        supplierBatch.update(ref, {
          usageCount: FieldValue.increment(1),
          updatedAt: now,
        });
      } else {
        supplierBatch.set(ref, {
          name,
          nameKana: nameKana ?? null,
          companyId,
          usageCount: 1,
          createdAt: now,
          updatedAt: now,
        });
        newSuppliers.push(name);
      }
    }

    if (suppliers.length > 0) {
      await supplierBatch.commit();
    }

    console.log(
      `[import/ingredients] uid=${companyId} added=${added} updated=${updated} unchanged=${actualUnchanged} skipped=${skipped}`
    );

    return Response.json({
      added,
      updated,
      unchanged: actualUnchanged,
      skipped,
      localOnly: Math.max(0, localOnly),
      supplierCount: suppliers.length,
      newSupplierCount: newSuppliers.length,
      suppliers: suppliers.map((s) => s.name),
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[import/ingredients] Firestore error:", msg);
    return Response.json(
      { error: `保存中にエラーが発生しました: ${msg}` },
      { status: 500 }
    );
  }
}
