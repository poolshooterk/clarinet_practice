# 教本ジャンル紐づけ 設計ドキュメント

作成日: 2026-05-14

## 概要

教本にジャンル（スケール / エチュード / ソナタ / コンチェルト / アンサンブル / その他）を紐づける機能を追加する。教本一覧画面ではジャンルごとにセクション分けして表示する。

## ジャンル定義

固定 enum（6 択）。`difficulty` 列と同じ CHECK 制約パターンで実装する。

| 値           | 内容イメージ                     |
| ------------ | -------------------------------- |
| スケール     | 音階・アルペジオ練習             |
| エチュード   | 練習曲全般（ローズ、クローゼ等） |
| ソナタ       | ソナタ形式の楽曲                 |
| コンチェルト | 協奏曲                           |
| アンサンブル | 重奏・合奏曲集                   |
| その他       | 上記に当てはまらないもの         |

## DB / Migration

```sql
-- supabase/migrations/20260514000001_add_genre_to_textbooks.sql
ALTER TABLE textbooks
  ADD COLUMN genre text NOT NULL DEFAULT 'その他'
    CHECK (genre IN ('スケール', 'エチュード', 'ソナタ', 'コンチェルト', 'アンサンブル', 'その他'));
```

- `NOT NULL DEFAULT 'その他'`：既存レコードを埋めつつ、アプリ側の必須選択と整合する
- `difficulty` は nullable だが `genre` は NOT NULL（アプリ側で必須入力）

## TypeScript 層

### `forms/textbook.ts`

```ts
export const GENRE_OPTIONS = [
  'スケール',
  'エチュード',
  'ソナタ',
  'コンチェルト',
  'アンサンブル',
  'その他',
] as const;
export type Genre = (typeof GENRE_OPTIONS)[number];

export const textbookSchema = z.object({
  title: z.string().min(1, '教本名を入力してください'),
  publisher: z.string().optional(),
  genre: z.enum(GENRE_OPTIONS, { error: 'ジャンルを選択してください' }), // 必須
  difficulty: z.enum(DIFFICULTY_OPTIONS).optional(),
  totalPages: z.number().int().min(1, '1以上の整数を入力してください').optional(),
});
```

### `store/textbook-catalog.ts`

`Textbook` 型に `genre: Genre`（nullable なし）を追加。`fetchAll` / `add` / `update` のスネークケース変換箇所にそれぞれ `genre: row.genre as Genre` / `genre: input.genre` を追加。

```ts
export type Textbook = {
  id: string;
  title: string;
  publisher: string | null;
  genre: Genre;
  difficulty: Difficulty | null;
  totalPages: number | null;
};
```

## フォーム UI (`components/textbook-form.tsx`)

- ジャンル選択を「教本名」直下に配置（主要な分類項目のため上部）
- `difficulty` と同じ Button トグル方式だが、**選択済みボタンの再タップでは解除しない**（必須のため）
- バリデーションエラーは `<FieldError message={errors.genre?.message} />` で表示
- `defaultValues.genre` は `undefined`（新規登録時は未選択状態からスタートし、ユーザーが明示的に選ぶ必要がある）

フィールド順：教本名 → ジャンル → 出版社 → 難易度 → 総ページ数

## 一覧画面 (`app/textbooks.tsx`)

- `FlatList` → `SectionList` に変更
- セクションは `GENRE_OPTIONS` の定義順（スケール → エチュード → ソナタ → コンチェルト → アンサンブル → その他）
- 教本が 0 件のジャンルはセクションごと非表示

```ts
const sections = GENRE_OPTIONS.map((genre) => ({
  title: genre,
  data: textbooks.filter((t) => t.genre === genre),
})).filter((s) => s.data.length > 0);
```

- 各カードにジャンルバッジは表示しない（セクションヘッダーで役割を果たすため）
- `difficulty` バッジはそのまま残す

## テスト

### `forms/__tests__/textbook.test.ts`（追加）

- `genre` 未指定 → 「ジャンルを選択してください」エラー
- 有効な 6 択それぞれ → pass
- 無効な文字列（例: `'jazz'`）→ fail

### `store/__tests__/textbook-catalog.test.ts`（更新）

- 既存テストのモックデータに `genre` を追加（型エラー解消のみ）

### `__tests__/integration/textbook-form.integration.test.tsx`（追加）

- ジャンル未選択で送信 → FieldError に「ジャンルを選択してください」が表示される
- ジャンルボタンをタップ → 選択状態になり送信が通る
