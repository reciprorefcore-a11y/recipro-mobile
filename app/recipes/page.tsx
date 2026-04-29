export default function RecipesPage() {
  return (
    <main className="min-h-screen bg-bg flex justify-center">
      <div className="w-full max-w-[480px] px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-text">レシピ</h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-recipe.svg"
            alt=""
            width={48}
            height={48}
            className="opacity-30"
          />
          <p className="font-semibold text-text">準備中</p>
          <p className="text-sm text-sub-text">
            レシピ機能は Phase 2 で実装予定です。
          </p>
        </div>
      </div>
    </main>
  );
}
