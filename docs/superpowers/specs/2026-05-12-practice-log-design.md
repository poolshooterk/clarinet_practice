# 練習記録 設計書

作成日: 2026-05-12

## 概要

練習セッションを記録し、使用した教本のページ進捗を自動更新する機能を実装する。現在プレースホルダーの「練習記録」タブを実用的な一覧＋フォーム画面に置き換える。

## スコープ

- `practice_sessions` テーブルの新規作成
- `practice_session_textbooks` テーブルの新規作成
- セッション保存時に `textbook_progress` を自動 upsert
- `forms/practice-log.ts` の新規作成
- `store/practice-log.ts` の新規作成
- `components/practice-log-form.tsx` の新規作成
- `app/practice-log-form.tsx` の新規作成（新規記録フォーム画面）
- `app/(tabs)/index.tsx` の全面置き換え（練習記録一覧）

スコープ外: 練習記録の編集・カレンダー表示・グラフ・練習時間の詳細統計（次フェーズ以降）

## データモデル

### `practice_sessions` テーブル（新規）

```sql
create table practice_sessions (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  practiced_at      date        not null default current_date,
  duration_minutes  integer     check (duration_minutes > 0),
  memo              text,
  created_at        timestamptz default now()
);

alter table practice_sessions enable row level security;

create policy "自分の練習記録を参照可能"
  on practice_sessions for select
  using (auth.uid() = user_id);

create policy "自分の練習記録を追加可能"
  on practice_sessions for insert
  with check (auth.uid() = user_id);

create policy "自分の練習記録を削除可能"
  on practice_sessions for delete
  using (auth.uid() = user_id);
```

- `practiced_at`: 日付のみ（時刻不要）。デフォルトは当日
- `duration_minutes`: 任意。1以上の整数
- `memo`: 任意の自由テキスト

### `practice_session_textbooks` テーブル（新規）

```sql
create table practice_session_textbooks (
  id           uuid     primary key default gen_random_uuid(),
  session_id   uuid     not null references practice_sessions(id) on delete cascade,
  textbook_id  uuid     not null references textbooks(id) on delete cascade,
  current_page integer  not null check (current_page >= 0),
  unique(session_id, textbook_id)
);

alter table practice_session_textbooks enable row level security;

create policy "自分のセッションの教本進捗を参照可能"
  on practice_session_textbooks for select
  using (
    exists (
      select 1 from practice_sessions
      where id = practice_session_textbooks.session_id
        and user_id = auth.uid()
    )
  );

create policy "自分のセッションの教本進捗を追加可能"
  on practice_session_textbooks for insert
  with check (
    exists (
      select 1 from practice_sessions
      where id = practice_session_textbooks.session_id
        and user_id = auth.uid()
    )
  );

create policy "自分のセッションの教本進捗を削除可能"
  on practice_session_textbooks for delete
  using (
    exists (
      select 1 from practice_sessions
      where id = practice_session_textbooks.session_id
        and user_id = auth.uid()
    )
  );
```

- `UNIQUE(session_id, textbook_id)`: 1セッション内で同じ教本は1行のみ
- `ON DELETE CASCADE`: セッション削除で関連エントリも自動削除
- RLS は `practice_sessions` への EXISTS サブクエリで間接的にユーザーを確認

### `textbook_progress` の自動更新

セッション保存時に `store/practice-log.ts` の `add` アクションが、各教本エントリを `textbook_progress` に upsert する（`onConflict: 'user_id,textbook_id'`）。`updated_at` は明示的に渡す。

## アーキテクチャ

### `forms/practice-log.ts`（新規）

```ts
const textbookEntrySchema = z.object({
  textbookId: z.string().uuid('教本を選択してください'),
  currentPage: z.number().int().min(0, '0以上の整数を入力してください'),
});

export const practiceLogSchema = z.object({
  practicedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください'),
  durationMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  memo: z.string().optional(),
  textbookEntries: z.array(textbookEntrySchema),
});

export type PracticeLogInput = z.infer<typeof practiceLogSchema>;
```

- `durationMinutes` は Controller の `onChange` で `Number(t)` 化、空文字・NaN は `undefined` に正規化
- `currentPage` は同様に `Number(t)` 化
- `textbookEntries` は `useFieldArray` で動的追加・削除を管理

