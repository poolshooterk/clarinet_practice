# 購入計画 Supabase 移行 & 月次貯蓄実績ログ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 購入計画を AsyncStorage から Supabase に移行し、月次貯蓄実績を累積登録・表示できるようにする。

**Architecture:** `purchase_plans`（1ユーザー1行）と `purchase_plan_savings`（月次実績、複数行可）の2テーブルを新設。既存の AsyncStorage persist ストアを Supabase CRUD ストアに全面置き換え。UI は3カード構成（計画・進捗・実績ログ）のスクロール画面に刷新し、実績の追加/編集/削除は別スタック画面で行う。

**Tech Stack:** Supabase (PostgreSQL + RLS)、Zustand v5、React Hook Form + zod、Tamagui、expo-router v6

---

## ファイル構成

| 操作     | ファイル                                                        | 内容                             |
| -------- | --------------------------------------------------------------- | -------------------------------- |
| 新規     | `supabase/migrations/20260523000000_add_purchase_plans.sql`     | 2テーブル + RLS                  |
| 更新     | `forms/purchase-plan.ts`                                        | schema 更新 + savingsSchema 追加 |
| 更新     | `forms/__tests__/purchase-plan.test.ts`                         | schema 更新分のテスト書き直し    |
| 全面置換 | `store/purchase-plan.ts`                                        | AsyncStorage → Supabase CRUD     |
| 全面置換 | `store/__tests__/purchase-plan.test.ts`                         | 新ストアのユニットテスト         |
| 新規     | `app/purchase-plan-savings-form.tsx`                            | 実績追加/編集スタック画面        |
| 全面置換 | `components/purchase-plan-form.tsx`                             | 3カード構成 UI                   |
| 全面置換 | `__tests__/integration/purchase-plan-form.integration.test.tsx` | 新 UI の統合テスト               |

---

## Task 1: DB マイグレーションを作成・適用

**Files:**

- Create: `supabase/migrations/20260523000000_add_purchase_plans.sql`

- [ ] **Step 1: マイグレーション SQL を作成する**

```sql
-- supabase/migrations/20260523000000_add_purchase_plans.sql

create table purchase_plans (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users(id) on delete cascade,
  maker_id               text not null,
  maker_name             text not null,
  model_id               text not null,
  model_name             text not null,
  target_price           integer not null check (target_price > 0),
  monthly_savings_target integer not null check (monthly_savings_target > 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table purchase_plans enable row level security;

create policy "purchase_plans select" on purchase_plans
  for select using (auth.uid() = user_id);
create policy "purchase_plans insert" on purchase_plans
  for insert with check (auth.uid() = user_id);
create policy "purchase_plans update" on purchase_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "purchase_plans delete" on purchase_plans
  for delete using (auth.uid() = user_id);

create table purchase_plan_savings (
  id                uuid primary key default gen_random_uuid(),
  purchase_plan_id  uuid not null references purchase_plans(id) on delete cascade,
  year_month        text not null,
  amount            integer not null check (amount > 0),
  memo              text,
  created_at        timestamptz not null default now()
);

alter table purchase_plan_savings enable row level security;

create policy "purchase_plan_savings select" on purchase_plan_savings
  for select using (
    exists (select 1 from purchase_plans where id = purchase_plan_id and user_id = auth.uid())
  );
create policy "purchase_plan_savings insert" on purchase_plan_savings
  for insert with check (
    exists (select 1 from purchase_plans where id = purchase_plan_id and user_id = auth.uid())
  );
create policy "purchase_plan_savings update" on purchase_plan_savings
  for update
  using (exists (select 1 from purchase_plans where id = purchase_plan_id and user_id = auth.uid()))
  with check (exists (select 1 from purchase_plans where id = purchase_plan_id and user_id = auth.uid()));
create policy "purchase_plan_savings delete" on purchase_plan_savings
  for delete using (
    exists (select 1 from purchase_plans where id = purchase_plan_id and user_id = auth.uid())
  );
```

- [ ] **Step 2: マイグレーションを Supabase に適用する**

`mcp__supabase__apply_migration` ツールを使って適用する。name: `add_purchase_plans`、SQL は上記の内容。

- [ ] **Step 3: テーブルが作成されたことを確認する**

`mcp__supabase__list_tables` で `purchase_plans` と `purchase_plan_savings` が表示されることを確認。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260523000000_add_purchase_plans.sql
git commit -m "feat: purchase_plans / purchase_plan_savings テーブルを追加"
```

---

## Task 2: forms/purchase-plan.ts を更新（TDD）

**Files:**

- Modify: `forms/__tests__/purchase-plan.test.ts`
- Modify: `forms/purchase-plan.ts`

- [ ] **Step 1: 失敗するテストを書く**

`forms/__tests__/purchase-plan.test.ts` を以下の内容で全面置換する。

```ts
import {
  calcPurchaseDate,
  purchasePlanSavingsSchema,
  purchasePlanSchema,
} from '@/forms/purchase-plan';

