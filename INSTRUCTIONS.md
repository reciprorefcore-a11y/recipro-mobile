# レシプロ モバイル版 MVP 開発指示

## 概要
Next.js 14 + TypeScript + Tailwind CSS でレシプロ モバイル版のMVPを作成する。
Firebase Authentication でログイン、ログイン後にホーム画面を表示する最小構成。

## 技術スタック
- Next.js 14 (App Router)
- TypeScript (strict: true)
- Tailwind CSS
- Firebase Authentication
- Firebase Firestore
- lucide-react (アイコン)

## ファイル構成
recipro-mobile-mvp/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (/ ホーム、要認証)
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/page.tsx (/login)
│   │   └── signup/page.tsx (/signup)
│   └── providers.tsx (Auth Context Provider)
├── components/
│   ├── ui/Button.tsx, Card.tsx, Input.tsx
│   ├── ReciproLogo.tsx
│   ├── LossImpactCard.tsx
│   ├── UnupdatedIngredientsList.tsx
│   └── ImprovementCard.tsx
├── lib/
│   ├── firebase.ts
│   ├── auth.ts
│   └── firestore.ts
├── hooks/useAuth.ts
├── types/index.ts
└── .env.local

## Firebase設定
firebaseConfig:
  apiKey: 環境変数 NEXT_PUBLIC_FIREBASE_API_KEY
  authDomain: recipro-mobile.firebaseapp.com
  projectId: recipro-mobile
  storageBucket: recipro-mobile.firebasestorage.app
  messagingSenderId: 451818924518
  appId: 1:451818924518:web:bccc8c439c98370e4d4e27
  measurementId: G-2KQMRYVPW3

## Firestoreスキーマ
collection: users
{
  uid, email, companyName, storeName, role: 'owner', createdAt, updatedAt
}

## 画面
1. /login - メアド+パスワード+ログインボタン+新規登録リンク
2. /signup - メアド+パスワード+企業名+店舗名+登録ボタン
3. / - ホーム画面(要認証、未ログインなら/loginへリダイレクト)
   - Reciproロゴ + 店舗名表示
   - 「今月の損失インパクト -32,000円」(赤色#D93025)
   - 「先週から更新されていない食材があります」警告
   - メインボタン「📷 伝票を撮影して更新」(オレンジ#E85D2C)
   - サブボタン「🔍 食材を検索して更新」(白背景・オレンジ枠)
   - 未更新食材リスト:
     - 豚バラスライス 14日未更新 -12,500円
     - 玉ねぎ 10日未更新 -6,200円
     - 鶏もも肉 7日未更新 -4,800円
   - 改善カード「✅ 昨日の更新で +14,000円改善」(緑#0F9D58)

## カラー
- メイン: #E85D2C (オレンジ)
- 損失: #D93025 (赤)
- 改善: #0F9D58 (緑)
- 警告: #FFA000 (黄)
- 背景: #FFFFFF

## 制約
- Storage、Claude AI連携、CSV機能は今回未実装
- ホーム画面のデータは全てハードコード(デモ表示)
- スマホ縦長UI(max-width: 480px)
- iOS Safariでズームしないようinput要素は16pt以上

## 受け入れ条件
1. /login でログインできる
2. /signup で新規登録 + Firestoreに users ドキュメント作成
