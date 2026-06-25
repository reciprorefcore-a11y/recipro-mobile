import { verifyIdToken } from "@/lib/firebaseAdmin";
import iconv from "iconv-lite";

const COLUMNS = [
  "［マイカタログID］",
  "［食品小分類コード］",
  "［食品大分類名］",
  "［食品中分類名］",
  "［食品小分類名］",
  "［商品システムコード］",
  "［商品名］",
  "［規格］",
  "［入数単位］",
  "［単価］",
  "［旧単価］",
  "［取引先名］",
  "［単価変更日］",
  "［自社管理入数］",
  "［自社管理入数単位］",
  "［発注単価］",
  "［発注単位］",
  "［マイカタログ単価］",
  "［マイカタログ旧単価］",
  "［マイカタログ単位］",
  "［マイカタログ変更日］",
  "［食品大分類コード］",
  "［食品中分類コード］",
  "［取引先名カナ］",
  "［商品名カナ］",
  "［入数］",
] as const;

type ColumnName = (typeof COLUMNS)[number];
type SetDataRow = Record<ColumnName, string>;

function parseCsv(text: string): string[][] {
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
        if (inQuote && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === "," && !inQuote) {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    rows.push(cells);
  }
  return rows;
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
  } catch (e) {
    console.error("[parse-master-csv] formData error:", e);
    return Response.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const file = formData.get("csv");
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "CSVファイルが見つかりません" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  let csvText: string;
  try {
    csvText = iconv.decode(Buffer.from(arrayBuffer), "Shift_JIS");
  } catch {
    csvText = new TextDecoder("utf-8").decode(arrayBuffer);
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return Response.json({ error: "CSVにデータが含まれていません" }, { status: 400 });
  }

  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);

  // ヘッダー名 → 列インデックスのマップ（重複ヘッダーは「先勝ち」で管理）
  // 例: 神田食堂CSV では ［単価］ が col9 と col17 に両方出現するが、
  //     col9（実単価）を正として col17（マイカタログ単価）へは fallbackIdx で到達する
  const headerMap = new Map<string, number>();
  headers.forEach((h, i) => {
    if (!headerMap.has(h)) headerMap.set(h, i);
  });

  // ヘッダー名が COLUMNS と完全一致しない列 (エイリアス・重複後出し等)
  // → fallbackIdx（位置ベース）で自動補完されるので実害はないが画面に表示する
  const positionFallbackColumns: string[] = [];
  for (const col of COLUMNS) {
    if (!headerMap.has(col)) positionFallbackColumns.push(col);
  }

  // ヘッダーが半分以上マッチしない場合は完全インデックスベースにフォールバック
  const useIndexBased = positionFallbackColumns.length > COLUMNS.length / 2;

  const c = (row: string[], col: ColumnName, fallbackIdx: number): string => {
    if (useIndexBased) return (row[fallbackIdx] ?? "").trim();
    const idx = headerMap.get(col) ?? fallbackIdx;
    return (row[idx] ?? "").trim();
  };

  const setData: SetDataRow[] = dataRows
    .map((row) => ({
      "［マイカタログID］": c(row, "［マイカタログID］", 0),
      "［食品小分類コード］": c(row, "［食品小分類コード］", 1),
      "［食品大分類名］": c(row, "［食品大分類名］", 2),
      "［食品中分類名］": c(row, "［食品中分類名］", 3),
      "［食品小分類名］": c(row, "［食品小分類名］", 4),
      "［商品システムコード］": c(row, "［商品システムコード］", 5),
      "［商品名］": c(row, "［商品名］", 6),
      "［規格］": c(row, "［規格］", 7),
      "［入数単位］": c(row, "［入数単位］", 8),
      "［単価］": c(row, "［単価］", 9),
      "［旧単価］": c(row, "［旧単価］", 10),
      "［取引先名］": c(row, "［取引先名］", 11),
      "［単価変更日］": c(row, "［単価変更日］", 12),
      "［自社管理入数］": c(row, "［自社管理入数］", 13),
      "［自社管理入数単位］": c(row, "［自社管理入数単位］", 14),
      "［発注単価］": c(row, "［発注単価］", 15),
      "［発注単位］": c(row, "［発注単位］", 16),
      "［マイカタログ単価］": c(row, "［マイカタログ単価］", 17),
      "［マイカタログ旧単価］": c(row, "［マイカタログ旧単価］", 18),
      "［マイカタログ単位］": c(row, "［マイカタログ単位］", 19),
      "［マイカタログ変更日］": c(row, "［マイカタログ変更日］", 20),
      "［食品大分類コード］": c(row, "［食品大分類コード］", 21),
      "［食品中分類コード］": c(row, "［食品中分類コード］", 22),
      "［取引先名カナ］": c(row, "［取引先名カナ］", 23),
      "［商品名カナ］": c(row, "［商品名カナ］", 24),
      "［入数］": c(row, "［入数］", 25),
    }))
    .filter((row) => row["［マイカタログID］"] || row["［商品名］"]);

  return Response.json({
    setData,
    total: setData.length,
    headers,
    unmappedColumns: positionFallbackColumns,
    parseMode: useIndexBased ? "index" : "header",
  });
}
