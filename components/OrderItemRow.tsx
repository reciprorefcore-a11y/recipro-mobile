"use client";

type Props = {
  ingredientId: string;
  myCatalogId?: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  onChange: (ingredientId: string, quantity: number) => void;
};

export default function OrderItemRow({
  ingredientId,
  myCatalogId,
  ingredientName,
  unit,
  quantity,
  onChange,
}: Props) {
  const dec = () => onChange(ingredientId, Math.max(0, quantity - 1));
  const inc = () => onChange(ingredientId, quantity + 1);

  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid #f0f0f0",
        backgroundColor: quantity > 0 ? "#FFF8F5" : "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#111", marginBottom: 2, wordBreak: "break-all" }}>
            {ingredientName}
          </p>
          {myCatalogId && (
            <p style={{ fontSize: 11, color: "#999" }}>{myCatalogId}</p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={dec}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              border: "1.5px solid #ccc", backgroundColor: "#fff",
              fontSize: 18, fontWeight: "bold", color: "#555",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            −
          </button>
          <input
            type="number"
            value={quantity === 0 ? "" : quantity}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              onChange(ingredientId, Number.isFinite(v) && v >= 0 ? v : 0);
            }}
            placeholder="0"
            min={0}
            style={{
              width: 48, textAlign: "center", fontSize: 16, fontWeight: "bold",
              border: "1.5px solid #ddd", borderRadius: 8, padding: "4px 2px",
              outline: "none", color: quantity > 0 ? "#E85D2C" : "#999",
            }}
          />
          <button
            type="button"
            onClick={inc}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              border: "1.5px solid #E85D2C", backgroundColor: "#E85D2C",
              fontSize: 18, fontWeight: "bold", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            ＋
          </button>
          <span style={{ fontSize: 13, color: "#555", minWidth: 24 }}>{unit}</span>
        </div>
      </div>
    </div>
  );
}
