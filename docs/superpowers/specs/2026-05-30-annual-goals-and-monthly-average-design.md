# 年間目標機能の追加 + 月別表示の「平均」化

## 概要

クラリネット練習記録アプリに以下 2 件の変更を加える。

1. **月別サマリーを「合計」から「平均」に変更**
   ホームタブ (`app/(tabs)/index.tsx`) のヘッダーに表示している月間集計を「合計: XXX分」から「平均: XXX分/日 (合計時間 ÷ 練習した日数)」に変更する。練習記録は `(user_id, practiced_at)` UNIQUE 制約により同日 1 件のため、`monthSessions.length = 練習した日数` が成立する。
2. **新メニュー「年間目標」を追加**
   ユーザは 1 年に複数の年間目標を設定でき、各目標は 12 ヶ月分のマイルストーン (sparse) に分割される。マイルストーン単位で「振り返り」(達成度 3 段階 + テキスト) を、年間目標単位で「年末振り返り」を記録できる。練習記録タブ上部に「今月のマイルストーン」を常時表示する。

実装の参考パターンは `purchase-plan` 機能 (form / store / 詳細画面 / 子要素フォーム画面、parent-child テーブル + RLS JOIN 検証)。

## ユーザーストーリー

- 年初に「2026 年は音色を磨く」などの年間目標を複数作成し、それぞれの目標に対し「1 月はロングトーンに集中」「2 月はピッチ精度」のような月別マイルストーンを設定できる
- 月末 (最終 7 日以降) または当月が過去になったタイミングで、マイルストーンごとに振り返り (達成 / 一部達成 / 未達成 + コメント) を記録できる
- 年末に各年間目標に対して「年末振り返り」(達成判定 + テキスト) を記録できる
- ホームを開くと、「今月のマイルストーン」がリスト表示され、振り返り可能なものはその場から振り返りフォームへ遷移できる
- 月別サマリーは「平均: XXX分/日」で表示されるため、月の練習日数の多寡に依存しない強度比較ができる

## データモデル

新規マイグレーション: `supabase/migrations/20260530000000_add_annual_goals.sql`

### `annual_goals` テーブル

1 ユーザ × 任意の年 × 任意件数。

```sql
CREATE TABLE annual_goals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year                 INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  title                TEXT NOT NULL,
  numeric_target       INTEGER CHECK (numeric_target > 0),
  numeric_unit         TEXT,
  year_end_review_text TEXT,
  year_end_achievement TEXT CHECK (year_end_achievement IN ('achieved','partial','unachieved')),
  year_end_reviewed_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS (`auth.uid() = user_id` で 4 ポリシー: SELECT / INSERT / UPDATE / DELETE)。同じ年に複数の目標を持てる (UNIQUE 制約なし)。

### `monthly_milestones` テーブル (sparse)

```sql
CREATE TABLE monthly_milestones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_goal_id  UUID NOT NULL REFERENCES annual_goals(id) ON DELETE CASCADE,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  text            TEXT NOT NULL,
  numeric_target  INTEGER CHECK (numeric_target > 0),
  numeric_unit    TEXT,
  review_text     TEXT,
  achievement     TEXT CHECK (achievement IN ('achieved','partial','unachieved')),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (annual_goal_id, month)
);
```

RLS は `purchase_plan_savings` と同パターン (parent JOIN 検証):

```sql
-- 例: SELECT
USING (EXISTS (SELECT 1 FROM annual_goals
               WHERE id = annual_goal_id AND user_id = auth.uid()))
```

未設定月は行が存在しない (sparse)。UI 側で「12 月分のうち N 件設定済」として扱う。

## フォーム (`forms/annual-goal.ts`)

### zod スキーマ

```ts
export const annualGoalSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  title: z.string().min(1, '入力してください'),
  numericTarget: z.number().int().positive().optional(),
  numericUnit: z.string().max(20).optional(),
});

export const monthlyMilestoneSchema = z.object({
  month: z.number().int().min(1).max(12),
  text: z.string().min(1, '入力してください'),
  numericTarget: z.number().int().positive().optional(),
  numericUnit: z.string().max(20).optional(),
  reviewText: z.string().optional(),
  achievement: z.enum(['achieved', 'partial', 'unachieved']).optional(),
});

export const annualGoalYearEndReviewSchema = z.object({
  yearEndReviewText: z.string().optional(),
  yearEndAchievement: z.enum(['achieved', 'partial', 'unachieved']).optional(),
});
```

### ヘルパー関数

```ts
// (year, month) の月末 - 6 日 ≤ today、または (year, month) が today より過去
export function canReviewMilestone(year: number, month: number, today: Date): boolean;

