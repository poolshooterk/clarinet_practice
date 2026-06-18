# 年間目標機能の追加 + 月別表示の「平均」化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** クラリネット練習記録アプリに「年間目標 + 月別マイルストーン + 振り返り」機能を新タブで追加し、加えて月別サマリーを「合計」から「平均: XXX分/日」表示に変更する。

**Architecture:** `purchase-plan` 機能と同じ「親 + 子テーブル + 1 ストア + 詳細遷移」パターンを踏襲する。`annual_goals` (1 ユーザ × 年 × 任意件数) と `monthly_milestones` (sparse な 1-12 月) の 2 テーブル + RLS。1 ストア (`useAnnualGoalsStore`) に goals (nested milestones を含む) を保持し、純粋ヘルパー (`canReviewMilestone` / `calcGoalProgress` / `canReviewAnnualGoal`) は `forms/annual-goal.ts` に集約する。

**Tech Stack:** Supabase (Postgres + RLS) / Zustand v5 / React Hook Form + zod + Tamagui / expo-router v6 / Jest + React Native Testing Library

---

## ファイル一覧 (このプランで作る / 変更するファイル)

新規:

- `supabase/migrations/20260530000000_add_annual_goals.sql`
- `forms/annual-goal.ts`
- `forms/__tests__/annual-goal.test.ts`
- `store/annual-goal.ts`
- `store/__tests__/annual-goal.test.ts`
- `components/annual-goal-card.tsx`
- `components/monthly-milestone-card.tsx`
- `components/this-month-milestones-card.tsx`
- `app/(tabs)/annual-goals.tsx`
- `app/annual-goal-form.tsx`
- `app/annual-goal-detail.tsx`
- `app/monthly-milestone-form.tsx`
- `__tests__/integration/annual-goal-form.integration.test.tsx`
- `__tests__/integration/monthly-milestone-form.integration.test.tsx`
- `__tests__/integration/this-month-milestones.integration.test.tsx`

変更:

- `app/(tabs)/_layout.tsx` (新タブ追加)
- `app/(tabs)/index.tsx` (上部に「今月のマイルストーン」カード挿入 + 「合計」→「平均」)

---

### Task 1: Supabase マイグレーション

**Files:**

- Create: `supabase/migrations/20260530000000_add_annual_goals.sql`

- [ ] **Step 1: マイグレーションファイルを作成**

```sql
-- 年間目標
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

ALTER TABLE annual_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY annual_goals_select ON annual_goals FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY annual_goals_insert ON annual_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY annual_goals_update ON annual_goals FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY annual_goals_delete ON annual_goals FOR DELETE
  USING (auth.uid() = user_id);

-- 月別マイルストーン (sparse)
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

ALTER TABLE monthly_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY monthly_milestones_select ON monthly_milestones FOR SELECT
  USING (EXISTS (SELECT 1 FROM annual_goals
                 WHERE id = monthly_milestones.annual_goal_id AND user_id = auth.uid()));
CREATE POLICY monthly_milestones_insert ON monthly_milestones FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM annual_goals
                      WHERE id = monthly_milestones.annual_goal_id AND user_id = auth.uid()));
CREATE POLICY monthly_milestones_update ON monthly_milestones FOR UPDATE
  USING (EXISTS (SELECT 1 FROM annual_goals
                 WHERE id = monthly_milestones.annual_goal_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM annual_goals
                      WHERE id = monthly_milestones.annual_goal_id AND user_id = auth.uid()));
CREATE POLICY monthly_milestones_delete ON monthly_milestones FOR DELETE
  USING (EXISTS (SELECT 1 FROM annual_goals
                 WHERE id = monthly_milestones.annual_goal_id AND user_id = auth.uid()));

CREATE INDEX monthly_milestones_goal_idx ON monthly_milestones (annual_goal_id);
```

- [ ] **Step 2: マイグレーションを適用**

Supabase MCP `apply_migration` で適用する。`name: "add_annual_goals"`, `query: <ファイル内容>`。

- [ ] **Step 3: 適用確認**

Supabase MCP `list_tables` で `annual_goals` と `monthly_milestones` が存在することを確認。`get_advisors` で security/performance に新規警告がないことを確認。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260530000000_add_annual_goals.sql
git commit -m "feat: 年間目標 / 月別マイルストーンテーブルを追加"
```

注: doc-only ではないが pre-commit hook で SQL ファイルに lint-staged は触らないため品質チェック 4 ステップは Task 16 で一括実施で OK (このコミット単独では実行不要)。

---

### Task 2: `forms/annual-goal.ts` — zod スキーマ

**Files:**

- Create: `forms/annual-goal.ts`
- Create: `forms/__tests__/annual-goal.test.ts`

- [ ] **Step 1: 失敗するテストを書く** (`forms/__tests__/annual-goal.test.ts`)

```ts
import {
  annualGoalSchema,
  monthlyMilestoneSchema,
  annualGoalYearEndReviewSchema,
} from '@/forms/annual-goal';

describe('annualGoalSchema', () => {
  it('正常: title と year のみで通る', () => {
    const result = annualGoalSchema.safeParse({ year: 2026, title: '音色を磨く' });
    expect(result.success).toBe(true);
  });

  it('数値目標 + 単位 を含めて通る', () => {
    const result = annualGoalSchema.safeParse({
      year: 2026,
      title: '教本を進める',
      numericTarget: 50,
      numericUnit: 'ページ',
    });
    expect(result.success).toBe(true);
  });

  it('title が空だとエラー', () => {
    const result = annualGoalSchema.safeParse({ year: 2026, title: '' });
    expect(result.success).toBe(false);
  });

  it('year が範囲外 (1999) だとエラー', () => {
    const result = annualGoalSchema.safeParse({ year: 1999, title: 'X' });
    expect(result.success).toBe(false);
  });

  it('year が範囲外 (2101) だとエラー', () => {
    const result = annualGoalSchema.safeParse({ year: 2101, title: 'X' });
    expect(result.success).toBe(false);
  });

  it('numericTarget が 0 だとエラー', () => {
    const result = annualGoalSchema.safeParse({ year: 2026, title: 'X', numericTarget: 0 });
    expect(result.success).toBe(false);
  });
});

describe('monthlyMilestoneSchema', () => {
  it('正常: month と text のみで通る', () => {
    const result = monthlyMilestoneSchema.safeParse({ month: 5, text: 'ロングトーン強化' });
    expect(result.success).toBe(true);
  });

  it('振り返り欄を含めて通る', () => {
    const result = monthlyMilestoneSchema.safeParse({
      month: 5,
      text: 'X',
      reviewText: 'よかった',
      achievement: 'achieved',
    });
    expect(result.success).toBe(true);
  });

  it('month=0 はエラー', () => {
    const result = monthlyMilestoneSchema.safeParse({ month: 0, text: 'X' });
    expect(result.success).toBe(false);
  });

  it('month=13 はエラー', () => {
    const result = monthlyMilestoneSchema.safeParse({ month: 13, text: 'X' });
    expect(result.success).toBe(false);
  });

  it('text が空だとエラー', () => {
    const result = monthlyMilestoneSchema.safeParse({ month: 5, text: '' });
    expect(result.success).toBe(false);
  });

  it('不正な achievement はエラー', () => {
    const result = monthlyMilestoneSchema.safeParse({
      month: 5,
      text: 'X',
      achievement: 'good',
    });
    expect(result.success).toBe(false);
  });
});