describe('calcPurchaseDate', () => {
  it('monthlyTarget が 0 以下のとき null を返す', () => {
    expect(calcPurchaseDate(850000, 200000, 0)).toBeNull();
    expect(calcPurchaseDate(850000, 200000, -1000)).toBeNull();
  });

  it('残額が 0 以下のとき months: 0 / yearMonth: "今すぐ購入可能" を返す', () => {
    const result = calcPurchaseDate(200000, 200000, 30000);
    expect(result).not.toBeNull();
    expect(result!.months).toBe(0);
    expect(result!.yearMonth).toBe('今すぐ購入可能');

    const overpaid = calcPurchaseDate(200000, 300000, 30000);
    expect(overpaid!.months).toBe(0);
  });

  it('通常ケース: 残額 650000 / 月 30000 → 22 ヶ月', () => {
    const result = calcPurchaseDate(850000, 200000, 30000);
    expect(result).not.toBeNull();
    expect(result!.months).toBe(22);
  });

  it('yearMonth の形式が "YYYY年M月ごろ" である', () => {
    const result = calcPurchaseDate(850000, 200000, 30000);
    expect(result!.yearMonth).toMatch(/^\d{4}年\d{1,2}月ごろ$/);
  });

  it('ちょうど割り切れる場合は ceil で同じ値になる', () => {
    const result = calcPurchaseDate(260000, 200000, 30000);
    expect(result!.months).toBe(2);
  });
});

describe('purchasePlanSchema', () => {
  const valid = {
    makerId: 'maker-1',
    makerName: 'Buffet Crampon',
    modelId: 'model-1',
    modelName: 'R13',
    targetPrice: 850000,
    monthlyTarget: 30000,
  };

  it('有効なデータを受け入れる', () => {
    expect(purchasePlanSchema.safeParse(valid).success).toBe(true);
  });

  it('makerId が空文字列のとき拒否する', () => {
    expect(purchasePlanSchema.safeParse({ ...valid, makerId: '' }).success).toBe(false);
  });

  it('targetPrice が 0 以下のとき拒否する', () => {
    expect(purchasePlanSchema.safeParse({ ...valid, targetPrice: 0 }).success).toBe(false);
  });

  it('targetPrice が null のとき拒否する', () => {
    expect(purchasePlanSchema.safeParse({ ...valid, targetPrice: null }).success).toBe(false);
  });

  it('monthlyTarget が 0 以下のとき拒否する', () => {
    expect(purchasePlanSchema.safeParse({ ...valid, monthlyTarget: 0 }).success).toBe(false);
  });

  it('monthlyTarget が null のとき拒否する', () => {
    expect(purchasePlanSchema.safeParse({ ...valid, monthlyTarget: null }).success).toBe(false);
  });
});

describe('purchasePlanSavingsSchema', () => {
  const valid = { yearMonth: '2026-05', amount: 30000, memo: null };

  it('有効なデータを受け入れる', () => {
    expect(purchasePlanSavingsSchema.safeParse(valid).success).toBe(true);
  });

  it('メモありでも有効', () => {
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, memo: 'ボーナス分' }).success).toBe(
      true,
    );
  });

  it('yearMonth が YYYY-MM 形式でないとき拒否する', () => {
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, yearMonth: '2026/05' }).success).toBe(
      false,
    );
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, yearMonth: '202605' }).success).toBe(
      false,
    );
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, yearMonth: '2026-5' }).success).toBe(
      false,
    );
  });

  it('amount が 0 以下のとき拒否する', () => {
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, amount: -1 }).success).toBe(false);
  });

  it('amount が整数でないとき拒否する', () => {
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, amount: 30000.5 }).success).toBe(false);
  });

  it('amount が null のとき拒否する', () => {
    expect(purchasePlanSavingsSchema.safeParse({ ...valid, amount: null }).success).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest forms/__tests__/purchase-plan.test.ts
```

期待: `purchasePlanSchema` に `monthlyTarget` がないため FAIL する。

- [ ] **Step 3: forms/purchase-plan.ts を実装する**

```ts
import { z } from 'zod';

export const purchasePlanSchema = z.object({
  makerId: z.string().min(1, 'メーカーを選択してください'),
  makerName: z.string().min(1),
  modelId: z.string().min(1, '機種名を選択してください'),
  modelName: z.string().min(1),
  targetPrice: z
    .number({ invalid_type_error: '正の値を入力してください' })
    .positive('正の値を入力してください')
    .nullable()
    .refine((v): v is number => v !== null, { message: '正の値を入力してください' }),
  monthlyTarget: z
    .number({ invalid_type_error: '正の値を入力してください' })
    .positive('正の値を入力してください')
    .nullable()
    .refine((v): v is number => v !== null, { message: '正の値を入力してください' }),
});

export const purchasePlanSavingsSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM 形式で入力してください'),
  amount: z
    .number({ invalid_type_error: '金額を入力してください' })
    .int()
    .positive('正の値を入力してください')
    .nullable()
    .refine((v): v is number => v !== null, { message: '金額を入力してください' }),
  memo: z.string().nullable(),
});