// 年末振り返り可能判定 (12 月最終週以降 または year が過去)
export function canReviewAnnualGoal(year: number, today: Date): boolean;

// sparse milestones から状態をカウント (unset = 12 - milestones.length)
type GoalProgress = {
  achieved: number;
  partial: number;
  unachieved: number;
  unreviewed: number; // milestone 存在するが achievement = null
  unset: number; // milestone 行自体なし
};
export function calcGoalProgress(milestones: Milestone[]): GoalProgress;

export const ACHIEVEMENT_LABELS = {
  achieved: '達成',
  partial: '一部達成',
  unachieved: '未達成',
} as const;
```

## ストア (`store/annual-goal.ts`)

`usePurchasePlanStore` と同じ「親 + 子」を 1 ストアにまとめるパターン。

```ts
type AnnualGoal = {
  id: string;
  year: number;
  title: string;
  numericTarget: number | null;
  numericUnit: string | null;
  yearEndReviewText: string | null;
  yearEndAchievement: 'achieved' | 'partial' | 'unachieved' | null;
  yearEndReviewedAt: string | null;
  milestones: Milestone[]; // nested select で同時取得
};

type State = {
  goals: AnnualGoal[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  addGoal: (input: AnnualGoalInput) => Promise<MutationResult>;
  updateGoal: (id: string, input: AnnualGoalInput) => Promise<MutationResult>;
  removeGoal: (id: string) => Promise<void>;
  upsertMilestone: (goalId: string, input: MonthlyMilestoneInput) => Promise<MutationResult>;
  removeMilestone: (id: string) => Promise<void>;
  reviewMilestone: (id: string, review: ReviewInput) => Promise<MutationResult>;
  yearEndReview: (goalId: string, review: YearEndReviewInput) => Promise<MutationResult>;
};
```

`fetchAll` は `annual_goals(*, monthly_milestones(*))` 形式の nested select を 1 リクエストで取得。

## 画面構成

### 新規ファイル

| ファイル                                    | 役割                                                  |
| ------------------------------------------- | ----------------------------------------------------- |
| `app/(tabs)/annual-goals.tsx`               | 年セレクター + 年間目標カード一覧 (新タブ)            |
| `app/annual-goal-form.tsx`                  | 目標 新規 / 編集 / 削除フォーム                       |
| `app/annual-goal-detail.tsx`                | 詳細 (12 ヶ月マイルストーン一覧 + 年末振り返りカード) |
| `app/monthly-milestone-form.tsx`            | マイルストーン 追加 / 編集 / 振り返り入力 / 削除      |
| `components/annual-goal-card.tsx`           | 目標カード (一覧用、進捗サマリー表示)                 |
| `components/monthly-milestone-card.tsx`     | 月マイルストーンカード                                |
| `components/this-month-milestones-card.tsx` | ホーム上部用「今月のマイルストーン」                  |

### 既存変更ファイル

| ファイル                 | 変更内容                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `app/(tabs)/_layout.tsx` | 新タブ `annual-goals` (`flag-outline` アイコン) を追加 (現5タブ→6タブ)                 |
| `app/(tabs)/index.tsx`   | ① 上部に `<ThisMonthMilestonesCard />` を挿入、② 月間サマリーを「合計」→「平均」に変更 |

## UI / UX 詳細

### 年間目標タブ (`app/(tabs)/annual-goals.tsx`)

- 上部に年セレクター (今年・前年・翌年 + 目標が存在する全年)
- 選択年の `annual_goals` をカード並列表示
- 各カードに「進捗サマリー: 達成 X / 一部 Y / 未達 Z / 未振り返り W / 未設定 V (12 中)」をバッジで表示
- 「+ 新規作成」ボタン → `annual-goal-form` へ
- カードタップ → `annual-goal-detail` へ

### 目標詳細 (`app/annual-goal-detail.tsx`)

- 上部: 目標タイトル + 年間数値目標 + 編集ボタン
- 中段: 1 月〜 12 月のマイルストーンカードを縦並び
  - 設定済み月: テキスト + 数値目標 + 達成バッジ + タップで `monthly-milestone-form` (編集モード)
  - 未設定月: 「未設定」表示 + 「+ 追加」 ボタン → `monthly-milestone-form` (新規モード、month プリセット)
- 下段: 年末振り返りカード (`canReviewAnnualGoal` が true の時のみ編集可、未来年はグレーアウト表示)

### マイルストーンフォーム (`app/monthly-milestone-form.tsx`)

- 月選択 (新規モードでは編集可、既存編集モードでは固定)
- テキスト入力 (必須)
- 数値目標 + 単位 (任意)
- **振り返りセクション** (`canReviewMilestone` が true の時のみ表示):
  - 達成判定 3 択 (達成 / 一部達成 / 未達成)
  - 振り返りテキスト
- 「保存」ボタン → `upsertMilestone` または `reviewMilestone` (振り返り欄が触れられたら)
- 削除ボタン (編集モードのみ、ヘッダー右)

### ホーム上部「今月のマイルストーン」 (`components/this-month-milestones-card.tsx`)

- 表示条件: 今年の `annual_goals` のうち現在月に milestone が存在するもの
- 各行: 「[目標タイトル]」「[マイルストーン本文]」「数値目標 (任意)」「達成バッジ (振り返り済の場合)」
- 振り返り可能 (`canReviewMilestone(thisYear, thisMonth, today)` が true) かつ未振り返りなら「振り返る」ボタン → `monthly-milestone-form`
- 対象 milestone が 0 件: カード自体を非表示 (空セクションを残さない)

### 達成バッジ色

- `achieved` → `Theme name="green"`
- `partial` → `Theme name="yellow"`
- `unachieved` → `Theme name="red"`
- 未振り返り → グレー

## 月別サマリーの「平均」化

`app/(tabs)/index.tsx` (行 80-85 周辺):

```ts
// 変更前
const total = monthTotals.basic + monthTotals.nonBasic;
return total > 0
  ? `${monthSessions.length}回 / 合計: ${total}分`
  : `${monthSessions.length}回 / 練習時間未記録`;

// 変更後
const total = monthTotals.basic + monthTotals.nonBasic;
// total > 0 は monthSessions.length > 0 を含意するため除算は安全
const avg = total > 0 ? Math.round(total / monthSessions.length) : 0;
return total > 0
  ? `${monthSessions.length}回 / 平均: ${avg}分/日`
  : `${monthSessions.length}回 / 練習時間未記録`;
```

四捨五入で整数表示。"/日" 接尾辞で「練習した日 1 日あたり」を明示。

## テスト戦略

プロジェクトのテスト戦略マトリクスに従い、unit と integration を以下のように分担:

| 種別        | ファイル                                                            | 内容                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit        | `forms/__tests__/annual-goal.test.ts`                               | zod スキーマ網羅 (両 schema × valid/invalid/境界)、`canReviewMilestone` 境界値 (最終週 7 日前 / 当日 / 翌月 / 過去月)、`calcGoalProgress` の集計ロジック、`canReviewAnnualGoal` |
| unit        | `store/__tests__/annual-goal.test.ts`                               | CRUD アクションの state 遷移 (Supabase モック)、milestone の upsert / reviewMilestone / yearEndReview                                                                           |
| integration | `__tests__/integration/annual-goal-form.integration.test.tsx`       | フォーム送信フロー (空送信エラー / 正常作成 / 編集 / 削除)                                                                                                                      |
| integration | `__tests__/integration/monthly-milestone-form.integration.test.tsx` | マイルストーン編集 + 振り返り入力経路 (振り返り可能時期外でのボタン非表示確認)                                                                                                  |
| integration | `__tests__/integration/this-month-milestones.integration.test.tsx`  | ホーム上部カードの表示条件 (当月マイルストーン有無、振り返りボタン表示)                                                                                                         |

平均表示の変更は `app/(tabs)/index.tsx` 内のシンプルな式変更のため、既存テストの追加修正で足りる場合は新規テストファイルを作らない。

## 動作確認 (受け入れ条件)

1. 年間目標タブで新規目標作成 → 月マイルストーン追加が可能
2. 当月マイルストーンがホーム上部に表示され、「振り返る」ボタンから振り返り入力できる
3. 振り返り可能期間外 (例: 月初) は「振り返る」ボタンが非表示
4. 過去月のマイルストーンはいつでも振り返り可能
5. 年セレクターで前年に切替 → 過去目標の年末振り返りが入力可能
6. 月別サマリーが「平均: XXX分/日」表示になる
7. 4 ステップ品質チェック (`lint` / `format:check` / `tsc --noEmit` / `npm test`) すべて通過
