import Card from "./ui/Card";

export default function LossImpactCard() {
  return (
    <Card>
      <p className="text-sm text-gray-500 mb-1">今月の損失インパクト</p>
      <p className="text-3xl font-bold text-danger">-32,000円</p>
    </Card>
  );
}