export type PurchasePlan = z.infer<typeof purchasePlanSchema>;
export type PurchasePlanSavingsInput = z.infer<typeof purchasePlanSavingsSchema>;

export function calcPurchaseDate(
  targetPrice: number,
  currentSavings: number,
  monthlyTarget: number,
): { months: number; yearMonth: string } | null {
  if (monthlyTarget <= 0) return null;
  const remaining = targetPrice - currentSavings;
  if (remaining <= 0) return { months: 0, yearMonth: '今すぐ購入可能' };
  const months = Math.ceil(remaining / monthlyTarget);
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return { months, yearMonth: `${y}年${m}月ごろ` };
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest forms/__tests__/purchase-plan.test.ts
```

期待: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add forms/purchase-plan.ts forms/__tests__/purchase-plan.test.ts
git commit -m "feat: purchasePlanSchema から currentSavings を削除し monthlyTarget にリネーム、purchasePlanSavingsSchema を追加"
```

---

## Task 3: store/purchase-plan.ts を全面置き換え（TDD）

**Files:**

- Modify: `store/__tests__/purchase-plan.test.ts`
- Modify: `store/purchase-plan.ts`

- [ ] **Step 1: 失敗するテストを書く**

`store/__tests__/purchase-plan.test.ts` を以下の内容で全面置換する。

```ts
import { usePurchasePlanStore } from '@/store/purchase-plan';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const mockFrom = () => jest.requireMock('@/lib/supabase').supabase.from as jest.Mock;
const mockGetUser = () => jest.requireMock('@/lib/supabase').supabase.auth.getUser as jest.Mock;

describe('usePurchasePlanStore', () => {
  beforeEach(() => {
    usePurchasePlanStore.setState({ plan: null, savings: [], loading: false });
    jest.clearAllMocks();
    mockGetUser().mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('初期状態: plan は null、savings は空配列', () => {
    const { plan, savings } = usePurchasePlanStore.getState();
    expect(plan).toBeNull();
    expect(savings).toEqual([]);
  });

  it('fetchAll: plan と savings がセットされる', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'plan-1',
            maker_id: 'maker-1',
            maker_name: 'Buffet Crampon',
            model_id: 'model-1',
            model_name: 'R13',
            target_price: 850000,
            monthly_savings_target: 30000,
            purchase_plan_savings: [
              { id: 'sav-1', year_month: '2026-05', amount: 30000, memo: null },
            ],
          },
        ],
        error: null,
      }),
    });
    await usePurchasePlanStore.getState().fetchAll();
    const { plan, savings } = usePurchasePlanStore.getState();
    expect(plan).not.toBeNull();
    expect(plan!.id).toBe('plan-1');
    expect(plan!.targetPrice).toBe(850000);
    expect(plan!.monthlyTarget).toBe(30000);
    expect(savings).toHaveLength(1);
    expect(savings[0].amount).toBe(30000);
    expect(savings[0].yearMonth).toBe('2026-05');
  });

  it('fetchAll: データなしのとき plan は null のまま', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    await usePurchasePlanStore.getState().fetchAll();
    expect(usePurchasePlanStore.getState().plan).toBeNull();
  });

  it('fetchAll: ユーザー未認証のとき何もしない', async () => {
    mockGetUser().mockResolvedValue({ data: { user: null } });
    await usePurchasePlanStore.getState().fetchAll();
    expect(mockFrom()).not.toHaveBeenCalled();
  });

  it('upsertPlan: plan がストアに追加される', async () => {
    mockFrom().mockReturnValueOnce({
      upsert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'plan-1',
          maker_id: 'maker-1',
          maker_name: 'Buffet Crampon',
          model_id: 'model-1',
          model_name: 'R13',
          target_price: 850000,
          monthly_savings_target: 30000,
        },
        error: null,
      }),
    });
    await usePurchasePlanStore.getState().upsertPlan({
      makerId: 'maker-1',
      makerName: 'Buffet Crampon',
      modelId: 'model-1',
      modelName: 'R13',
      targetPrice: 850000,
      monthlyTarget: 30000,
    });
    const { plan } = usePurchasePlanStore.getState();
    expect(plan).not.toBeNull();
    expect(plan!.id).toBe('plan-1');
    expect(plan!.monthlyTarget).toBe(30000);
  });

  it('addSaving: savings にエントリが追加される', async () => {
    usePurchasePlanStore.setState({
      plan: {
        id: 'plan-1',
        makerId: 'maker-1',
        makerName: 'BC',
        modelId: 'm-1',
        modelName: 'R13',
        targetPrice: 850000,
        monthlyTarget: 30000,
      },
      savings: [],
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'sav-1', year_month: '2026-05', amount: 30000, memo: null },
        error: null,
      }),
    });
    await usePurchasePlanStore
      .getState()
      .addSaving('plan-1', { yearMonth: '2026-05', amount: 30000, memo: null });
    const { savings } = usePurchasePlanStore.getState();
    expect(savings).toHaveLength(1);
    expect(savings[0].id).toBe('sav-1');
    expect(savings[0].amount).toBe(30000);
  });

  it('updateSaving: 既存エントリが更新される', async () => {
    usePurchasePlanStore.setState({
      plan: {
        id: 'plan-1',
        makerId: 'maker-1',
        makerName: 'BC',
        modelId: 'm-1',
        modelName: 'R13',
        targetPrice: 850000,
        monthlyTarget: 30000,
      },
      savings: [{ id: 'sav-1', yearMonth: '2026-05', amount: 30000, memo: null }],
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    await usePurchasePlanStore
      .getState()
      .updateSaving('sav-1', { yearMonth: '2026-05', amount: 60000, memo: 'ボーナス' });
    const { savings } = usePurchasePlanStore.getState();
    expect(savings[0].amount).toBe(60000);
    expect(savings[0].memo).toBe('ボーナス');
  });

  it('removeSaving: 対象エントリが削除される', async () => {
    usePurchasePlanStore.setState({
      plan: {
        id: 'plan-1',
        makerId: 'maker-1',
        makerName: 'BC',
        modelId: 'm-1',
        modelName: 'R13',
        targetPrice: 850000,
        monthlyTarget: 30000,
      },
      savings: [
        { id: 'sav-1', yearMonth: '2026-05', amount: 30000, memo: null },
        { id: 'sav-2', yearMonth: '2026-04', amount: 20000, memo: null },
      ],
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    await usePurchasePlanStore.getState().removeSaving('sav-1');
    const { savings } = usePurchasePlanStore.getState();
    expect(savings).toHaveLength(1);
    expect(savings[0].id).toBe('sav-2');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest store/__tests__/purchase-plan.test.ts
```

期待: `fetchAll` / `upsertPlan` 等が存在しないため FAIL する。

- [ ] **Step 3: store/purchase-plan.ts を実装する**

```ts
import { create } from 'zustand';

import type { PurchasePlan, PurchasePlanSavingsInput } from '@/forms/purchase-plan';
import { supabase } from '@/lib/supabase';

export type SavingsEntry = {
  id: string;
  yearMonth: string;
  amount: number;
  memo: string | null;
};

export type PurchasePlanRecord = {
  id: string;
  makerId: string;
  makerName: string;
  modelId: string;
  modelName: string;
  targetPrice: number;
  monthlyTarget: number;
};

type PurchasePlanRow = {
  id: string;
  maker_id: string;
  maker_name: string;
  model_id: string;
  model_name: string;
  target_price: number;
  monthly_savings_target: number;
  purchase_plan_savings: { id: string; year_month: string; amount: number; memo: string | null }[];
};

type PurchasePlanState = {
  plan: PurchasePlanRecord | null;
  savings: SavingsEntry[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  upsertPlan: (input: PurchasePlan) => Promise<void>;
  addSaving: (planId: string, input: PurchasePlanSavingsInput) => Promise<void>;
  updateSaving: (id: string, input: PurchasePlanSavingsInput) => Promise<void>;
  removeSaving: (id: string) => Promise<void>;
};

export const usePurchasePlanStore = create<PurchasePlanState>()((set, get) => ({
  plan: null,
  savings: [],
  loading: false,

  fetchAll: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    set({ loading: true });
    const { data, error } = await supabase
      .from('purchase_plans')
      .select(
        'id, maker_id, maker_name, model_id, model_name, target_price, monthly_savings_target, ' +
          'purchase_plan_savings ( id, year_month, amount, memo )',
      );
    set({ loading: false });

    if (error || !data || data.length === 0) {
      set({ plan: null, savings: [] });
      return;
    }

    const row = (data as unknown as PurchasePlanRow[])[0];
    set({
      plan: {
        id: row.id,
        makerId: row.maker_id,
        makerName: row.maker_name,
        modelId: row.model_id,
        modelName: row.model_name,
        targetPrice: row.target_price,
        monthlyTarget: row.monthly_savings_target,
      },
      savings: (row.purchase_plan_savings ?? []).map((s) => ({
        id: s.id,
        yearMonth: s.year_month,
        amount: s.amount,
        memo: s.memo,
      })),
    });
  },

  upsertPlan: async (input: PurchasePlan) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data, error } = await supabase
      .from('purchase_plans')
      .upsert(
        {
          user_id: userData.user.id,
          maker_id: input.makerId,
          maker_name: input.makerName,
          model_id: input.modelId,
          model_name: input.modelName,
          target_price: input.targetPrice,
          monthly_savings_target: input.monthlyTarget,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select(
        'id, maker_id, maker_name, model_id, model_name, target_price, monthly_savings_target',
      )
      .single();

    if (error || !data) return;

    const row = data as unknown as Omit<PurchasePlanRow, 'purchase_plan_savings'>;
    set({
      plan: {
        id: row.id,
        makerId: row.maker_id,
        makerName: row.maker_name,
        modelId: row.model_id,
        modelName: row.model_name,
        targetPrice: row.target_price,
        monthlyTarget: row.monthly_savings_target,
      },
    });
  },

  addSaving: async (planId: string, input: PurchasePlanSavingsInput) => {
    const { data, error } = await supabase
      .from('purchase_plan_savings')
      .insert({
        purchase_plan_id: planId,
        year_month: input.yearMonth,
        amount: input.amount,
        memo: input.memo || null,
      })
      .select('id, year_month, amount, memo')
      .single();

    if (error || !data) return;

    const row = data as { id: string; year_month: string; amount: number; memo: string | null };
    set({
      savings: [
        { id: row.id, yearMonth: row.year_month, amount: row.amount, memo: row.memo },
        ...get().savings,
      ],
    });
  },

  updateSaving: async (id: string, input: PurchasePlanSavingsInput) => {
    const { error } = await supabase
      .from('purchase_plan_savings')
      .update({
        year_month: input.yearMonth,
        amount: input.amount,
        memo: input.memo || null,
      })
      .eq('id', id);

    if (error) return;

    set({
      savings: get().savings.map((s) =>
        s.id === id
          ? { ...s, yearMonth: input.yearMonth, amount: input.amount, memo: input.memo || null }
          : s,
      ),
    });
  },

  removeSaving: async (id: string) => {
    const { error } = await supabase.from('purchase_plan_savings').delete().eq('id', id);
    if (error) return;
    set({ savings: get().savings.filter((s) => s.id !== id) });
  },
}));
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest store/__tests__/purchase-plan.test.ts
```

期待: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add store/purchase-plan.ts store/__tests__/purchase-plan.test.ts
git commit -m "feat: purchase-plan ストアを Supabase CRUD に全面置き換え"
```

---

## Task 4: app/purchase-plan-savings-form.tsx を新規作成

**Files:**

- Create: `app/purchase-plan-savings-form.tsx`

- [ ] **Step 1: ファイルを作成する**

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, ScrollView } from 'react-native';
import { Button, Input, Paragraph, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { NumericInput } from '@/components/form/numeric-input';
import { type PurchasePlanSavingsInput, purchasePlanSavingsSchema } from '@/forms/purchase-plan';
import { usePurchasePlanStore } from '@/store/purchase-plan';

function currentYearMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default function PurchasePlanSavingsFormScreen() {
  const { planId, id: entryId } = useLocalSearchParams<{ planId: string; id?: string }>();

  const savings = usePurchasePlanStore((s) => s.savings);
  const addSaving = usePurchasePlanStore((s) => s.addSaving);
  const updateSaving = usePurchasePlanStore((s) => s.updateSaving);
  const removeSaving = usePurchasePlanStore((s) => s.removeSaving);
  const fetchAll = usePurchasePlanStore((s) => s.fetchAll);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const isEdit = Boolean(entryId);
  const existing = entryId ? savings.find((s) => s.id === entryId) : undefined;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PurchasePlanSavingsInput>({
    resolver: zodResolver(purchasePlanSavingsSchema),
    mode: 'onTouched',
    defaultValues: {
      yearMonth: existing?.yearMonth ?? currentYearMonth(),
      amount: existing?.amount ?? null,
      memo: existing?.memo ?? null,
    },
  });

  useEffect(() => {
    if (existing) {
      reset({
        yearMonth: existing.yearMonth,
        amount: existing.amount,
        memo: existing.memo,
      });
    }
  }, [existing, reset]);

  const onSubmit = async (data: PurchasePlanSavingsInput) => {
    if (isEdit && entryId) {
      await updateSaving(entryId, data);
    } else {
      await addSaving(planId, data);
    }
    router.back();
  };

  const onDelete = () => {
    Alert.alert('削除の確認', 'この貯蓄実績を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          if (entryId) {
            await removeSaving(entryId);
            router.back();
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isEdit ? '貯蓄実績を編集' : '貯蓄実績を追加',
          headerShown: true,
        }}
      />
      <ScrollView>
        <YStack gap="$4" p="$4" pb="$8">
          <Controller
            control={control}
            name="yearMonth"
            render={({ field: { onChange, onBlur, value } }) => (
              <YStack gap="$1">
                <Paragraph color="$color12">年月 *</Paragraph>
                <Input
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="例: 2026-05"
                  aria-label="年月"
                  autoCapitalize="none"
                />
                <FieldError message={errors.yearMonth?.message} />
              </YStack>
            )}
          />

          <YStack gap="$1">
            <Paragraph color="$color12">金額（円）*</Paragraph>
            <Controller
              control={control}
              name="amount"
              render={({ field: { onChange, onBlur, value } }) => (
                <NumericInput
                  value={value}
                  onChange={onChange}
                  onBlur={onBlur}
                  placeholder="例: 30000"
                  ariaLabel="金額"
                />
              )}
            />
            <FieldError message={errors.amount?.message} />
          </YStack>

          <Controller
            control={control}
            name="memo"
            render={({ field: { onChange, onBlur, value } }) => (
              <YStack gap="$1">
                <Paragraph color="$color12">メモ</Paragraph>
                <Input
                  value={value ?? ''}
                  onChangeText={(t) => onChange(t || null)}
                  onBlur={onBlur}
                  placeholder="例: ボーナス分"
                  aria-label="メモ"
                />
              </YStack>
            )}
          />

          <Button theme="blue" onPress={handleSubmit(onSubmit)}>
            保存
          </Button>

          {isEdit && (
            <Button theme="red" onPress={onDelete}>
              この実績を削除
            </Button>
          )}
        </YStack>
      </ScrollView>
    </>
  );
}
```

- [ ] **Step 2: 型チェックが通ることを確認する**

```bash
npx tsc --noEmit
```

期待: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add app/purchase-plan-savings-form.tsx
git commit -m "feat: 貯蓄実績追加/編集フォーム画面を新規作成"
```

---

## Task 5: components/purchase-plan-form.tsx を全面刷新

**Files:**

- Modify: `components/purchase-plan-form.tsx`

- [ ] **Step 1: ファイルを全面置換する**

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { Button, Card, Paragraph, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { NumericInput } from '@/components/form/numeric-input';
import { InstrumentPicker } from '@/components/instrument-picker';
import { calcPurchaseDate, type PurchasePlan, purchasePlanSchema } from '@/forms/purchase-plan';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';
import { usePurchasePlanStore } from '@/store/purchase-plan';

function getPrevMonthStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
}

export function PurchasePlanForm() {
  const fetchAllPlan = usePurchasePlanStore((s) => s.fetchAll);
  const fetchAllCatalog = useInstrumentCatalogStore((s) => s.fetchAll);
  const plan = usePurchasePlanStore((s) => s.plan);
  const savings = usePurchasePlanStore((s) => s.savings);
  const upsertPlan = usePurchasePlanStore((s) => s.upsertPlan);

  useFocusEffect(
    useCallback(() => {
      fetchAllPlan();
      fetchAllCatalog();
    }, [fetchAllPlan, fetchAllCatalog]),
  );

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PurchasePlan>({
    resolver: zodResolver(purchasePlanSchema),
    mode: 'onTouched',
    defaultValues: {
      makerId: '',
      makerName: '',
      modelId: '',
      modelName: '',
      targetPrice: null,
      monthlyTarget: null,
    },
  });

  useEffect(() => {
    if (plan) {
      reset({
        makerId: plan.makerId,
        makerName: plan.makerName,
        modelId: plan.modelId,
        modelName: plan.modelName,
        targetPrice: plan.targetPrice,
        monthlyTarget: plan.monthlyTarget,
      });
    }
  }, [plan, reset]);

  const [makerId, makerName, modelId, modelName] = watch([
    'makerId',
    'makerName',
    'modelId',
    'modelName',
  ]);

  const currentSavings = savings.reduce((sum, s) => sum + s.amount, 0);
  const progressPct =
    plan && plan.targetPrice > 0 ? Math.min(currentSavings / plan.targetPrice, 1) : 0;
  const purchaseDateResult = plan
    ? calcPurchaseDate(plan.targetPrice, currentSavings, plan.monthlyTarget)
    : null;

  const prevMonthStr = getPrevMonthStr();
  const recentSavings = savings
    .filter((s) => s.yearMonth >= prevMonthStr)
    .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));

  const onSubmitPlan = async (data: PurchasePlan) => {
    await upsertPlan(data);
  };

  return (
    <ScrollView>
      <YStack gap="$4" p="$4" pb="$8">
        {/* 計画カード */}
        <Card elevation="$2" borderWidth={1} borderColor="$borderColor" p="$4" gap="$3">
          <Paragraph size="$5" fontWeight="bold">
            欲しい楽器
          </Paragraph>

          <InstrumentPicker
            value={makerId ? { makerId, makerName, modelId, modelName } : null}
            onChange={(v) => {
              setValue('makerId', v.makerId, { shouldValidate: true });
              setValue('makerName', v.makerName, { shouldValidate: true });
              setValue('modelId', v.modelId, { shouldValidate: true });
              setValue('modelName', v.modelName, { shouldValidate: true });
            }}
          />
          <FieldError message={errors.makerId?.message} />
          <FieldError message={errors.modelId?.message} />

          <YStack gap="$1">
            <Paragraph color="$color12">目標金額（円）</Paragraph>
            <Controller
              control={control}
              name="targetPrice"
              render={({ field: { onChange, onBlur, value } }) => (
                <NumericInput
                  value={value}
                  onChange={onChange}
                  onBlur={onBlur}
                  placeholder="例: 850000"
                  ariaLabel="目標金額"
                />
              )}
            />
            <FieldError message={errors.targetPrice?.message} />
          </YStack>

          <YStack gap="$1">
            <Paragraph color="$color12">予定月額（円）</Paragraph>
            <Controller
              control={control}
              name="monthlyTarget"
              render={({ field: { onChange, onBlur, value } }) => (
                <NumericInput
                  value={value}
                  onChange={onChange}
                  onBlur={onBlur}
                  placeholder="例: 30000"
                  ariaLabel="予定月額"
                />
              )}
            />
            <FieldError message={errors.monthlyTarget?.message} />
          </YStack>

          <Button theme="blue" onPress={handleSubmit(onSubmitPlan)}>
            保存
          </Button>
        </Card>

        {/* 進捗カード */}
        {plan && (
          <Card
            elevation="$2"
            borderWidth={1}
            borderColor="$green8"
            backgroundColor="$green2"
            p="$4"
            gap="$3"
          >
            <Paragraph size="$5" fontWeight="bold" color="$green11">
              貯蓄進捗
            </Paragraph>
            <Paragraph color="$green12" size="$6" fontWeight="bold">
              ¥{currentSavings.toLocaleString()}
            </Paragraph>
            <XStack height={8} borderRadius="$2" overflow="hidden" backgroundColor="$green4">
              <YStack
                height={8}
                width={`${Math.min(Math.round(progressPct * 100), 100)}%`}
                backgroundColor="$green9"
              />
            </XStack>
            {purchaseDateResult && (
              <>
                <Paragraph color="$green11" size="$3">
                  購入可能時期（自動算出）
                </Paragraph>
                <Paragraph color="$green12" size="$5" fontWeight="bold">
                  {purchaseDateResult.yearMonth}
                </Paragraph>
                {purchaseDateResult.months > 0 && (
                  <Paragraph color="$green10" size="$2">
                    あと約{purchaseDateResult.months}ヶ月・残り¥
                    {(plan.targetPrice - currentSavings).toLocaleString()}
                  </Paragraph>
                )}
              </>
            )}
          </Card>
        )}

        {/* 貯蓄実績カード */}
        {plan && (
          <Card elevation="$2" borderWidth={1} borderColor="$borderColor" p="$4" gap="$3">
            <XStack justify="space-between" items="center">
              <Paragraph size="$5" fontWeight="bold">
                貯蓄実績
              </Paragraph>
              <Button
                size="$3"
                theme="blue"
                onPress={() =>
                  router.push({
                    pathname: '/purchase-plan-savings-form',
                    params: { planId: plan.id },
                  })
                }
              >
                ＋ 追加
              </Button>
            </XStack>
            <Paragraph size="$2" color="$color10">
              当月・前月の実績を表示
            </Paragraph>

            {recentSavings.length === 0 ? (
              <Paragraph color="$color10" size="$3">
                実績がありません
              </Paragraph>
            ) : (
              recentSavings.map((entry) => (
                <XStack
                  key={entry.id}
                  justify="space-between"
                  items="flex-start"
                  borderTopWidth={1}
                  borderColor="$borderColor"
                  pt="$2"
                >
                  <YStack flex={1}>
                    <Paragraph fontWeight="bold">
                      {formatYearMonth(entry.yearMonth)}　¥{entry.amount.toLocaleString()}
                    </Paragraph>
                    {entry.memo ? (
                      <Paragraph size="$2" color="$color10">
                        {entry.memo}
                      </Paragraph>
                    ) : null}
                  </YStack>
                  <Button
                    size="$2"
                    chromeless
                    onPress={() =>
                      router.push({
                        pathname: '/purchase-plan-savings-form',
                        params: { planId: plan.id, id: entry.id },
                      })
                    }
                  >
                    編集
                  </Button>
                </XStack>
              ))
            )}
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
```

- [ ] **Step 2: 型チェックが通ることを確認する**

```bash
npx tsc --noEmit
```

期待: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add components/purchase-plan-form.tsx
git commit -m "feat: 購入計画フォームを3カード構成（計画・進捗・貯蓄実績）に全面刷新"
```

---

## Task 6: integration テストを全面刷新

**Files:**

- Modify: `__tests__/integration/purchase-plan-form.integration.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`__tests__/integration/purchase-plan-form.integration.test.tsx` を以下の内容で全面置換する。

```tsx
import { fireEvent, waitFor } from '@testing-library/react-native';

import { PurchasePlanForm } from '@/components/purchase-plan-form';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';
import { usePurchasePlanStore } from '@/store/purchase-plan';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: jest.fn(),
  router: { push: jest.fn() },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(() => ({
      upsert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'plan-1',
          maker_id: 'maker-1',
          maker_name: 'Buffet Crampon',
          model_id: 'model-1',
          model_name: 'R13',
          target_price: 850000,
          monthly_savings_target: 30000,
        },
        error: null,
      }),
    })),
  },
}));

const sampleCatalog = {
  makers: [{ id: 'maker-1', name: 'Buffet Crampon' }],
  models: [{ id: 'model-1', makerId: 'maker-1', name: 'R13' }],
};

const samplePlan = {
  id: 'plan-1',
  makerId: 'maker-1',
  makerName: 'Buffet Crampon',
  modelId: 'model-1',
  modelName: 'R13',
  targetPrice: 850000,
  monthlyTarget: 30000,
};

describe('PurchasePlanForm (integration)', () => {
  beforeEach(() => {
    usePurchasePlanStore.setState({ plan: null, savings: [], loading: false });
    useInstrumentCatalogStore.setState({ ...sampleCatalog, loading: false });
    jest.clearAllMocks();
    (require('@/lib/supabase').supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
  });

  it('plan が未登録のとき進捗カードと実績カードを表示しない', () => {
    renderWithProviders(<PurchasePlanForm />);
    expect(screen.queryByText('貯蓄進捗')).toBeNull();
    expect(screen.queryByText('貯蓄実績')).toBeNull();
  });

  it('plan が登録済みのとき進捗カードと実績カードを表示する', () => {
    usePurchasePlanStore.setState({ plan: samplePlan, savings: [], loading: false });
    renderWithProviders(<PurchasePlanForm />);
    expect(screen.getByText('貯蓄進捗')).toBeTruthy();
    expect(screen.getByText('貯蓄実績')).toBeTruthy();
  });

  it('2ヶ月より古い実績は表示されない', () => {
    const old = new Date();
    old.setMonth(old.getMonth() - 3);
    const oldYM = `${old.getFullYear()}-${String(old.getMonth() + 1).padStart(2, '0')}`;
    usePurchasePlanStore.setState({
      plan: samplePlan,
      savings: [{ id: 'sav-old', yearMonth: oldYM, amount: 30000, memo: null }],
      loading: false,
    });
    renderWithProviders(<PurchasePlanForm />);
    expect(screen.queryByText(/30,000/)).toBeNull();
  });

  it('当月の実績は表示される', () => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    usePurchasePlanStore.setState({
      plan: samplePlan,
      savings: [{ id: 'sav-1', yearMonth: currentYM, amount: 30000, memo: 'テスト' }],
      loading: false,
    });
    renderWithProviders(<PurchasePlanForm />);
    expect(screen.getByText(/30,000/)).toBeTruthy();
    expect(screen.getByText('テスト')).toBeTruthy();
  });

  it('保存ボタン押下で upsertPlan が呼ばれ plan がセットされる', async () => {
    renderWithProviders(<PurchasePlanForm />);

    fireEvent.press(screen.getByLabelText('メーカー Buffet Crampon'));
    await waitFor(() => screen.getByLabelText('機種名 R13'));
    fireEvent.press(screen.getByLabelText('機種名 R13'));
    fireEvent.changeText(screen.getByLabelText('目標金額'), '850000');
    fireEvent.changeText(screen.getByLabelText('予定月額'), '30000');

    fireEvent.press(screen.getByText('保存'));

    await waitFor(() => {
      expect(usePurchasePlanStore.getState().plan).not.toBeNull();
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest __tests__/integration/purchase-plan-form.integration.test.tsx
```

期待: 旧コンポーネントを参照するため FAIL する。

- [ ] **Step 3: テストを通す（Task 5 完了後に実行）**

```bash
npx jest __tests__/integration/purchase-plan-form.integration.test.tsx
```

期待: 全テスト PASS。

- [ ] **Step 4: コミット**

```bash
git add __tests__/integration/purchase-plan-form.integration.test.tsx
git commit -m "test: 購入計画フォームの integration テストを新 UI に対応"
```

---

## Task 7: 品質チェック & 最終コミット

**Files:** なし（チェックのみ）

- [ ] **Step 1: ESLint を通す**

```bash
npm run lint
```

期待: エラー 0 件。エラーがあれば `npm run lint:fix` で自動修正後に再実行。

- [ ] **Step 2: Prettier を通す**

```bash
npm run format:check
```

期待: 差分 0 件。差分があれば `npm run format` で修正後に再実行。

- [ ] **Step 3: TypeScript 型チェックを通す**

```bash
npx tsc --noEmit
```

期待: エラー 0 件。

- [ ] **Step 4: Jest を全件通す**

```bash
npm test
```

期待: 全テスト PASS。

- [ ] **Step 5: lint/format の自動修正分をコミット（差分があれば）**

```bash
git add -p
git commit -m "chore: lint/format 自動修正"
```
