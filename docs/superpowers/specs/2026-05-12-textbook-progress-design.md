# 教本進捗管理 設計書

作成日: 2026-05-12

## 概要

登録済みの教本に対して「現在ページ / 総ページ数」で進捗を記録・表示する機能を実装する。進捗はユーザーごとに Supabase で管理し、教本一覧画面でインラインのプログレスバーと更新モーダルを提供する。

## スコープ

- `textbooks` テーブルへの `total_pages` カラム追加
- `textbook_progress` テーブルの新規作成
- `forms/textbook.ts` に `totalPages` フィールドを追加
- `store/textbook-catalog.ts` の `Textbook` 型・アクションに `totalPages` を追加
- `store/textbook-progress.ts` の新規作成
- `components/textbook-form.tsx` に総ページ数フィールドを追加
- `app/textbooks.tsx` の行構造変更・進捗バー表示・更新モーダル追加

スコープ外: 練習メニュー管理・練習メモ・レッスンメモ（次フェーズ以降）

## データモデル

### `textbooks` テーブルの変更

```sql
alter table textbooks
  add column total_pages integer check (total_pages > 0);
```

- 任意カラム（NULL 許容）。ページ数不明の教本も登録できるようにする
- 総ページ数が NULL の場合、一覧画面の進捗バーは非表示

### `textbook_progress` テーブル（新規）

```sql
create table textbook_progress (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  textbook_id  uuid        not null references textbooks(id) on delete cascade,
  current_page integer     not null default 0 check (current_page >= 0),
  updated_at   timestamptz default now(),
  unique(user_id, textbook_id)
);

alter table textbook_progress enable row level security;

create policy "自分の進捗を参照可能"
  on textbook_progress for select
  using (auth.uid() = user_id);

create policy "自分の進捗を追加可能"
  on textbook_progress for insert
  with check (auth.uid() = user_id);

create policy "自分の進捗を更新可能"
  on textbook_progress for update
  using (auth.uid() = user_id);

create policy "自分の進捗を削除可能"
  on textbook_progress for delete
  using (auth.uid() = user_id);
```

- `unique(user_id, textbook_id)`: 1ユーザー × 1教本 = 1進捗レコード
- `ON DELETE CASCADE`: 教本または認証ユーザーが削除されると進捗も自動削除

## アーキテクチャ

### `forms/textbook.ts` の変更

```ts
export const textbookSchema = z.object({
  title: z.string().min(1, '教本名を入力してください'),
  publisher: z.string().optional(),
  difficulty: z.enum(DIFFICULTY_OPTIONS).optional(),
  totalPages: z.number().int().min(1).optional(), // 追加
});
```

数値入力は Controller の `onChange` で `Number(t)` 化し、空文字・NaN は `undefined` に正規化する（既存の数値フィールドと同じパターン）。

### `store/textbook-catalog.ts` の変更

`Textbook` 型に `totalPages: number | null` を追加。`fetchAll` / `add` / `update` で `total_pages` を読み書きする。

### `store/textbook-progress.ts`（新規）

```ts
type TextbookProgressState = {
  progress: Record<string, number>; // { [textbookId]: currentPage }
  fetchAll: () => Promise<void>;
  upsert: (textbookId: string, currentPage: number) => Promise<void>;
};
```

- `fetchAll`: ログイン中ユーザーの全進捗を取得し `progress` マップに格納
- `upsert`: Supabase の `upsert` で `(user_id, textbook_id)` をキーに挿入または更新。`onConflict: 'user_id,textbook_id'`。`updated_at` は `default now()` が INSERT 時しか機能しないため、upsert 呼び出し時に `updated_at: new Date().toISOString()` を明示的に渡す
- `persist` は使用しない（Supabase が正となるため AsyncStorage キャッシュ不要）

### `components/textbook-form.tsx` の変更

既存の `difficulty` チップの下に「総ページ数」の数値入力フィールドを追加する。任意入力。

### `app/textbooks.tsx` の変更

各行の構造を次のように変更する。

```
[ タイトル・出版社・難易度バッジ・進捗バー (Pressable) ][ › (Pressable) ]
```

- **行本体タップ**: 進捗更新モーダルを表示
- **右端「›」タップ**: `router.push('/textbook-form?id=...')` で編集画面へ遷移
- **長押し**: 削除確認ダイアログ（現状維持）

**進捗更新モーダル**（`app/textbooks.tsx` 内にインライン実装）

- React Native 標準の `Modal` を使用
- 教本名・「現在ページ / 総ページ数」の数値入力 + 「保存」ボタン
- 保存時に `upsert(textbookId, currentPage)` を呼び出してモーダルを閉じる
- `total_pages` が NULL の場合はモーダルを開かず、タップ時に「教本の総ページ数を先に設定してください」旨のアラートを表示する

**初期ロード**

`useFocusEffect` 内でテキストブックカタログの `fetchAll` と進捗ストアの `fetchAll` を両方呼び出す。

## テスト方針

### 単体テスト

- `forms/__tests__/textbook.test.ts`: `totalPages` の valid/invalid パスを追加
  - 正整数（OK）、0（NG）、負数（NG）、未入力（OK）
- `store/__tests__/textbook-progress.test.ts`: 新規作成
  - `upsert` で `progress` マップにレコードが追加されること
  - 同一 `textbookId` の再 `upsert` で値が上書きされること

### 結合テスト

- `__tests__/integration/textbook-form.integration.test.tsx`: 既存テストに追記
  - `totalPages` フィールドの入力・バリデーション・`onSubmit` で正しい値が渡されること
- `__tests__/integration/textbook-progress-modal.integration.test.tsx`: 新規作成
  - 進捗バーが `current_page / total_pages` に応じて正しく表示されること
  - 行タップでモーダルが開くこと
  - モーダルで値を入力して保存すると `upsert` が呼ばれること

### E2E

スコープ外。

## マイグレーションファイル

| ファイル名                                                            | 内容                             |
| --------------------------------------------------------------------- | -------------------------------- |
| `supabase/migrations/20260512000001_add_total_pages_to_textbooks.sql` | `total_pages` カラム追加         |
| `supabase/migrations/20260512000002_add_textbook_progress.sql`        | `textbook_progress` テーブル作成 |
