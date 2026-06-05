import type { OrderItem } from "@/types";

type OrderDocParams = {
  supplierName: string;
  storeName: string;
  items: OrderItem[];
  deliveryDate: string;
  generalNote: string;
};

function formatDeliveryDate(value: string): string {
  if (value === "asap") return "入荷次第";
  if (value === "today") {
    const d = new Date();
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  }
  if (value === "tomorrow") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  }
  // YYYY-MM-DD
  const parts = value.split("-");
  if (parts.length === 3) return `${parts[0]}/${parts[1]}/${parts[2]}`;
  return value;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function generateOrderHtml(params: OrderDocParams): string {
  const now = new Date();
  const nowStr = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const deliveryStr = formatDeliveryDate(params.deliveryDate);

  const rows = params.items
    .map(
      (item) => `
      <tr>
        <td>${item.myCatalogId ?? ""}</td>
        <td>${item.ingredientName}</td>
        <td class="qty">${item.quantity}</td>
        <td>${item.unit}</td>
        <td>${item.note ?? ""}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>発注書 - ${params.supplierName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; font-size: 13px; color: #111; padding: 24px; max-width: 680px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 20px; border-bottom: 2px solid #111; padding-bottom: 8px; }
  .meta { margin-bottom: 16px; }
  .meta p { margin: 4px 0; }
  .box { border: 1px solid #333; padding: 8px 12px; margin: 12px 0; font-size: 14px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #555; padding: 7px 8px; text-align: left; font-size: 13px; }
  th { background: #f0f0f0; font-weight: bold; }
  td.qty { text-align: right; }
  .note-section { margin-top: 16px; }
  .note-section h3 { font-size: 13px; font-weight: bold; margin-bottom: 4px; }
  .note-content { border: 1px solid #ccc; padding: 8px; min-height: 48px; font-size: 13px; white-space: pre-wrap; }
  @media print {
    body { padding: 16px; }
    button { display: none; }
  }
</style>
</head>
<body>
<h1>発 注 書</h1>
<div class="meta">
  <p>作成日時: ${nowStr}</p>
  <p>発注元: ${params.storeName}</p>
  <p>発注先: <strong>${params.supplierName}</strong></p>
</div>
<div class="box">納品希望日: ${deliveryStr}</div>
<table>
  <thead>
    <tr>
      <th>商品コード</th>
      <th>商品名</th>
      <th>数量</th>
      <th>単位</th>
      <th>特記事項</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
${
  params.generalNote
    ? `<div class="note-section">
  <h3>備考</h3>
  <div class="note-content">${params.generalNote}</div>
</div>`
    : ""
}
<p style="margin-top:24px;font-size:11px;color:#888;">※ このPDFはReciproモバイルで生成されました</p>
</body>
</html>`;
}

export function openOrderPrintWindow(params: OrderDocParams): void {
  const html = generateOrderHtml(params);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.onload = () => {
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 300);
    };
  } else {
    URL.revokeObjectURL(url);
  }
}

export function generateLineText(params: OrderDocParams): string {
  const deliveryStr = formatDeliveryDate(params.deliveryDate);
  const lines = [
    `【発注書】${params.storeName}`,
    `発注先: ${params.supplierName}`,
    `納品希望日: ${deliveryStr}`,
    "",
    ...params.items.map(
      (item) => `・${item.ingredientName}　${item.quantity}${item.unit}${item.note ? `（${item.note}）` : ""}`
    ),
  ];
  if (params.generalNote) {
    lines.push("", `備考: ${params.generalNote}`);
  }
  return lines.join("\n");
}

export function generateMailtoUrl(params: OrderDocParams): string {
  const deliveryStr = formatDeliveryDate(params.deliveryDate);
  const subject = encodeURIComponent(`発注書 ${params.storeName} → ${params.supplierName}`);
  const body = encodeURIComponent(generateLineText(params) + `\n\n納品希望日: ${deliveryStr}`);
  return `mailto:?subject=${subject}&body=${body}`;
}
