import Card from "./ui/Card";

export default function ImprovementCard() {
  return (
    <Card className="border-l-4 border-success">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-check.svg" alt="" width={24} height={24} />
        <p className="text-success font-semibold">
          昨日の更新で +14,000円改善
        </p>
      </div>
    </Card>
  );
}