### `store/practice-log.ts`（新規）

```ts
type PracticeSession = {
  id: string;
  practicedAt: string; // 'YYYY-MM-DD'
  durationMinutes: number | null;
  memo: string | null;
  textbookEntries: {
    textbookId: string;
    textbookTitle: string;
    currentPage: number;
    totalPages: number | null;
  }[];
};

type PracticeLogState = {
  sessions: PracticeSession[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: PracticeLogInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
};
```

- `fetchAll`: `practice_sessions` を `practiced_at DESC` で取得。`practice_session_textbooks` と `textbooks` を JOIN して `textbookEntries` に格納
- `add`:
  1. `practice_sessions` に INSERT して `session.id` を取得
  2. 各 `textbookEntries` を `practice_session_textbooks` に INSERT
  3. 各エントリを `textbook_progress` に upsert（`updated_at` 明示）
  4. `sessions` の先頭に追加
- `remove`: `practice_sessions` から DELETE（CASCADE で `practice_session_textbooks` も削除）
- `persist` は使用しない（Supabase が正となるため）

### `components/practice-log-form.tsx`（新規）

RHF + zod のフォーム UI コンポーネント。`onSubmit: (data: PracticeLogInput) => void` を prop で受け取る。

- 日付: `Input` + `DateTimePicker`（`Platform.OS !== 'web'` 時のみ）
- 練習時間: `Input`（numeric）、任意
- メモ: `Input`（multiline）、任意
- 教本エントリ: `useFieldArray` で管理。各エントリは Tamagui `Select` で教本を選択 + `Input`（numeric）でページ入力
- 「＋ 教本を追加」ボタン: 空エントリを追加
- 各エントリの「✕」ボタン: エントリを削除
- 教本 `Select` の選択肢は `useTextbookCatalogStore` から取得。既に選択済みの教本はグレーアウト

### `app/practice-log-form.tsx`（新規）

```tsx
export default function PracticeLogFormScreen() {
  const add = usePracticeLogStore((s) => s.add);

  const handleSubmit = async (data: PracticeLogInput) => {
    await add(data);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: '練習を記録', headerRight: ... }} />
      <PracticeLogForm onSubmit={handleSubmit} />
    </>
  );
}
```

- ヘッダ右に「保存」ボタンを配置（`handleSubmit(form.handleSubmit(...))` を呼び出す）
- 新規作成のみ。編集機能なし

### `app/(tabs)/index.tsx`（全面置き換え）

- `useFocusEffect` で `fetchAll` を呼び出す
- `FlatList` でセッション一覧を表示（`practiced_at DESC`）
- ヘッダ右に「＋ 記録」リンク（`/practice-log-form` へ遷移）
- 各行: 日付・練習時間・メモ（1行）・教本エントリ（タイトル + ページ）
- 長押しで削除確認 Alert → `remove`
- 月ごとの練習回数・合計時間をリスト上部（`ListHeaderComponent`）に表示

## テスト方針

### 単体テスト

- `forms/__tests__/practice-log.test.ts`（新規）
  - `practicedAt` の valid/invalid（正規表現、空文字）
  - `durationMinutes` の valid/invalid（1以上の整数、0・負数・小数）
  - `textbookEntries` の valid/invalid（uuid 検証、currentPage の境界値）

- `store/__tests__/practice-log.test.ts`（新規）
  - `fetchAll` で `sessions` にマッピングされること
  - `add` で `sessions` の先頭にセッションが追加されること
  - `remove` で対象セッションが削除されること
  - ログアウト中は `fetchAll` / `add` が no-op になること

### 結合テスト

- `__tests__/integration/practice-log-form.integration.test.tsx`（新規）
  - 空送信でエラーが表示されること（`practicedAt` 必須）
  - 教本エントリを追加して保存すると `onSubmit` に正しい値が渡されること
  - 教本エントリの追加・削除が動作すること
  - `durationMinutes` の無効値（0）でエラーが表示されること

## マイグレーションファイル

| ファイル名                                                     | 内容                                                                 |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `supabase/migrations/20260512000004_add_practice_sessions.sql` | `practice_sessions` + `practice_session_textbooks` テーブル作成・RLS |