describe('annualGoalYearEndReviewSchema', () => {
  it('全フィールド任意のため空オブジェクトで通る', () => {
    const result = annualGoalYearEndReviewSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('正常: テキスト + 達成判定で通る', () => {
    const result = annualGoalYearEndReviewSchema.safeParse({
      yearEndReviewText: '今年は成長した',
      yearEndAchievement: 'partial',
    });
    expect(result.success).toBe(true);
  });

  it('不正な yearEndAchievement はエラー', () => {
    const result = annualGoalYearEndReviewSchema.safeParse({ yearEndAchievement: 'maybe' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest forms/__tests__/annual-goal.test.ts
```

Expected: import エラーで全テスト FAIL。

- [ ] **Step 3: `forms/annual-goal.ts` を実装**

```ts
import { z } from 'zod';

export const ACHIEVEMENT_VALUES = ['achieved', 'partial', 'unachieved'] as const;
export type Achievement = (typeof ACHIEVEMENT_VALUES)[number];

export const ACHIEVEMENT_LABELS: Record<Achievement, string> = {
  achieved: '達成',
  partial: '一部達成',
  unachieved: '未達成',
};

export const annualGoalSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  title: z.string().min(1, '入力してください'),
  numericTarget: z.number().int().positive('正の値を入力してください').nullable().optional(),
  numericUnit: z.string().max(20).nullable().optional(),
});

export const monthlyMilestoneSchema = z.object({
  month: z.number().int().min(1).max(12),
  text: z.string().min(1, '入力してください'),
  numericTarget: z.number().int().positive('正の値を入力してください').nullable().optional(),
  numericUnit: z.string().max(20).nullable().optional(),
  reviewText: z.string().nullable().optional(),
  achievement: z.enum(ACHIEVEMENT_VALUES).nullable().optional(),
});

export const annualGoalYearEndReviewSchema = z.object({
  yearEndReviewText: z.string().nullable().optional(),
  yearEndAchievement: z.enum(ACHIEVEMENT_VALUES).nullable().optional(),
});

export type AnnualGoalInput = z.infer<typeof annualGoalSchema>;
export type MonthlyMilestoneInput = z.infer<typeof monthlyMilestoneSchema>;
export type YearEndReviewInput = z.infer<typeof annualGoalYearEndReviewSchema>;
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest forms/__tests__/annual-goal.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add forms/annual-goal.ts forms/__tests__/annual-goal.test.ts
git commit -m "feat: 年間目標 zod スキーマと型定義を追加"
```

---

### Task 3: `forms/annual-goal.ts` — `canReviewMilestone` / `canReviewAnnualGoal` ヘルパー

**Files:**

- Modify: `forms/annual-goal.ts` (関数追加)
- Modify: `forms/__tests__/annual-goal.test.ts` (テスト追加)

- [ ] **Step 1: 失敗するテストを書く** (`forms/__tests__/annual-goal.test.ts` に追記)

```ts
import { canReviewMilestone, canReviewAnnualGoal } from '@/forms/annual-goal';

describe('canReviewMilestone', () => {
  it('過去の月: 常に true', () => {
    // milestone = 2026-03、today = 2026-05-01
    expect(canReviewMilestone(2026, 3, new Date(2026, 4, 1))).toBe(true);
  });

  it('未来の月: false', () => {
    // milestone = 2026-12、today = 2026-05-30
    expect(canReviewMilestone(2026, 12, new Date(2026, 4, 30))).toBe(false);
  });

  it('当月最終週 7 日目 (5月25日) ちょうど: true', () => {
    expect(canReviewMilestone(2026, 5, new Date(2026, 4, 25))).toBe(true);
  });

  it('当月最終週 7 日目の前日 (5月24日): false', () => {
    expect(canReviewMilestone(2026, 5, new Date(2026, 4, 24))).toBe(false);
  });

  it('当月の月末日 (5月31日): true', () => {
    expect(canReviewMilestone(2026, 5, new Date(2026, 4, 31))).toBe(true);
  });

  it('2月 (28日): 2月22日 ちょうどで true', () => {
    expect(canReviewMilestone(2026, 2, new Date(2026, 1, 22))).toBe(true);
  });

  it('2月: 2月21日 で false', () => {
    expect(canReviewMilestone(2026, 2, new Date(2026, 1, 21))).toBe(false);
  });

  it('うるう年 (2024年2月、29日): 2月23日 ちょうどで true', () => {
    expect(canReviewMilestone(2024, 2, new Date(2024, 1, 23))).toBe(true);
  });

  it('過去年: 常に true', () => {
    expect(canReviewMilestone(2025, 1, new Date(2026, 4, 30))).toBe(true);
  });
});

describe('canReviewAnnualGoal', () => {
  it('過去年: true', () => {
    expect(canReviewAnnualGoal(2025, new Date(2026, 4, 30))).toBe(true);
  });

  it('当年で 12月最終週開始 (12月25日): true', () => {
    expect(canReviewAnnualGoal(2026, new Date(2026, 11, 25))).toBe(true);
  });

  it('当年で 12月24日: false', () => {
    expect(canReviewAnnualGoal(2026, new Date(2026, 11, 24))).toBe(false);
  });

  it('未来年: false', () => {
    expect(canReviewAnnualGoal(2027, new Date(2026, 4, 30))).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest forms/__tests__/annual-goal.test.ts -t 'canReview'
```

Expected: 関数未定義で FAIL。

- [ ] **Step 3: ヘルパーを実装** (`forms/annual-goal.ts` に追記)

```ts
// (year, month) の月末日。例: canReviewMilestone(2026, 5, today) で month=5 (1-indexed)
// new Date(year, month, 0) は month の前月 (1-indexed なので month そのもの分の進めて) 末日を返す
// month=5 → new Date(2026, 5, 0) = 2026-05-31
function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function canReviewMilestone(year: number, month: number, today: Date): boolean {
  const monthEnd = getLastDayOfMonth(year, month);
  // 最終週 7 日: 月末日含めて 7 日間 (例: 5月25日〜5月31日)
  const reviewWindowStart = new Date(year, month - 1, monthEnd.getDate() - 6);
  return startOfDay(today).getTime() >= reviewWindowStart.getTime();
}

export function canReviewAnnualGoal(year: number, today: Date): boolean {
  return canReviewMilestone(year, 12, today);
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest forms/__tests__/annual-goal.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add forms/annual-goal.ts forms/__tests__/annual-goal.test.ts
git commit -m "feat: 振り返り可能判定ヘルパーを追加"
```

---

### Task 4: `forms/annual-goal.ts` — `calcGoalProgress`

**Files:**

- Modify: `forms/annual-goal.ts`
- Modify: `forms/__tests__/annual-goal.test.ts`

- [ ] **Step 1: 失敗するテストを書く** (テスト追記)

```ts
import { calcGoalProgress } from '@/forms/annual-goal';

describe('calcGoalProgress', () => {
  it('milestones が空: unset=12 で他は 0', () => {
    expect(calcGoalProgress([])).toEqual({
      achieved: 0,
      partial: 0,
      unachieved: 0,
      unreviewed: 0,
      unset: 12,
    });
  });

  it('混合: 各 achievement を正しくカウント、未振り返りも区別', () => {
    const milestones = [
      { month: 1, text: 'A', achievement: 'achieved' as const },
      { month: 2, text: 'B', achievement: 'partial' as const },
      { month: 3, text: 'C', achievement: 'unachieved' as const },
      { month: 4, text: 'D', achievement: null },
      { month: 5, text: 'E', achievement: null },
    ];
    expect(calcGoalProgress(milestones)).toEqual({
      achieved: 1,
      partial: 1,
      unachieved: 1,
      unreviewed: 2,
      unset: 7, // 12 - 5
    });
  });

  it('12 件全て埋まる: unset=0', () => {
    const milestones = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      text: 'X',
      achievement: 'achieved' as const,
    }));
    expect(calcGoalProgress(milestones)).toEqual({
      achieved: 12,
      partial: 0,
      unachieved: 0,
      unreviewed: 0,
      unset: 0,
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest forms/__tests__/annual-goal.test.ts -t 'calcGoalProgress'
```

Expected: 関数未定義で FAIL。

- [ ] **Step 3: 実装** (`forms/annual-goal.ts` に追記)

```ts
type MilestoneForProgress = { achievement?: Achievement | null };

export type GoalProgress = {
  achieved: number;
  partial: number;
  unachieved: number;
  unreviewed: number;
  unset: number;
};

export function calcGoalProgress(milestones: MilestoneForProgress[]): GoalProgress {
  let achieved = 0;
  let partial = 0;
  let unachieved = 0;
  let unreviewed = 0;
  for (const m of milestones) {
    if (m.achievement === 'achieved') achieved++;
    else if (m.achievement === 'partial') partial++;
    else if (m.achievement === 'unachieved') unachieved++;
    else unreviewed++;
  }
  return { achieved, partial, unachieved, unreviewed, unset: 12 - milestones.length };
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest forms/__tests__/annual-goal.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add forms/annual-goal.ts forms/__tests__/annual-goal.test.ts
git commit -m "feat: 年間目標の進捗集計ヘルパーを追加"
```

---

### Task 5: `store/annual-goal.ts` — `fetchAll` + 型定義

**Files:**

- Create: `store/annual-goal.ts`
- Create: `store/__tests__/annual-goal.test.ts`

- [ ] **Step 1: 失敗するテストを書く** (`store/__tests__/annual-goal.test.ts`)

```ts
import { useAnnualGoalsStore } from '@/store/annual-goal';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const mockedSupabase = supabase as unknown as {
  auth: { getUser: jest.Mock };
  from: jest.Mock;
};

beforeEach(() => {
  useAnnualGoalsStore.setState({ goals: [], loading: false });
  jest.clearAllMocks();
  mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
});

describe('fetchAll', () => {
  it('annual_goals と nested milestones を取得して state に格納する', async () => {
    const row = {
      id: 'g1',
      year: 2026,
      title: '音色を磨く',
      numeric_target: null,
      numeric_unit: null,
      year_end_review_text: null,
      year_end_achievement: null,
      year_end_reviewed_at: null,
      monthly_milestones: [
        {
          id: 'm1',
          month: 5,
          text: 'ロングトーン',
          numeric_target: null,
          numeric_unit: null,
          review_text: null,
          achievement: null,
          reviewed_at: null,
        },
      ],
    };
    mockedSupabase.from.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [row], error: null }),
    });

    await useAnnualGoalsStore.getState().fetchAll();
    const goals = useAnnualGoalsStore.getState().goals;
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({
      id: 'g1',
      year: 2026,
      title: '音色を磨く',
      milestones: [{ id: 'm1', month: 5, text: 'ロングトーン' }],
    });
  });

  it('未ログイン時は何もしない', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    await useAnnualGoalsStore.getState().fetchAll();
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it('error 時は goals を空にリセット', async () => {
    mockedSupabase.from.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: null, error: { message: 'oops' } }),
    });
    useAnnualGoalsStore.setState({ goals: [{ id: 'old' } as never] });
    await useAnnualGoalsStore.getState().fetchAll();
    expect(useAnnualGoalsStore.getState().goals).toEqual([]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest store/__tests__/annual-goal.test.ts
```

Expected: import エラーで FAIL。

- [ ] **Step 3: ストアを実装** (`store/annual-goal.ts`)

```ts
import { create } from 'zustand';

import type {
  Achievement,
  AnnualGoalInput,
  MonthlyMilestoneInput,
  YearEndReviewInput,
} from '@/forms/annual-goal';
import { supabase } from '@/lib/supabase';

export type Milestone = {
  id: string;
  month: number;
  text: string;
  numericTarget: number | null;
  numericUnit: string | null;
  reviewText: string | null;
  achievement: Achievement | null;
  reviewedAt: string | null;
};

export type AnnualGoal = {
  id: string;
  year: number;
  title: string;
  numericTarget: number | null;
  numericUnit: string | null;
  yearEndReviewText: string | null;
  yearEndAchievement: Achievement | null;
  yearEndReviewedAt: string | null;
  milestones: Milestone[];
};

export type ReviewInput = {
  reviewText: string | null;
  achievement: Achievement;
};

export type MutationResult =
  | { ok: true; goalId?: string; milestoneId?: string }
  | { ok: false; reason: 'unknown' };

type GoalRow = {
  id: string;
  year: number;
  title: string;
  numeric_target: number | null;
  numeric_unit: string | null;
  year_end_review_text: string | null;
  year_end_achievement: Achievement | null;
  year_end_reviewed_at: string | null;
  monthly_milestones: MilestoneRow[];
};

type MilestoneRow = {
  id: string;
  month: number;
  text: string;
  numeric_target: number | null;
  numeric_unit: string | null;
  review_text: string | null;
  achievement: Achievement | null;
  reviewed_at: string | null;
};

const GOAL_SELECT =
  'id, year, title, numeric_target, numeric_unit, ' +
  'year_end_review_text, year_end_achievement, year_end_reviewed_at, ' +
  'monthly_milestones ( id, month, text, numeric_target, numeric_unit, ' +
  'review_text, achievement, reviewed_at )';

function mapMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    month: row.month,
    text: row.text,
    numericTarget: row.numeric_target,
    numericUnit: row.numeric_unit,
    reviewText: row.review_text,
    achievement: row.achievement,
    reviewedAt: row.reviewed_at,
  };
}

function mapGoal(row: GoalRow): AnnualGoal {
  return {
    id: row.id,
    year: row.year,
    title: row.title,
    numericTarget: row.numeric_target,
    numericUnit: row.numeric_unit,
    yearEndReviewText: row.year_end_review_text,
    yearEndAchievement: row.year_end_achievement,
    yearEndReviewedAt: row.year_end_reviewed_at,
    milestones: (row.monthly_milestones ?? []).map(mapMilestone),
  };
}

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

export const useAnnualGoalsStore = create<State>()((set, get) => ({
  goals: [],
  loading: false,

  fetchAll: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    set({ loading: true });
    const { data, error } = await supabase.from('annual_goals').select(GOAL_SELECT);
    set({ loading: false });

    if (error || !data) {
      set({ goals: [] });
      return;
    }
    const goals = (data as unknown as GoalRow[]).map(mapGoal);
    set({ goals });
  },

  addGoal: async () => ({ ok: false, reason: 'unknown' }),
  updateGoal: async () => ({ ok: false, reason: 'unknown' }),
  removeGoal: async () => {},
  upsertMilestone: async () => ({ ok: false, reason: 'unknown' }),
  removeMilestone: async () => {},
  reviewMilestone: async () => ({ ok: false, reason: 'unknown' }),
  yearEndReview: async () => ({ ok: false, reason: 'unknown' }),
}));
```

注: `addGoal` 以降は次タスクで実装するため一旦スタブにする。

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest store/__tests__/annual-goal.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add store/annual-goal.ts store/__tests__/annual-goal.test.ts
git commit -m "feat: 年間目標ストアの fetchAll を実装"
```

---

### Task 6: store — `addGoal` / `updateGoal` / `removeGoal`

**Files:**

- Modify: `store/annual-goal.ts`
- Modify: `store/__tests__/annual-goal.test.ts`

- [ ] **Step 1: 失敗するテストを書く** (テスト追記)

```ts
describe('addGoal', () => {
  it('insert 成功時に goals に追加される', async () => {
    mockedSupabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'g1',
              year: 2026,
              title: 'X',
              numeric_target: null,
              numeric_unit: null,
              year_end_review_text: null,
              year_end_achievement: null,
              year_end_reviewed_at: null,
            },
            error: null,
          }),
        }),
      }),
    });
    const result = await useAnnualGoalsStore.getState().addGoal({ year: 2026, title: 'X' });
    expect(result).toEqual({ ok: true, goalId: 'g1' });
    expect(useAnnualGoalsStore.getState().goals[0]).toMatchObject({ id: 'g1', title: 'X' });
  });

  it('error 時は { ok: false } を返す', async () => {
    mockedSupabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'X' } }),
        }),
      }),
    });
    const result = await useAnnualGoalsStore.getState().addGoal({ year: 2026, title: 'X' });
    expect(result).toEqual({ ok: false, reason: 'unknown' });
  });
});

describe('updateGoal', () => {
  it('成功時に state を更新する', async () => {
    useAnnualGoalsStore.setState({
      goals: [
        {
          id: 'g1',
          year: 2026,
          title: 'old',
          numericTarget: null,
          numericUnit: null,
          yearEndReviewText: null,
          yearEndAchievement: null,
          yearEndReviewedAt: null,
          milestones: [],
        },
      ],
    });
    mockedSupabase.from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useAnnualGoalsStore
      .getState()
      .updateGoal('g1', { year: 2026, title: 'new', numericTarget: 50, numericUnit: 'ページ' });
    expect(useAnnualGoalsStore.getState().goals[0].title).toBe('new');
    expect(useAnnualGoalsStore.getState().goals[0].numericTarget).toBe(50);
  });
});

describe('removeGoal', () => {
  it('成功時に goals から除外', async () => {
    useAnnualGoalsStore.setState({
      goals: [{ id: 'g1', milestones: [] } as never, { id: 'g2', milestones: [] } as never],
    });
    mockedSupabase.from.mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useAnnualGoalsStore.getState().removeGoal('g1');
    expect(useAnnualGoalsStore.getState().goals.map((g) => g.id)).toEqual(['g2']);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest store/__tests__/annual-goal.test.ts -t 'addGoal|updateGoal|removeGoal'
```

Expected: スタブ実装のため `addGoal` は `{ ok: false }`、`updateGoal` は state 変化なしで FAIL。

- [ ] **Step 3: 実装** (`store/annual-goal.ts` の対応アクションを差し替え)

```ts
addGoal: async (input) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { ok: false, reason: 'unknown' };
  const { data, error } = await supabase
    .from('annual_goals')
    .insert({
      user_id: userData.user.id,
      year: input.year,
      title: input.title,
      numeric_target: input.numericTarget ?? null,
      numeric_unit: input.numericUnit ?? null,
    })
    .select(
      'id, year, title, numeric_target, numeric_unit, ' +
        'year_end_review_text, year_end_achievement, year_end_reviewed_at',
    )
    .single();
  if (error || !data) return { ok: false, reason: 'unknown' };
  const row = data as unknown as Omit<GoalRow, 'monthly_milestones'>;
  const goal = mapGoal({ ...row, monthly_milestones: [] });
  set({ goals: [goal, ...get().goals] });
  return { ok: true, goalId: goal.id };
},

updateGoal: async (id, input) => {
  const { error } = await supabase
    .from('annual_goals')
    .update({
      year: input.year,
      title: input.title,
      numeric_target: input.numericTarget ?? null,
      numeric_unit: input.numericUnit ?? null,
    })
    .eq('id', id);
  if (error) return { ok: false, reason: 'unknown' };
  set({
    goals: get().goals.map((g) =>
      g.id === id
        ? {
            ...g,
            year: input.year,
            title: input.title,
            numericTarget: input.numericTarget ?? null,
            numericUnit: input.numericUnit ?? null,
          }
        : g,
    ),
  });
  return { ok: true, goalId: id };
},

removeGoal: async (id) => {
  const { error } = await supabase.from('annual_goals').delete().eq('id', id);
  if (error) return;
  set({ goals: get().goals.filter((g) => g.id !== id) });
},
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest store/__tests__/annual-goal.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add store/annual-goal.ts store/__tests__/annual-goal.test.ts
git commit -m "feat: 年間目標ストアに addGoal/updateGoal/removeGoal を実装"
```

---

### Task 7: store — `upsertMilestone` / `removeMilestone`

**Files:**

- Modify: `store/annual-goal.ts`
- Modify: `store/__tests__/annual-goal.test.ts`

- [ ] **Step 1: 失敗するテストを書く** (テスト追記)

```ts
describe('upsertMilestone', () => {
  const baseGoal = {
    id: 'g1',
    year: 2026,
    title: 'X',
    numericTarget: null,
    numericUnit: null,
    yearEndReviewText: null,
    yearEndAchievement: null,
    yearEndReviewedAt: null,
    milestones: [],
  };

  it('新規月: 該当 goal の milestones に追加', async () => {
    useAnnualGoalsStore.setState({ goals: [baseGoal] });
    mockedSupabase.from.mockReturnValue({
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'm1',
              month: 5,
              text: 'A',
              numeric_target: null,
              numeric_unit: null,
              review_text: null,
              achievement: null,
              reviewed_at: null,
            },
            error: null,
          }),
        }),
      }),
    });
    await useAnnualGoalsStore.getState().upsertMilestone('g1', { month: 5, text: 'A' });
    expect(useAnnualGoalsStore.getState().goals[0].milestones).toHaveLength(1);
    expect(useAnnualGoalsStore.getState().goals[0].milestones[0].month).toBe(5);
  });

  it('既存月: 該当 milestone を置き換え', async () => {
    useAnnualGoalsStore.setState({
      goals: [
        {
          ...baseGoal,
          milestones: [
            {
              id: 'm1',
              month: 5,
              text: 'old',
              numericTarget: null,
              numericUnit: null,
              reviewText: null,
              achievement: null,
              reviewedAt: null,
            },
          ],
        },
      ],
    });
    mockedSupabase.from.mockReturnValue({
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'm1',
              month: 5,
              text: 'new',
              numeric_target: 10,
              numeric_unit: 'ページ',
              review_text: null,
              achievement: null,
              reviewed_at: null,
            },
            error: null,
          }),
        }),
      }),
    });
    await useAnnualGoalsStore
      .getState()
      .upsertMilestone('g1', { month: 5, text: 'new', numericTarget: 10, numericUnit: 'ページ' });
    const milestones = useAnnualGoalsStore.getState().goals[0].milestones;
    expect(milestones).toHaveLength(1);
    expect(milestones[0].text).toBe('new');
    expect(milestones[0].numericTarget).toBe(10);
  });
});

describe('removeMilestone', () => {
  it('成功時に milestones から除外', async () => {
    useAnnualGoalsStore.setState({
      goals: [
        {
          id: 'g1',
          year: 2026,
          title: 'X',
          numericTarget: null,
          numericUnit: null,
          yearEndReviewText: null,
          yearEndAchievement: null,
          yearEndReviewedAt: null,
          milestones: [
            {
              id: 'm1',
              month: 5,
              text: 'A',
              numericTarget: null,
              numericUnit: null,
              reviewText: null,
              achievement: null,
              reviewedAt: null,
            },
          ],
        },
      ],
    });
    mockedSupabase.from.mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useAnnualGoalsStore.getState().removeMilestone('m1');
    expect(useAnnualGoalsStore.getState().goals[0].milestones).toEqual([]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest store/__tests__/annual-goal.test.ts -t 'upsertMilestone|removeMilestone'
```

Expected: スタブのため FAIL。

- [ ] **Step 3: 実装** (`store/annual-goal.ts` の該当アクションを差し替え)

```ts
upsertMilestone: async (goalId, input) => {
  const { data, error } = await supabase
    .from('monthly_milestones')
    .upsert(
      {
        annual_goal_id: goalId,
        month: input.month,
        text: input.text,
        numeric_target: input.numericTarget ?? null,
        numeric_unit: input.numericUnit ?? null,
      },
      { onConflict: 'annual_goal_id,month' },
    )
    .select(
      'id, month, text, numeric_target, numeric_unit, review_text, achievement, reviewed_at',
    )
    .single();
  if (error || !data) return { ok: false, reason: 'unknown' };
  const milestone = mapMilestone(data as unknown as MilestoneRow);
  set({
    goals: get().goals.map((g) => {
      if (g.id !== goalId) return g;
      const existing = g.milestones.findIndex((m) => m.month === milestone.month);
      const nextMilestones =
        existing >= 0
          ? g.milestones.map((m, i) => (i === existing ? milestone : m))
          : [...g.milestones, milestone];
      return { ...g, milestones: nextMilestones };
    }),
  });
  return { ok: true, milestoneId: milestone.id };
},

removeMilestone: async (id) => {
  const { error } = await supabase.from('monthly_milestones').delete().eq('id', id);
  if (error) return;
  set({
    goals: get().goals.map((g) => ({
      ...g,
      milestones: g.milestones.filter((m) => m.id !== id),
    })),
  });
},
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest store/__tests__/annual-goal.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add store/annual-goal.ts store/__tests__/annual-goal.test.ts
git commit -m "feat: 年間目標ストアに milestone CRUD を実装"
```

---

### Task 8: store — `reviewMilestone` / `yearEndReview`

**Files:**

- Modify: `store/annual-goal.ts`
- Modify: `store/__tests__/annual-goal.test.ts`

- [ ] **Step 1: 失敗するテストを書く** (テスト追記)

```ts
describe('reviewMilestone', () => {
  it('既存 milestone を review 内容で更新', async () => {
    useAnnualGoalsStore.setState({
      goals: [
        {
          id: 'g1',
          year: 2026,
          title: 'X',
          numericTarget: null,
          numericUnit: null,
          yearEndReviewText: null,
          yearEndAchievement: null,
          yearEndReviewedAt: null,
          milestones: [
            {
              id: 'm1',
              month: 5,
              text: 'A',
              numericTarget: null,
              numericUnit: null,
              reviewText: null,
              achievement: null,
              reviewedAt: null,
            },
          ],
        },
      ],
    });
    mockedSupabase.from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'm1',
                month: 5,
                text: 'A',
                numeric_target: null,
                numeric_unit: null,
                review_text: 'いいかんじ',
                achievement: 'partial',
                reviewed_at: '2026-05-25T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    await useAnnualGoalsStore
      .getState()
      .reviewMilestone('m1', { reviewText: 'いいかんじ', achievement: 'partial' });
    const m = useAnnualGoalsStore.getState().goals[0].milestones[0];
    expect(m.achievement).toBe('partial');
    expect(m.reviewText).toBe('いいかんじ');
    expect(m.reviewedAt).toBe('2026-05-25T00:00:00Z');
  });
});

describe('yearEndReview', () => {
  it('annual goal の年末振り返り欄を更新', async () => {
    useAnnualGoalsStore.setState({
      goals: [
        {
          id: 'g1',
          year: 2026,
          title: 'X',
          numericTarget: null,
          numericUnit: null,
          yearEndReviewText: null,
          yearEndAchievement: null,
          yearEndReviewedAt: null,
          milestones: [],
        },
      ],
    });
    mockedSupabase.from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                year_end_review_text: 'よい一年だった',
                year_end_achievement: 'achieved',
                year_end_reviewed_at: '2026-12-31T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    await useAnnualGoalsStore.getState().yearEndReview('g1', {
      yearEndReviewText: 'よい一年だった',
      yearEndAchievement: 'achieved',
    });
    const g = useAnnualGoalsStore.getState().goals[0];
    expect(g.yearEndAchievement).toBe('achieved');
    expect(g.yearEndReviewText).toBe('よい一年だった');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest store/__tests__/annual-goal.test.ts -t 'reviewMilestone|yearEndReview'
```

Expected: FAIL。

- [ ] **Step 3: 実装** (`store/annual-goal.ts`)

```ts
reviewMilestone: async (id, review) => {
  const reviewedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('monthly_milestones')
    .update({
      review_text: review.reviewText,
      achievement: review.achievement,
      reviewed_at: reviewedAt,
    })
    .eq('id', id)
    .select(
      'id, month, text, numeric_target, numeric_unit, review_text, achievement, reviewed_at',
    )
    .single();
  if (error || !data) return { ok: false, reason: 'unknown' };
  const milestone = mapMilestone(data as unknown as MilestoneRow);
  set({
    goals: get().goals.map((g) => ({
      ...g,
      milestones: g.milestones.map((m) => (m.id === id ? milestone : m)),
    })),
  });
  return { ok: true, milestoneId: id };
},

yearEndReview: async (goalId, review) => {
  const reviewedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('annual_goals')
    .update({
      year_end_review_text: review.yearEndReviewText ?? null,
      year_end_achievement: review.yearEndAchievement ?? null,
      year_end_reviewed_at: reviewedAt,
    })
    .eq('id', goalId)
    .select('year_end_review_text, year_end_achievement, year_end_reviewed_at')
    .single();
  if (error || !data) return { ok: false, reason: 'unknown' };
  const row = data as {
    year_end_review_text: string | null;
    year_end_achievement: Achievement | null;
    year_end_reviewed_at: string | null;
  };
  set({
    goals: get().goals.map((g) =>
      g.id === goalId
        ? {
            ...g,
            yearEndReviewText: row.year_end_review_text,
            yearEndAchievement: row.year_end_achievement,
            yearEndReviewedAt: row.year_end_reviewed_at,
          }
        : g,
    ),
  });
  return { ok: true, goalId };
},
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest store/__tests__/annual-goal.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add store/annual-goal.ts store/__tests__/annual-goal.test.ts
git commit -m "feat: 年間目標ストアに reviewMilestone / yearEndReview を実装"
```

---

### Task 9: `components/annual-goal-card.tsx`

**Files:**

- Create: `components/annual-goal-card.tsx`

責務: 一覧画面でカード 1 枚を描画。タイトル + 年間数値目標 + 進捗バッジ。

- [ ] **Step 1: コンポーネントを実装**

```tsx
import { Paragraph, Theme, XStack, YStack } from 'tamagui';

import { ACHIEVEMENT_LABELS, calcGoalProgress } from '@/forms/annual-goal';
import type { AnnualGoal } from '@/store/annual-goal';

type Props = {
  goal: AnnualGoal;
};

export function AnnualGoalCard({ goal }: Props) {
  const progress = calcGoalProgress(goal.milestones);
  return (
    <YStack
      mx="$3"
      mb="$2"
      p="$3"
      bg="$color1"
      rounded="$3"
      borderWidth={1}
      borderColor="$borderColor"
      gap="$2"
    >
      <XStack justify="space-between" items="baseline">
        <Paragraph fontWeight="bold">{goal.title}</Paragraph>
        {goal.numericTarget != null && (
          <Paragraph fontSize="$2" color="$color10">
            {`${goal.numericTarget}${goal.numericUnit ?? ''}`}
          </Paragraph>
        )}
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        {progress.achieved > 0 && (
          <Theme name="green">
            <Paragraph fontSize="$1" color="$color11" bg="$color3" px="$2" py="$1" rounded="$2">
              {`${ACHIEVEMENT_LABELS.achieved} ${progress.achieved}`}
            </Paragraph>
          </Theme>
        )}
        {progress.partial > 0 && (
          <Theme name="yellow">
            <Paragraph fontSize="$1" color="$color11" bg="$color3" px="$2" py="$1" rounded="$2">
              {`${ACHIEVEMENT_LABELS.partial} ${progress.partial}`}
            </Paragraph>
          </Theme>
        )}
        {progress.unachieved > 0 && (
          <Theme name="red">
            <Paragraph fontSize="$1" color="$color11" bg="$color3" px="$2" py="$1" rounded="$2">
              {`${ACHIEVEMENT_LABELS.unachieved} ${progress.unachieved}`}
            </Paragraph>
          </Theme>
        )}
        {progress.unreviewed > 0 && (
          <Paragraph fontSize="$1" color="$color10" bg="$color3" px="$2" py="$1" rounded="$2">
            {`未振り返り ${progress.unreviewed}`}
          </Paragraph>
        )}
        {progress.unset > 0 && (
          <Paragraph fontSize="$1" color="$color9" px="$2" py="$1">
            {`未設定 ${progress.unset}`}
          </Paragraph>
        )}
      </XStack>
    </YStack>
  );
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー 0。

- [ ] **Step 3: コミット**

```bash
git add components/annual-goal-card.tsx
git commit -m "feat: 年間目標カードコンポーネントを追加"
```

---

### Task 10: `components/monthly-milestone-card.tsx`

**Files:**

- Create: `components/monthly-milestone-card.tsx`

責務: 詳細画面で月マイルストーン 1 件を描画。未設定月用の「未設定 + 追加」表示も内包。

- [ ] **Step 1: コンポーネントを実装**

```tsx
import { Paragraph, Theme, XStack, YStack } from 'tamagui';

import { ACHIEVEMENT_LABELS } from '@/forms/annual-goal';
import type { Milestone } from '@/store/annual-goal';

type Props =
  | { month: number; milestone: Milestone; onPress?: () => void }
  | { month: number; milestone: null; onPress?: () => void };

const THEME_BY_ACHIEVEMENT = {
  achieved: 'green',
  partial: 'yellow',
  unachieved: 'red',
} as const;

export function MonthlyMilestoneCard(props: Props) {
  const { month, milestone, onPress } = props;
  if (!milestone) {
    return (
      <YStack
        mx="$3"
        mb="$2"
        p="$3"
        bg="$color1"
        rounded="$3"
        borderWidth={1}
        borderColor="$borderColor"
        gap="$1"
        onPress={onPress}
      >
        <Paragraph fontWeight="bold">{`${month}月`}</Paragraph>
        <Paragraph fontSize="$2" color="$color9">
          未設定（タップで追加）
        </Paragraph>
      </YStack>
    );
  }
  const themeName =
    milestone.achievement != null ? THEME_BY_ACHIEVEMENT[milestone.achievement] : null;
  return (
    <YStack
      mx="$3"
      mb="$2"
      p="$3"
      bg="$color1"
      rounded="$3"
      borderWidth={1}
      borderColor="$borderColor"
      gap="$1"
      onPress={onPress}
    >
      <XStack justify="space-between" items="baseline">
        <Paragraph fontWeight="bold">{`${month}月`}</Paragraph>
        {milestone.achievement != null && themeName != null && (
          <Theme name={themeName}>
            <Paragraph fontSize="$1" color="$color11" bg="$color3" px="$2" py="$1" rounded="$2">
              {ACHIEVEMENT_LABELS[milestone.achievement]}
            </Paragraph>
          </Theme>
        )}
      </XStack>
      <Paragraph fontSize="$3">{milestone.text}</Paragraph>
      {milestone.numericTarget != null && (
        <Paragraph fontSize="$2" color="$color10">
          {`目標: ${milestone.numericTarget}${milestone.numericUnit ?? ''}`}
        </Paragraph>
      )}
      {milestone.reviewText ? (
        <Paragraph fontSize="$2" color="$color11">
          {`振り返り: ${milestone.reviewText}`}
        </Paragraph>
      ) : null}
    </YStack>
  );
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー 0。

- [ ] **Step 3: コミット**

```bash
git add components/monthly-milestone-card.tsx
git commit -m "feat: 月別マイルストーンカードコンポーネントを追加"
```

---

### Task 11: `app/annual-goal-form.tsx` + integration test

**Files:**

- Create: `app/annual-goal-form.tsx`
- Create: `__tests__/integration/annual-goal-form.integration.test.tsx`

- [ ] **Step 1: 失敗する integration テストを書く** (`__tests__/integration/annual-goal-form.integration.test.tsx`)

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import AnnualGoalForm from '@/app/annual-goal-form';
import { useAnnualGoalsStore } from '@/store/annual-goal';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: { Screen: ({ children }: { children?: React.ReactNode }) => children ?? null },
  useLocalSearchParams: () => ({}),
}));

const addGoalSpy = jest.fn().mockResolvedValue({ ok: true, goalId: 'g1' });

beforeEach(() => {
  jest.clearAllMocks();
  useAnnualGoalsStore.setState({
    goals: [],
    loading: false,
    addGoal: addGoalSpy,
    updateGoal: jest.fn(),
    removeGoal: jest.fn(),
  } as never);
});

describe('AnnualGoalForm (新規)', () => {
  it('タイトル空送信でエラーが表示される', async () => {
    const { getByText } = renderWithProviders(<AnnualGoalForm />);
    fireEvent.press(getByText('保存'));
    await waitFor(() => {
      expect(getByText('入力してください')).toBeOnTheScreen();
    });
    expect(addGoalSpy).not.toHaveBeenCalled();
  });

  it('正常入力で addGoal が呼ばれる', async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(<AnnualGoalForm />);
    fireEvent.changeText(getByPlaceholderText('例: 音色を磨く'), 'X');
    fireEvent.press(getByText('保存'));
    await waitFor(() => {
      expect(addGoalSpy).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest __tests__/integration/annual-goal-form.integration.test.tsx
```

Expected: import エラーで FAIL。

- [ ] **Step 3: フォーム実装** (`app/annual-goal-form.tsx`)

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { NumericInput } from '@/components/form/numeric-input';
import { annualGoalSchema, type AnnualGoalInput } from '@/forms/annual-goal';
import { useAnnualGoalsStore } from '@/store/annual-goal';

export default function AnnualGoalForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const goals = useAnnualGoalsStore((s) => s.goals);
  const addGoal = useAnnualGoalsStore((s) => s.addGoal);
  const updateGoal = useAnnualGoalsStore((s) => s.updateGoal);
  const removeGoal = useAnnualGoalsStore((s) => s.removeGoal);

  const isEdit = id != null;
  const existing = useMemo(() => goals.find((g) => g.id === id), [goals, id]);
  const defaultValues: AnnualGoalInput = existing
    ? {
        year: existing.year,
        title: existing.title,
        numericTarget: existing.numericTarget,
        numericUnit: existing.numericUnit,
      }
    : { year: new Date().getFullYear(), title: '', numericTarget: null, numericUnit: null };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AnnualGoalInput>({
    resolver: zodResolver(annualGoalSchema),
    mode: 'onTouched',
    defaultValues,
  });

  async function onSubmit(values: AnnualGoalInput) {
    const result = isEdit ? await updateGoal(id!, values) : await addGoal(values);
    if (!result.ok) {
      Alert.alert('保存に失敗しました');
      return;
    }
    router.back();
  }

  async function onDelete() {
    if (!isEdit) return;
    Alert.alert('削除しますか？', '関連する月別マイルストーンもすべて削除されます。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await removeGoal(id!);
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: isEdit ? '年間目標の編集' : '年間目標の追加' }} />
      <YStack p="$4" gap="$3">
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>タイトル</Paragraph>
              <Input
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="例: 音色を磨く"
              />
              <FieldError error={errors.title?.message} />
            </YStack>
          )}
        />
        <Controller
          control={control}
          name="year"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>年</Paragraph>
              <NumericInput
                value={field.value}
                onChange={(v) => field.onChange(v ?? new Date().getFullYear())}
                onBlur={field.onBlur}
              />
              <FieldError error={errors.year?.message} />
            </YStack>
          )}
        />
        <Controller
          control={control}
          name="numericTarget"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>年間数値目標 (任意)</Paragraph>
              <NumericInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            </YStack>
          )}
        />
        <Controller
          control={control}
          name="numericUnit"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>単位 (任意)</Paragraph>
              <Input
                value={field.value ?? ''}
                onChangeText={(v) => field.onChange(v || null)}
                onBlur={field.onBlur}
                placeholder="例: ページ"
              />
            </YStack>
          )}
        />
        <Button onPress={handleSubmit(onSubmit)} disabled={isSubmitting} theme="blue">
          保存
        </Button>
        {isEdit && (
          <Button onPress={onDelete} theme="red">
            削除
          </Button>
        )}
      </YStack>
    </>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest __tests__/integration/annual-goal-form.integration.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add app/annual-goal-form.tsx __tests__/integration/annual-goal-form.integration.test.tsx
git commit -m "feat: 年間目標フォーム画面を追加"
```

---

### Task 12: `app/monthly-milestone-form.tsx` + integration test

**Files:**

- Create: `app/monthly-milestone-form.tsx`
- Create: `__tests__/integration/monthly-milestone-form.integration.test.tsx`

- [ ] **Step 1: 失敗する integration テストを書く**

```tsx
import { fireEvent, waitFor } from '@testing-library/react-native';

import MonthlyMilestoneForm from '@/app/monthly-milestone-form';
import { useAnnualGoalsStore } from '@/store/annual-goal';
import { renderWithProviders } from '@/test-utils/render';

const baseGoal = {
  id: 'g1',
  year: new Date().getFullYear(),
  title: 'X',
  numericTarget: null,
  numericUnit: null,
  yearEndReviewText: null,
  yearEndAchievement: null,
  yearEndReviewedAt: null,
  milestones: [],
};

let params: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: { Screen: ({ children }: { children?: React.ReactNode }) => children ?? null },
  useLocalSearchParams: () => params,
}));

const upsertSpy = jest.fn().mockResolvedValue({ ok: true });
const reviewSpy = jest.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  jest.clearAllMocks();
  useAnnualGoalsStore.setState({
    goals: [baseGoal],
    loading: false,
    upsertMilestone: upsertSpy,
    removeMilestone: jest.fn(),
    reviewMilestone: reviewSpy,
  } as never);
  params = { goalId: 'g1', month: '5' };
});

describe('MonthlyMilestoneForm', () => {
  it('未来月では振り返り欄が非表示', () => {
    // 12月 (今年中で最終週前) を指定
    params = { goalId: 'g1', month: '12' };
    const { queryByText } = renderWithProviders(<MonthlyMilestoneForm />);
    expect(queryByText('振り返り')).toBeNull();
  });

  it('正常入力で upsertMilestone が呼ばれる', async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(<MonthlyMilestoneForm />);
    fireEvent.changeText(getByPlaceholderText('例: ロングトーン強化'), 'X');
    fireEvent.press(getByText('保存'));
    await waitFor(() => {
      expect(upsertSpy).toHaveBeenCalledWith(
        'g1',
        expect.objectContaining({ month: 5, text: 'X' }),
      );
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest __tests__/integration/monthly-milestone-form.integration.test.tsx
```

Expected: import エラーで FAIL。

- [ ] **Step 3: 実装** (`app/monthly-milestone-form.tsx`)

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { NumericInput } from '@/components/form/numeric-input';
import {
  ACHIEVEMENT_LABELS,
  ACHIEVEMENT_VALUES,
  canReviewMilestone,
  monthlyMilestoneSchema,
  type MonthlyMilestoneInput,
} from '@/forms/annual-goal';
import { useAnnualGoalsStore } from '@/store/annual-goal';

export default function MonthlyMilestoneForm() {
  const { goalId, month, id } = useLocalSearchParams<{
    goalId: string;
    month?: string;
    id?: string;
  }>();
  const goals = useAnnualGoalsStore((s) => s.goals);
  const upsertMilestone = useAnnualGoalsStore((s) => s.upsertMilestone);
  const removeMilestone = useAnnualGoalsStore((s) => s.removeMilestone);
  const reviewMilestone = useAnnualGoalsStore((s) => s.reviewMilestone);

  const goal = useMemo(() => goals.find((g) => g.id === goalId), [goals, goalId]);
  const existing = useMemo(
    () => goal?.milestones.find((m) => m.id === id || (id == null && String(m.month) === month)),
    [goal, id, month],
  );
  const isEdit = existing != null;
  const initialMonth = existing?.month ?? Number(month ?? '1');
  const canReview = goal ? canReviewMilestone(goal.year, initialMonth, new Date()) : false;

  const defaultValues: MonthlyMilestoneInput = existing
    ? {
        month: existing.month,
        text: existing.text,
        numericTarget: existing.numericTarget,
        numericUnit: existing.numericUnit,
        reviewText: existing.reviewText,
        achievement: existing.achievement,
      }
    : {
        month: initialMonth,
        text: '',
        numericTarget: null,
        numericUnit: null,
        reviewText: null,
        achievement: null,
      };

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MonthlyMilestoneInput>({
    resolver: zodResolver(monthlyMilestoneSchema),
    mode: 'onTouched',
    defaultValues,
  });

  const achievement = watch('achievement');

  async function onSubmit(values: MonthlyMilestoneInput) {
    if (!goalId) return;
    const upsertResult = await upsertMilestone(goalId, values);
    if (!upsertResult.ok) {
      Alert.alert('保存に失敗しました');
      return;
    }
    if (canReview && values.achievement != null) {
      const milestoneId = upsertResult.milestoneId ?? existing?.id;
      if (milestoneId) {
        const reviewResult = await reviewMilestone(milestoneId, {
          reviewText: values.reviewText ?? null,
          achievement: values.achievement,
        });
        if (!reviewResult.ok) {
          Alert.alert('振り返りの保存に失敗しました');
          return;
        }
      }
    }
    router.back();
  }

  async function onDelete() {
    if (!existing) return;
    Alert.alert('削除しますか？', '', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await removeMilestone(existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{ title: isEdit ? `${initialMonth}月のマイルストーン編集` : 'マイルストーン追加' }}
      />
      <YStack p="$4" gap="$3">
        <Controller
          control={control}
          name="month"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>月 (1-12)</Paragraph>
              <NumericInput
                value={field.value}
                onChange={(v) => field.onChange(v ?? 1)}
                onBlur={field.onBlur}
              />
              <FieldError error={errors.month?.message} />
            </YStack>
          )}
        />
        <Controller
          control={control}
          name="text"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>マイルストーン</Paragraph>
              <Input
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="例: ロングトーン強化"
              />
              <FieldError error={errors.text?.message} />
            </YStack>
          )}
        />
        <Controller
          control={control}
          name="numericTarget"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>数値目標 (任意)</Paragraph>
              <NumericInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            </YStack>
          )}
        />
        <Controller
          control={control}
          name="numericUnit"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>単位 (任意)</Paragraph>
              <Input
                value={field.value ?? ''}
                onChangeText={(v) => field.onChange(v || null)}
                onBlur={field.onBlur}
              />
            </YStack>
          )}
        />
        {canReview && (
          <YStack gap="$2" mt="$2" p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor">
            <Paragraph fontWeight="bold">振り返り</Paragraph>
            <Controller
              control={control}
              name="achievement"
              render={({ field }) => (
                <XStack gap="$2">
                  {ACHIEVEMENT_VALUES.map((v) => (
                    <Button
                      key={v}
                      size="$2"
                      theme={field.value === v ? 'blue' : undefined}
                      onPress={() => field.onChange(field.value === v ? null : v)}
                    >
                      {ACHIEVEMENT_LABELS[v]}
                    </Button>
                  ))}
                </XStack>
              )}
            />
            <Controller
              control={control}
              name="reviewText"
              render={({ field }) => (
                <Input
                  value={field.value ?? ''}
                  onChangeText={(v) => field.onChange(v || null)}
                  onBlur={field.onBlur}
                  placeholder="振り返りコメント"
                  multiline
                  numberOfLines={3}
                />
              )}
            />
          </YStack>
        )}
        <Button onPress={handleSubmit(onSubmit)} disabled={isSubmitting} theme="blue">
          保存
        </Button>
        {isEdit && (
          <Button onPress={onDelete} theme="red">
            削除
          </Button>
        )}
      </YStack>
    </>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest __tests__/integration/monthly-milestone-form.integration.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add app/monthly-milestone-form.tsx __tests__/integration/monthly-milestone-form.integration.test.tsx
git commit -m "feat: 月別マイルストーンフォーム画面を追加"
```

---

### Task 13: `app/annual-goal-detail.tsx`

**Files:**

- Create: `app/annual-goal-detail.tsx`

責務: 年間目標 1 件の詳細表示。12 ヶ月のマイルストーン縦並び + 年末振り返りカード。

- [ ] **Step 1: 実装**

```tsx
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, Pressable } from 'react-native';
import { Button, Paragraph, Theme, XStack, YStack } from 'tamagui';

import { MonthlyMilestoneCard } from '@/components/monthly-milestone-card';
import { ACHIEVEMENT_LABELS, canReviewAnnualGoal } from '@/forms/annual-goal';
import { useAnnualGoalsStore } from '@/store/annual-goal';

export default function AnnualGoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goals = useAnnualGoalsStore((s) => s.goals);
  const fetchAll = useAnnualGoalsStore((s) => s.fetchAll);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const goal = useMemo(() => goals.find((g) => g.id === id), [goals, id]);
  const milestoneByMonth = useMemo(() => {
    const map = new Map<
      number,
      (typeof goal extends undefined ? never : NonNullable<typeof goal>)['milestones'][number]
    >();
    goal?.milestones.forEach((m) => map.set(m.month, m));
    return map;
  }, [goal]);

  if (!goal) {
    return (
      <YStack p="$4">
        <Paragraph>目標が見つかりませんでした。</Paragraph>
      </YStack>
    );
  }

  const yearEndAvailable = canReviewAnnualGoal(goal.year, new Date());

  return (
    <>
      <Stack.Screen
        options={{
          title: `${goal.year}年: ${goal.title}`,
          headerRight: () => (
            <Pressable onPress={() => router.push(`/annual-goal-form?id=${goal.id}`)}>
              <Paragraph color="$blue9" mr="$3">
                編集
              </Paragraph>
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={Array.from({ length: 12 }, (_, i) => i + 1)}
        keyExtractor={(m) => String(m)}
        ListHeaderComponent={
          goal.numericTarget != null ? (
            <Paragraph mx="$3" mt="$2" mb="$3" color="$color10">
              {`年間目標: ${goal.numericTarget}${goal.numericUnit ?? ''}`}
            </Paragraph>
          ) : null
        }
        renderItem={({ item: month }) => {
          const milestone = milestoneByMonth.get(month) ?? null;
          const onPress = () =>
            router.push(
              milestone
                ? `/monthly-milestone-form?goalId=${goal.id}&id=${milestone.id}`
                : `/monthly-milestone-form?goalId=${goal.id}&month=${month}`,
            );
          return <MonthlyMilestoneCard month={month} milestone={milestone} onPress={onPress} />;
        }}
        ListFooterComponent={
          <YStack
            mx="$3"
            mt="$3"
            mb="$8"
            p="$3"
            bg="$color1"
            rounded="$3"
            borderWidth={1}
            borderColor="$borderColor"
            gap="$2"
          >
            <Paragraph fontWeight="bold">年末振り返り</Paragraph>
            {goal.yearEndAchievement ? (
              <Theme
                name={
                  goal.yearEndAchievement === 'achieved'
                    ? 'green'
                    : goal.yearEndAchievement === 'partial'
                      ? 'yellow'
                      : 'red'
                }
              >
                <Paragraph fontSize="$2" color="$color11" bg="$color3" px="$2" py="$1" rounded="$2">
                  {ACHIEVEMENT_LABELS[goal.yearEndAchievement]}
                </Paragraph>
              </Theme>
            ) : (
              <Paragraph fontSize="$2" color="$color9">
                {yearEndAvailable ? '未記入' : '12月最終週から記入できます'}
              </Paragraph>
            )}
            {goal.yearEndReviewText ? (
              <Paragraph fontSize="$2">{goal.yearEndReviewText}</Paragraph>
            ) : null}
            {yearEndAvailable && (
              <Button
                size="$2"
                onPress={() => router.push(`/year-end-review-form?goalId=${goal.id}`)}
                theme="blue"
              >
                記入する
              </Button>
            )}
          </YStack>
        }
      />
    </>
  );
}
```

注: 年末振り返り画面は本プランで作らない。`canReviewAnnualGoal` が true の場合のみボタンを表示し、リンク先のルートだけ用意する形でひとまず留める。実装は別タスクで追加することにし、現状はボタン押下時の `router.push` でフォーム未存在のため遷移しない (Stack.Screen が無いため何も起こらない)。

→ **代替案**: ボタンの代わりに `Alert.alert('近日対応')` 表示でも良い。次の Step で書き換える:

```tsx
{
  yearEndAvailable && (
    <Button
      size="$2"
      onPress={() => router.push(`/monthly-milestone-form?goalId=${goal.id}&month=12&yearEnd=1`)}
      theme="blue"
    >
      12月マイルストーンを編集
    </Button>
  );
}
```

(注: 年末振り返り専用フォームはスコープ外。12月マイルストーンの振り返りで代用する形にしてシンプルに保つ)

→ Task 13 ではこの方針 (12月マイルストーンへの誘導) を採用する。年末振り返り欄 (`yearEndReview` ストアアクション + UI) の本格対応はフォローアップ。

- [ ] **Step 2: 上記方針に沿って実装をシンプル化** (上のコード例から `年末振り返り` カードのボタン部分を「12月マイルストーンを編集」に修正済の状態でファイルを作成)

- [ ] **Step 3: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー 0。

- [ ] **Step 4: コミット**

```bash
git add app/annual-goal-detail.tsx
git commit -m "feat: 年間目標詳細画面 (12ヶ月マイルストーン一覧) を追加"
```

注: `yearEndReview` ストアアクションは Task 8 で実装済だが、専用 UI は本プランの範囲外。フォローアップで `app/year-end-review-form.tsx` を追加する場合の足場は `useAnnualGoalsStore.yearEndReview()` を呼ぶだけ。

---

### Task 14: `app/(tabs)/annual-goals.tsx` + タブ登録

**Files:**

- Create: `app/(tabs)/annual-goals.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: タブ画面を実装** (`app/(tabs)/annual-goals.tsx`)

```tsx
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { AnnualGoalCard } from '@/components/annual-goal-card';
import { useAnnualGoalsStore } from '@/store/annual-goal';

export default function AnnualGoalsScreen() {
  const goals = useAnnualGoalsStore((s) => s.goals);
  const loading = useAnnualGoalsStore((s) => s.loading);
  const fetchAll = useAnnualGoalsStore((s) => s.fetchAll);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const yearGoals = useMemo(
    () => goals.filter((g) => g.year === selectedYear),
    [goals, selectedYear],
  );

  return (
    <>
      <Stack.Screen options={{ title: '年間目標' }} />
      <FlatList
        data={yearGoals}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={
          <YStack>
            <XStack justify="space-between" items="center" px="$4" pt="$3" pb="$2">
              <Pressable onPress={() => setSelectedYear((y) => y - 1)} aria-label="前年へ">
                <Paragraph color="$blue9" fontSize="$5">
                  ＜
                </Paragraph>
              </Pressable>
              <Paragraph fontWeight="bold">{`${selectedYear}年`}</Paragraph>
              <Pressable onPress={() => setSelectedYear((y) => y + 1)} aria-label="翌年へ">
                <Paragraph color="$blue9" fontSize="$5">
                  ＞
                </Paragraph>
              </Pressable>
            </XStack>
            <Pressable
              onPress={() => router.push('/annual-goal-form')}
              style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 4 }}
            >
              <Paragraph color="$blue9" fontSize="$2">
                ＋ 新規作成
              </Paragraph>
            </Pressable>
          </YStack>
        }
        ListEmptyComponent={
          !loading ? (
            <Paragraph text="center" color="$color10" mt="$8">
              {`${selectedYear}年の目標がありません`}
            </Paragraph>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/annual-goal-detail?id=${item.id}`)}>
            <AnnualGoalCard goal={item} />
          </Pressable>
        )}
      />
    </>
  );
}
```

- [ ] **Step 2: タブを登録** (`app/(tabs)/_layout.tsx` を編集)

`purchase-plan` の `<Tabs.Screen>` の直後に以下を追加:

```tsx
<Tabs.Screen
  name="annual-goals"
  options={{
    title: '年間目標',
    tabBarIcon: ({ color, size }) => <Ionicons name="flag-outline" size={size} color={color} />,
  }}
/>
```

- [ ] **Step 3: TypeScript + lint チェック**

```bash
npx tsc --noEmit && npm run lint
```

Expected: エラー 0。

- [ ] **Step 4: コミット**

```bash
git add app/(tabs)/annual-goals.tsx app/(tabs)/_layout.tsx
git commit -m "feat: 年間目標タブを追加"
```

---

### Task 15: ホーム上部「今月のマイルストーン」カード

**Files:**

- Create: `components/this-month-milestones-card.tsx`
- Create: `__tests__/integration/this-month-milestones.integration.test.tsx`
- Modify: `app/(tabs)/index.tsx` (上部にカードを挿入)

- [ ] **Step 1: 失敗する integration テストを書く**

```tsx
import { renderWithProviders } from '@/test-utils/render';
import { ThisMonthMilestonesCard } from '@/components/this-month-milestones-card';
import { useAnnualGoalsStore } from '@/store/annual-goal';

describe('ThisMonthMilestonesCard', () => {
  beforeEach(() => {
    useAnnualGoalsStore.setState({ goals: [], loading: false } as never);
  });

  it('当月のマイルストーン 0 件: 何も表示しない', () => {
    const { toJSON } = renderWithProviders(<ThisMonthMilestonesCard />);
    expect(toJSON()).toBeNull();
  });

  it('当月のマイルストーンがあるとき: タイトルと本文が表示される', () => {
    const now = new Date();
    useAnnualGoalsStore.setState({
      goals: [
        {
          id: 'g1',
          year: now.getFullYear(),
          title: '音色を磨く',
          numericTarget: null,
          numericUnit: null,
          yearEndReviewText: null,
          yearEndAchievement: null,
          yearEndReviewedAt: null,
          milestones: [
            {
              id: 'm1',
              month: now.getMonth() + 1,
              text: 'ロングトーン',
              numericTarget: null,
              numericUnit: null,
              reviewText: null,
              achievement: null,
              reviewedAt: null,
            },
          ],
        },
      ],
    } as never);
    const { getByText } = renderWithProviders(<ThisMonthMilestonesCard />);
    expect(getByText('音色を磨く')).toBeOnTheScreen();
    expect(getByText('ロングトーン')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npx jest __tests__/integration/this-month-milestones.integration.test.tsx
```

Expected: import エラーで FAIL。

- [ ] **Step 3: コンポーネント実装** (`components/this-month-milestones-card.tsx`)

```tsx
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Paragraph, Theme, XStack, YStack } from 'tamagui';

import { ACHIEVEMENT_LABELS, canReviewMilestone } from '@/forms/annual-goal';
import { useAnnualGoalsStore } from '@/store/annual-goal';

const THEME_BY_ACHIEVEMENT = {
  achieved: 'green',
  partial: 'yellow',
  unachieved: 'red',
} as const;

export function ThisMonthMilestonesCard() {
  const goals = useAnnualGoalsStore((s) => s.goals);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const rows = goals
    .filter((g) => g.year === year)
    .flatMap((g) => {
      const milestone = g.milestones.find((m) => m.month === month);
      return milestone ? [{ goal: g, milestone }] : [];
    });

  if (rows.length === 0) return null;

  const canReview = canReviewMilestone(year, month, now);

  return (
    <YStack
      mx="$3"
      mt="$3"
      p="$3"
      bg="$color1"
      rounded="$3"
      borderWidth={1}
      borderColor="$borderColor"
      gap="$2"
    >
      <Paragraph fontWeight="bold">今月のマイルストーン</Paragraph>
      {rows.map(({ goal, milestone }) => (
        <Pressable
          key={milestone.id}
          onPress={() =>
            router.push(`/monthly-milestone-form?goalId=${goal.id}&id=${milestone.id}`)
          }
        >
          <YStack
            p="$2"
            bg="$color2"
            rounded="$2"
            borderWidth={1}
            borderColor="$borderColor"
            gap="$1"
          >
            <XStack justify="space-between" items="baseline">
              <Paragraph fontSize="$2" color="$color10">
                {goal.title}
              </Paragraph>
              {milestone.achievement != null && (
                <Theme name={THEME_BY_ACHIEVEMENT[milestone.achievement]}>
                  <Paragraph
                    fontSize="$1"
                    color="$color11"
                    bg="$color3"
                    px="$2"
                    py="$1"
                    rounded="$2"
                  >
                    {ACHIEVEMENT_LABELS[milestone.achievement]}
                  </Paragraph>
                </Theme>
              )}
            </XStack>
            <Paragraph fontSize="$3">{milestone.text}</Paragraph>
            {milestone.numericTarget != null && (
              <Paragraph fontSize="$2" color="$color10">
                {`目標: ${milestone.numericTarget}${milestone.numericUnit ?? ''}`}
              </Paragraph>
            )}
            {canReview && milestone.achievement == null && (
              <Paragraph fontSize="$2" color="$blue9">
                振り返る ＞
              </Paragraph>
            )}
          </YStack>
        </Pressable>
      ))}
    </YStack>
  );
}
```

- [ ] **Step 4: ホームに組み込む** (`app/(tabs)/index.tsx`)

`useFocusEffect` 内に `useAnnualGoalsStore.getState().fetchAll()` を追加し、`ListHeaderComponent` の `<YStack>` 内最上部に `<ThisMonthMilestonesCard />` を配置する。

```tsx
// 上部の import に追加
import { ThisMonthMilestonesCard } from '@/components/this-month-milestones-card';
import { useAnnualGoalsStore } from '@/store/annual-goal';

// useFocusEffect 内
useFocusEffect(
  useCallback(() => {
    fetchAll();
    useAnnualGoalsStore.getState().fetchAll();
  }, [fetchAll]),
);

// ListHeaderComponent の YStack 直下の最初の子として:
<YStack>
  <ThisMonthMilestonesCard />
  <XStack ...>
    {/* 既存の月セレクター */}
  </XStack>
  ...
</YStack>
```

- [ ] **Step 5: テストが通ることを確認**

```bash
npx jest __tests__/integration/this-month-milestones.integration.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 6: コミット**

```bash
git add components/this-month-milestones-card.tsx __tests__/integration/this-month-milestones.integration.test.tsx app/(tabs)/index.tsx
git commit -m "feat: ホーム上部に今月のマイルストーンカードを追加"
```

---

### Task 16: 月別サマリーを「合計」→「平均: XXX分/日」に変更

**Files:**

- Modify: `app/(tabs)/index.tsx` (行 80-85 周辺)

- [ ] **Step 1: 該当箇所を編集**

`app/(tabs)/index.tsx` の `Paragraph fontSize="$2" color="$color10"` 内の IIFE を以下に置換:

```tsx
<Paragraph fontSize="$2" color="$color10">
  {(() => {
    const total = monthTotals.basic + monthTotals.nonBasic;
    // total > 0 は monthSessions.length > 0 を含意するため除算は安全
    const avg = total > 0 ? Math.round(total / monthSessions.length) : 0;
    return total > 0
      ? `${monthSessions.length}回 / 平均: ${avg}分/日`
      : `${monthSessions.length}回 / 練習時間未記録`;
  })()}
</Paragraph>
```

- [ ] **Step 2: 動作確認**

期待表示:

- 5 セッション × 60 分 / 月 → `5回 / 平均: 60分/日`
- 4 セッション (合計 80 分) / 月 → `4回 / 平均: 20分/日`
- 0 セッション / 月 → `0回 / 練習時間未記録`

ユニットテストを追加する場合は既存 `practice-chart.test.ts` ではなく、純粋関数として切り出して別ファイルで検証する手もあるが、IIFE 内の小規模ロジックのため割愛して可。

- [ ] **Step 3: コミット**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: 月別サマリーを「合計」から「平均: XXX分/日」表示に変更"
```

---

### Task 17: 最終品質チェック

**Files:** なし (検証のみ)

- [ ] **Step 1: 4 ステップ品質チェックを順に実行**

```bash
npm run lint
```

Expected: エラー 0。エラーがあれば `npm run lint:fix` で自動修正後に再実行。

```bash
npm run format:check
```

Expected: 差分 0。差分があれば `npm run format` で適用後に再実行。

```bash
npx tsc --noEmit
```

Expected: 型エラー 0。

```bash
npm test
```

Expected: 全テスト PASS。

- [ ] **Step 2: もし変更が発生した場合は追加コミット**

```bash
git status
# 変更があれば
git add -p
git commit -m "fix: lint / format / 型 を修正"
```

- [ ] **Step 3: 完了**

`git log --oneline | head -20` で実装期間中のコミットを目視確認。

---

## Self-Review メモ (プラン作成者用)

- **Spec coverage:**
  - データモデル (annual_goals + monthly_milestones + RLS) → Task 1
  - zod スキーマ + ヘルパー → Tasks 2-4
  - ストア + アクション → Tasks 5-8
  - カードコンポーネント → Tasks 9, 10
  - フォーム画面 → Tasks 11, 12
  - 詳細画面 → Task 13
  - タブ + 年セレクター → Task 14
  - ホームの今月マイルストーン → Task 15
  - 月別「平均」化 → Task 16
  - 品質チェック → Task 17
- **年末振り返り専用画面はスコープ外**: Task 13 のメモ通り、Spec で言及した「年末振り返り入力」は `useAnnualGoalsStore.yearEndReview()` アクションのみ実装し、UI は 12 月マイルストーンへ誘導する形で代用。専用フォーム (`app/year-end-review-form.tsx`) はフォローアップ。
- **型一貫性**: `Milestone` / `AnnualGoal` / `Achievement` / `MutationResult` を Task 5 で確定し、以降のタスクで再利用する。
- **placeholder スキャン**: TODO/TBD 残存なし。Task 13 の「→ 代替案」セクションは実装方針を明示しているため OK。

## Verification (実装完了後)

1. `npm run lint && npm run format:check && npx tsc --noEmit && npm test` がすべて成功
2. `supabase db reset` でマイグレーションが適用できる (またはリモート Supabase に適用済)
3. アプリ起動 → 年間目標タブで新規作成 → 月マイルストーン追加 → ホームから振り返り → 達成バッジ表示
4. 月別サマリーが「平均: XXX分/日」表示になる
