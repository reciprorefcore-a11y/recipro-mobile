import Card from "./ui/Card";

type Ingredient = {
  name: string;
  days: number;
  loss: string;
};

const INGREDIENTS: Ingredient[] = [
  { name: "豚バラスライス", days: 14, loss: "-12,500円" },
  { name: "玉ねぎ", days: 10, loss: "-6,200円" },
  { name: "鶏もも肉", days: 7, loss: "-4,800円" },
];

export default function UnupdatedIngredientsList() {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-warning.svg" alt="警告" width={20} height={20} />
        <p className="text-sm font-medium text-gray-700">
          先週から更新されていない食材があります
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {INGREDIENTS.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
          >
            <div>
              <p className="font-medium text-gray-900">{item.name}</p>
              <p className="text-xs text-warning">{item.days}日未更新</p>
            </div>
            <p className="font-semibold text-danger">{item.loss}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
