# 練習教本カタログ 設計書

作成日: 2026-05-12

## 概要

認証済みユーザー全員が共有する練習教本カタログを実装する。楽器カタログ（`instrument_makers` / `instrument_models`）と同じ設計思想で、`textbooks` テーブルを Supabase で管理する。ユーザーは教本を追加・編集・削除でき、将来の進捗管理機能と連携する土台となる。

## スコープ

- `textbooks` テーブルの作成（マイグレーション）
- RLS ポリシーの設定
- Zustand ストア（`store/textbook-catalog.ts`）
- Zod スキーマ（`forms/textbook.ts`）
- 教本フォームコンポーネント（`components/textbook-form.tsx`）
- 教本一覧画面（`app/textbooks.tsx`）
- 教本追加/編集画面（`app/textbook-form.tsx`）
- 設定タブへの導線追加（`app/(tabs)/settings.tsx`）

スコープ外: 進捗管理との連携（次フェーズ）

## データモデル

### `textbooks` テーブル

```sql
create table textbooks (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  publisher  text,
  difficulty text        check (difficulty in ('初心者', '初中級', '中級', '上級')),
  created_at timestamptz default now()
);
```

- `title`: 教本名。必須。一意制約なし（同名の異版が存在しうる）
- `publisher`: 出版社。任意
- `difficulty`: 4段階テキストラベル。任意。CHECK 制約で値を制限

### RLS ポリシー

認証済みユーザーは SELECT / INSERT / UPDATE / DELETE をすべて許可（共有カタログ）。

```sql
alter table textbooks enable row level security;

create policy "認証済みユーザーは教本を参照可能"
  on textbooks for select
  using (auth.role() = 'authenticated');

create policy "認証済みユーザーは教本を追加可能"
  on textbooks for insert
  with check (auth.role() = 'authenticated');

create policy "認証済みユーザーは教本を更新可能"
  on textbooks for update
  using (auth.role() = 'authenticated');

create policy "認証済みユーザーは教本を削除可能"
  on textbooks for delete
  using (auth.role() = 'authenticated');
```

## アーキテクチャ

### Zustand ストア (`store/textbook-catalog.ts`)

`instrument-catalog.ts` のパターンに倣い、Supabase からフェッチしたデータを AsyncStorage にキャッシュする。

```ts
type Textbook = {
  id: string;
  title: string;
  publisher: string | null;
  difficulty: '初心者' | '初中級' | '中級' | '上級' | null;
};

type TextbookCatalogState = {
  textbooks: Textbook[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: TextbookInput) => Promise<void>;
  update: (id: string, input: TextbookInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
};
```

### Zod スキーマ (`forms/textbook.ts`)

```ts
const DIFFICULTY_OPTIONS = ['初心者', '初中級', '中級', '上級'] as const;

const textbookSchema = z.object({
  title: z.string().min(1, '教本名を入力してください'),
  publisher: z.string().optional(),
  difficulty: z.enum(DIFFICULTY_OPTIONS).optional(),
});
```

### コンポーネント (`components/textbook-form.tsx`)

- RHF + zodResolver + Tamagui `Input`
- 難易度はチップ（ボタン）形式で選択（Controller でラップ）
- `onSubmit` prop を外部から注入して副作用を分離
- 編集モード時は削除ボタンを表示（`onDelete` prop）

## 画面構成

### ナビゲーションフロー

```
(tabs)/settings.tsx
  └→ app/textbooks.tsx         # 教本一覧（Stack push）
       └→ app/textbook-form.tsx  # 追加 or 編集（Stack push、id パラメータで分岐）
```

### 設定タブ (`app/(tabs)/settings.tsx`)

既存の設定画面に「教本管理」メニュー行を追加し、`router.push('/textbooks')` で遷移する。

### 教本一覧 (`app/textbooks.tsx`)

- ヘッダー: 戻るボタン + 「教本管理」タイトル + 「＋ 追加」ボタン
- 教本リスト: 教本名・出版社・難易度バッジ（色分け）
- 削除: 行の長押しで確認ダイアログを表示してから削除（`Alert.alert`）
- 初回マウント時に `fetchAll()` を呼ぶ

### 教本追加/編集 (`app/textbook-form.tsx`)

- URL パラメータ `id` の有無で追加 / 編集を切り替え
- ヘッダー: 戻るボタン + タイトル（「教本を追加」/「教本を編集」）+ 「保存」ボタン
- フォーム: 教本名（必須）、出版社（任意）、難易度チップ（任意）
- 編集モードのみ「この教本を削除」ボタンを下部に表示

## テスト方針

### 単体テスト (`forms/__tests__/textbook.test.ts`)

- zod スキーマの valid / invalid パス（必須チェック、difficulty enum 制約）を網羅

### 単体テスト (`store/__tests__/textbook-catalog.test.ts`)

- `getState()` 直叩きで `add` / `update` / `remove` の状態遷移を検証

### 結合テスト (`__tests__/integration/textbook-form.integration.test.tsx`)

- `TextbookForm` コンポーネントの RHF + zod + Tamagui 配線確認
- 空送信でエラー表示、正常入力で `onSubmit` が正しい値で呼ばれることを確認

E2E: スコープ外（将来的にハッピーパスを追加してよい）
