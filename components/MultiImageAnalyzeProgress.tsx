"use client";

type Props = {
  current: number;
  total: number;
  label: string;
};

export default function MultiImageAnalyzeProgress({ current, total, label }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-3">
      <span className="block h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <p className="text-sm font-bold text-gray-700">{label}</p>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm text-gray-600">
        {current} / {total} 解析中
      </p>
      <p className="text-xs text-gray-400">そのままお待ちください</p>
    </div>
  );
}
