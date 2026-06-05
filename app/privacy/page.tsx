import Link from "next/link";

const ESTABLISHED_DATE = "2026年6月1日";
const REVISED_DATE = "2026年6月1日";

const sections = [
  {
    title: "1. 事業者情報",
    content: `名称：株式会社Refcore\n所在地：東京都（詳細は別途お問い合わせください）\nメールアドレス：support@refcore.co.jp\n\n当社は、飲食店向け原価管理・粗利損失可視化アプリケーション「レシプロ」（以下「本サービス」）を通じて取得した個人情報を、以下の方針に従って適切に取り扱います。`,
  },
  {
    title: "2. 取得する個人情報",
    content: `当社は、以下の個人情報を取得します。\n\n(1) 登録情報\n・メールアドレス\n・パスワード（暗号化して保存）\n・氏名・担当者名\n・企業名・店舗名\n・住所・郵便番号\n・電話番号・FAX番号\n\n(2) 利用情報\n・本サービスへのアクセスログ\n・利用履歴・操作ログ\n・端末情報（OSバージョン・ブラウザ種別等）\n・IPアドレス`,
  },
  {
    title: "3. 個人情報の取得方法",
    content: `当社は、以下の方法で個人情報を取得します。\n\n(1) ユーザーによる入力：本サービスへの登録・お問い合わせフォーム等を通じた直接入力\n(2) 自動収集：本サービスの利用に際してアクセスログ・クッキー等により自動的に収集\n(3) 第三者からの取得：Googleアカウント等のソーシャルログインを利用した場合、当該サービスから提供される情報`,
  },
  {
    title: "4. 個人情報の利用目的",
    content: `当社は、取得した個人情報を以下の目的で利用します。\n\n(1) 本サービスの提供・運営・維持・改善\n(2) ユーザーの認証・本人確認\n(3) ユーザーへの重要なお知らせ・サービス情報の通知\n(4) お問い合わせへの対応\n(5) 利用規約違反行為への対応\n(6) 料金の請求・収納\n(7) 新サービス・機能の開発・改善のための分析（個人を特定しない形式）\n(8) 法令に基づく対応`,
  },
  {
    title: "5. 個人情報の第三者提供",
    content: `当社は、以下のいずれかに該当する場合を除き、あらかじめユーザーの同意を得ることなく、取得した個人情報を第三者に提供しません。\n\n(1) 法令に基づく場合\n(2) 人の生命・身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき\n(3) 公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき\n(4) 国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合`,
  },
  {
    title: "6. 業務委託先への提供",
    content: `当社は、利用目的の達成に必要な範囲内において、個人情報の取り扱いを外部に委託する場合があります。委託先には、適切な安全管理措置を講じるよう契約等で義務付けます。\n\n主な委託先（インフラ・基盤サービス）：\n・Google LLC（Firebase / Google Cloud Platform）\n・Vercel Inc.（ホスティング）`,
  },
  {
    title: "7. 個人情報の安全管理",
    content: `当社は、個人情報の紛失・破壊・改ざん・漏洩等を防止するため、以下の安全管理措置を講じます。\n\n(1) 技術的措置：SSL/TLSによる通信の暗号化、パスワードのハッシュ化、ファイアウォールの設置\n(2) 組織的措置：個人情報取扱い担当者の指定、アクセス権限の管理\n(3) 物理的措置：サーバーへの不正アクセス防止`,
  },
  {
    title: "8. クッキー（Cookie）の使用",
    content: `本サービスは、サービス提供・改善のためにクッキーを使用する場合があります。クッキーはユーザーを個人として特定するものではありません。ブラウザの設定によりクッキーを無効にすることができますが、その場合、本サービスの一部機能が正常に動作しない場合があります。`,
  },
  {
    title: "9. 保有個人データの開示・訂正・削除等",
    content: `ユーザーは、当社に対して、自己の保有個人データの開示・訂正・追加・削除・利用停止・消去・第三者提供の停止を請求することができます。ご請求の際は、support@refcore.co.jp までお問い合わせください。本人確認を行ったうえで、法令に従い合理的な期間内に対応いたします。`,
  },
  {
    title: "10. 個人情報の保存期間",
    content: `当社は、利用目的に必要な期間のみ個人情報を保存します。ユーザーが退会した場合は、法令上の保存義務がある情報を除き、合理的な期間内に個人情報を削除します。`,
  },
  {
    title: "11. 未成年者の個人情報",
    content: `本サービスは、飲食店の事業者向けサービスであり、未成年者を対象としていません。18歳未満の方は、本サービスのご利用前に保護者の同意を得てください。`,
  },
  {
    title: "12. プライバシーポリシーの変更",
    content: `当社は、必要に応じて本プライバシーポリシーを変更することがあります。変更後のプライバシーポリシーは、当社が定める方法によりユーザーに通知し、通知から所定の期間経過後に効力を生じるものとします。`,
  },
  {
    title: "13. お問い合わせ窓口",
    content: `個人情報の取り扱いに関するお問い合わせ・苦情・ご相談は、以下の窓口にご連絡ください。\n\n株式会社Refcore　個人情報保護担当\nメールアドレス：support@refcore.co.jp\n\n受付時間：平日 10:00〜18:00（土日祝日・年末年始を除く）`,
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[720px] mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/menu"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ‹ メニューに戻る
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">プライバシーポリシー</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <p className="text-sm text-gray-500">制定日：{ESTABLISHED_DATE}</p>
            <p className="text-sm text-gray-500">最終改定：{REVISED_DATE}</p>
          </div>
        </div>

        <div className="mt-4 bg-white rounded-2xl shadow-sm p-6">
          <p className="text-sm text-gray-700 leading-relaxed mb-6">
            株式会社Refcore（以下「当社」）は、本サービス「レシプロ」を通じてご提供いただいた個人情報について、個人情報の保護に関する法律（個人情報保護法）その他の関連法令を遵守し、以下のとおり適切に取り扱います。
          </p>

          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-base font-bold text-gray-900 mb-2">
                  {section.title}
                </h2>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              </section>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              株式会社Refcore　制定日：{ESTABLISHED_DATE}　最終改定：{REVISED_DATE}
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/menu"
            className="inline-block text-sm font-medium px-6 py-2.5 rounded-xl border"
            style={{ color: "#E85D2C", borderColor: "#E85D2C" }}
          >
            メニューに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
