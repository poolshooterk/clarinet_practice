# 認証 + Supabase 基盤 設計ドキュメント

Date: 2026-05-11

## 概要

クラリネット練習アプリの基盤として、Supabase による認証（メール + パスワード）と DB スキーマを実装する。全データを Supabase で管理し、expo-router のグループベース認証でログイン状態に応じた画面遷移を制御する。

## 位置づけ

このサブプロジェクトは楽器情報登録画面（Sub-project 2）の前提条件。以下の順序で実装する。

1. **Sub-project 1（本ドキュメント）**: 認証 + Supabase 基盤
2. **Sub-project 2**: 楽器情報登録画面（Supabase からプリセット取得・機材データ保存）

## アーキテクチャ

### ナビゲーション構成

expo-router のグループベース認証。`app/_layout.tsx` がセッション状態を監視し、未認証は `(auth)` グループ、認証済みは `(tabs)` グループに自動リダイレクトする。

```
app/
  _layout.tsx              ← セッション監視・リダイレクト（既存を改修）
  (auth)/
    _layout.tsx            ← Stack レイアウト
    sign-in.tsx            ← サインイン画面
    sign-up.tsx            ← サインアップ画面
    forgot-password.tsx    ← パスワードリセット申請画面
  (tabs)/
    _layout.tsx            ← タブ定義（練習記録 / 楽器情報 / 設定）
    index.tsx              ← 練習記録タブ（スケルトン）
    equipment.tsx          ← 楽器情報タブ（スケルトン、Sub-project 2 で実装）
    settings.tsx           ← 設定タブ（スケルトン）

lib/
  supabase.ts              ← Supabase クライアント初期化

.env.local                 ← EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### 削除するファイル

| ファイル        | 理由                              |
| --------------- | --------------------------------- |
| `app/index.tsx` | `app/(tabs)/index.tsx` に置き換え |

### 残すファイル

`forms/`・`components/`・`store/` は Sub-project 2 で活用するためそのまま残す。

## DB スキーマ

### `presets` テーブル（プリセットマスタ）

全ユーザー共通の読み取り専用マスタデータ。

```sql
create table presets (
  id          uuid primary key default gen_random_uuid(),
  category    text not null
              check (category in ('instrument', 'reed', 'ligature', 'mouthpiece')),
  name        text not null,
  sort_order  int  not null default 0
);
```

### `user_equipment` テーブル（ユーザー機材登録）

1 ユーザー 1 行固定。`user_id` を主キーにすることで一意性を保証する。

```sql
create table user_equipment (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  instrument_name        text not null,
  instrument_start_date  date not null,
  reed_name              text not null,
  reed_start_date        date not null,
  ligature_name          text not null,
  ligature_start_date    date not null,
  mouthpiece_name        text not null,
  mouthpiece_start_date  date not null,
  updated_at             timestamptz not null default now()
);
```

### Row Level Security

```sql
-- presets: 認証不要で全員が読める
alter table presets enable row level security;
create policy "presets are publicly readable"
  on presets for select using (true);

-- user_equipment: 自分のデータのみ全操作可
alter table user_equipment enable row level security;
create policy "users manage own equipment"
  on user_equipment for all using (auth.uid() = user_id);
```

### 初期データ（seed）

マイグレーション内で以下をINSERTする。

**instrument（楽器）**

- B♭クラリネット / Aクラリネット / バスクラリネット / Eクラリネット

**reed（リード）**

- Vandoren V12 / Vandoren Traditional（青箱）/ Vandoren V21 / D'Addario Select Jazz / Rico Royal / Legere Signature

**ligature（リガチャー）**

- Vandoren M/O / BG Franck Superior / Bonade / Rovner Dark / Harrison

**mouthpiece（マウスピース）**

- Vandoren B45 / Vandoren M30 / Vandoren BD5 / Clark W. Fobes Debut / Selmer C85

## Supabase クライアント（`lib/supabase.ts`）

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
```

セッションは AsyncStorage に永続化する。`detectSessionInUrl: false` は React Native 環境で URL からのセッション検出が不要なため。

## 認証状態管理（`app/_layout.tsx` 改修）

`supabase.auth.onAuthStateChange` でセッションを監視し、状態変化のたびに自動リダイレクトする。

```ts
const {
  data: { subscription },
} = supabase.auth.onAuthStateChange((event, session) => {
  if (!session) router.replace('/(auth)/sign-in');
  else router.replace('/(tabs)/');
});
// アンマウント時に subscription.unsubscribe()
```

## 認証 UI

### 画面一覧

| 画面               | ファイル                     | 主な要素                                                                                               |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| サインイン         | `(auth)/sign-in.tsx`         | メール・パスワード入力、サインインボタン、「パスワードを忘れた方」リンク、サインアップへのリンク       |
| サインアップ       | `(auth)/sign-up.tsx`         | メール・パスワード・確認パスワード入力、作成ボタン、「確認メールが届きます」注記、サインインへのリンク |
| パスワードリセット | `(auth)/forgot-password.tsx` | メール入力、送信ボタン、サインインへ戻るリンク                                                         |

### 各画面の後続フロー

- **サインイン成功**: `onAuthStateChange` が発火して `(tabs)/` に自動遷移
- **サインアップ成功**: `Alert.alert('確認メールを送信しました', 'メール内のリンクをクリックしてサインインしてください')` → `sign-in` に戻る（確認前はセッションが発行されないため自動遷移しない）
- **パスワードリセット送信成功**: `Alert.alert('メールを送信しました', '届いたリンクからパスワードを再設定してください')` → `sign-in` に戻る

### 共通事項

- フォームは RHF + zod（既存プロジェクトのパターンを踏襲）
- Supabase のエラーメッセージ（英語）は `lib/auth-errors.ts` で日本語にマッピングし、`Alert.alert` で表示
- `supabase.auth.signInWithPassword()` / `signUp()` / `resetPasswordForEmail()` を呼ぶ

### `lib/auth-errors.ts`

Supabase が返す英語エラーを日本語にマッピングするヘルパー。

```ts
const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
  'Email not confirmed': 'メールアドレスの確認が完了していません',
  'User already registered': 'このメールアドレスはすでに登録されています',
};
export const toJaError = (msg: string) => ERROR_MAP[msg] ?? 'エラーが発生しました';
```

### 必要パッケージ

```bash
npx expo install @supabase/supabase-js
# @react-native-async-storage/async-storage は既導入済み
```

## テスト方針

Supabase Auth はネットワーク通信を伴うため、単体・結合テストでは `lib/supabase` をモックする。

### 単体テスト（unit）

- `forms/__tests__/sign-in.test.ts`: `signInSchema`（メール形式・パスワード必須）の valid/invalid
- `forms/__tests__/sign-up.test.ts`: `signUpSchema`（メール形式・パスワード最小長・確認パスワード一致）の valid/invalid

### 結合テスト（integration）

**`__tests__/integration/sign-in.integration.test.tsx`**

- `supabase.auth.signInWithPassword` を `jest.fn()` でモック
- 空送信でフォームエラーが表示されること
- 有効な入力 → サインインが呼ばれること
- Supabase がエラーを返した場合に Alert が表示されること

### モック戦略

```ts
// jest.setup.ts に追加
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));
```

### E2E（Maestro）

今回は追加しない（実機での Supabase 通信確認は手動テストで代替）。
