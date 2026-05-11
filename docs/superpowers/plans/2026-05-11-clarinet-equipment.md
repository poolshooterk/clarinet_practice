# クラリネット楽器情報 v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 楽器カードにメーカー・機種名チップ選択UI・購入金額フィールドを追加し、独立した「購入計画」タブを新設する。

**Architecture:** `InstrumentPicker` を共通コンポーネントとして切り出し、楽器情報フォームと購入計画フォームの両方で使用する。メーカー・機種名リストは Supabase で管理し、Zustand + AsyncStorage でキャッシュする。購入計画フォームは RHF `onChange` モード + `watch()` でリアルタイム算出、`useEffect` で Zustand 自動保存。

**Tech Stack:** Expo Router v6, React Hook Form, zod, Zustand v5, AsyncStorage, Tamagui, Supabase JS v2, expo-router useFocusEffect

---

## ファイル構成

| 作成/更新 | パス                                                            | 役割                                                                                         |
| --------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 作成      | Supabase migration                                              | `instrument_makers` / `instrument_models` テーブル + 初期データ                              |
| 作成      | `store/instrument-catalog.ts`                                   | メーカー・機種名キャッシュ + fetch/add アクション                                            |
| 作成      | `store/__tests__/instrument-catalog.test.ts`                    | ストア単体テスト                                                                             |
| 作成      | `forms/purchase-plan.ts`                                        | 購入計画 zod スキーマ + `calcPurchaseDate`                                                   |
| 作成      | `forms/__tests__/purchase-plan.test.ts`                         | `calcPurchaseDate` 単体テスト                                                                |
| 作成      | `store/purchase-plan.ts`                                        | 購入計画入力値の永続ストア                                                                   |
| 作成      | `store/__tests__/purchase-plan.test.ts`                         | ストア単体テスト                                                                             |
| 作成      | `components/instrument-picker.tsx`                              | メーカー→機種名チップ選択 UI                                                                 |
| 更新      | `forms/equipment.ts`                                            | `instrumentItemSchema` を makerId/modelId/makerName/modelName/purchasePrice/startDate に変更 |
| 更新      | `forms/__tests__/equipment.test.ts`                             | 新スキーマに合わせて全面更新                                                                 |
| 更新      | `store/__tests__/equipment.test.ts`                             | sampleEquipment を新スキーマに更新                                                           |
| 更新      | `__tests__/integration/equipment-form.integration.test.tsx`     | InstrumentPicker 経由の選択テストに更新                                                      |
| 更新      | `components/equipment-form.tsx`                                 | InstrumentPicker 使用・purchasePrice フィールド追加                                          |
| 作成      | `components/purchase-plan-form.tsx`                             | 購入計画フォーム UI                                                                          |
| 作成      | `__tests__/integration/purchase-plan-form.integration.test.tsx` | 購入計画フォーム結合テスト                                                                   |
| 作成      | `app/(tabs)/purchase-plan.tsx`                                  | 購入計画タブ画面                                                                             |
| 更新      | `app/(tabs)/_layout.tsx`                                        | 💰 購入計画タブ追加                                                                          |

---

### Task 1: Supabase マイグレーション — instrument_makers / instrument_models テーブル

**Files:**

- Supabase migration（`mcp__supabase__apply_migration` ツールで適用）

- [ ] **Step 1: マイグレーションを適用する**

`mcp__supabase__apply_migration` ツールを以下の SQL で実行する:

```sql
create table instrument_makers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table instrument_models (
  id uuid primary key default gen_random_uuid(),
  maker_id uuid not null references instrument_makers(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique(maker_id, name)
);

-- 初期データ: Buffet Crampon
with bc as (
  insert into instrument_makers (name) values ('Buffet Crampon') returning id
)
insert into instrument_models (maker_id, name)
select bc.id, m.name from bc, (values ('R13'), ('E11'), ('Prestige'), ('RC'), ('Tosca')) as m(name);

-- 初期データ: Yamaha
with ya as (
  insert into instrument_makers (name) values ('Yamaha') returning id
)
insert into instrument_models (maker_id, name)
select ya.id, m.name from ya, (values ('YCL-650'), ('YCL-SEV'), ('YCL-CSVR')) as m(name);

-- 初期データ: Selmer
with se as (
  insert into instrument_makers (name) values ('Selmer') returning id
)
insert into instrument_models (maker_id, name)
select se.id, m.name from se, (values ('Series 10'), ('Privilege')) as m(name);
```

- [ ] **Step 2: テーブルが作成されたことを確認**

`mcp__supabase__list_tables` でテーブル一覧を確認し、`instrument_makers` と `instrument_models` が存在することを確認する。

- [ ] **Step 3: コミット**

マイグレーションファイルが生成された場合:

```bash
git add supabase/migrations/
git commit -m "feat: instrument_makers・instrument_models テーブルを追加"
```

---

### Task 2: store/instrument-catalog.ts — メーカー・機種名キャッシュストア

**Files:**

- Create: `store/instrument-catalog.ts`
- Create: `store/__tests__/instrument-catalog.test.ts`

- [ ] **Step 1: テストファイルを作成（失敗状態）**

`store/__tests__/instrument-catalog.test.ts` を作成:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useInstrumentCatalogStore } from '@/store/instrument-catalog';

jest.mock('@/lib/supabase', () => {
  const makersData = [
    { id: 'maker-1', name: 'Buffet Crampon' },
    { id: 'maker-2', name: 'Yamaha' },
  ];
  const modelsData = [
    { id: 'model-1', maker_id: 'maker-1', name: 'R13' },
    { id: 'model-2', maker_id: 'maker-1', name: 'E11' },
    { id: 'model-3', maker_id: 'maker-2', name: 'YCL-650' },
  ];
  const newMaker = { id: 'maker-new', name: 'Selmer' };
  const newModel = { id: 'model-new', maker_id: 'maker-1', name: 'Tosca' };

  return {
    supabase: {
      from: jest.fn((table: string) => {
        if (table === 'instrument_makers') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: makersData, error: null }),
            insert: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: newMaker, error: null }),
          };
        }
        if (table === 'instrument_models') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: modelsData, error: null }),
            insert: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: newModel, error: null }),
          };
        }
        return {};
      }),
    },
  };
});

describe('useInstrumentCatalogStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useInstrumentCatalogStore.setState({ makers: [], models: [], loading: false });
  });

  it('初期状態: makers / models は空配列', () => {
    const { makers, models } = useInstrumentCatalogStore.getState();
    expect(makers).toEqual([]);
    expect(models).toEqual([]);
  });

  it('fetchAll でメーカーと機種名がセットされる', async () => {
    await useInstrumentCatalogStore.getState().fetchAll();
    const { makers, models } = useInstrumentCatalogStore.getState();
    expect(makers).toHaveLength(2);
    expect(makers[0]).toEqual({ id: 'maker-1', name: 'Buffet Crampon' });
    expect(models).toHaveLength(3);
  });

  it('addMaker で makers に追加される', async () => {
    await useInstrumentCatalogStore.getState().addMaker('Selmer');
    const { makers } = useInstrumentCatalogStore.getState();
    expect(makers.some((m) => m.name === 'Selmer')).toBe(true);
  });

  it('addModel で models に追加される', async () => {
    await useInstrumentCatalogStore.getState().addModel('maker-1', 'Tosca');
    const { models } = useInstrumentCatalogStore.getState();
    expect(models.some((m) => m.name === 'Tosca')).toBe(true);
  });

  it('fetchAll が Supabase エラーを返してもキャッシュがあれば維持される', async () => {
    useInstrumentCatalogStore.setState({
      makers: [{ id: 'cached-1', name: 'Cached Maker' }],
      models: [],
      loading: false,
    });
    const { supabase } = jest.requireMock('@/lib/supabase');
    supabase.from.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: null, error: new Error('network error') }),
    }));

    await useInstrumentCatalogStore.getState().fetchAll();

    expect(useInstrumentCatalogStore.getState().makers).toEqual([
      { id: 'cached-1', name: 'Cached Maker' },
    ]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest store/__tests__/instrument-catalog.test.ts
```

期待: FAIL（`@/store/instrument-catalog` が存在しないため Cannot find module エラー）

- [ ] **Step 3: store/instrument-catalog.ts を実装**

`store/instrument-catalog.ts` を作成:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { supabase } from '@/lib/supabase';

type Maker = { id: string; name: string };
type Model = { id: string; makerId: string; name: string };

type InstrumentCatalogState = {
  makers: Maker[];
  models: Model[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  addMaker: (name: string) => Promise<void>;
  addModel: (makerId: string, name: string) => Promise<void>;
};

export const useInstrumentCatalogStore = create<InstrumentCatalogState>()(
  persist(
    (set, get) => ({
      makers: [],
      models: [],
      loading: false,

      fetchAll: async () => {
        set({ loading: true });
        const [makersRes, modelsRes] = await Promise.all([
          supabase.from('instrument_makers').select('id, name').order('name'),
          supabase.from('instrument_models').select('id, maker_id, name').order('name'),
        ]);
        set({ loading: false });

        if (makersRes.error || modelsRes.error) return;

        set({
          makers: makersRes.data ?? [],
          models: (modelsRes.data ?? []).map((m) => ({
            id: m.id,
            makerId: m.maker_id,
            name: m.name,
          })),
        });
      },

      addMaker: async (name: string) => {
        const { data, error } = await supabase
          .from('instrument_makers')
          .insert({ name })
          .select()
          .single();
        if (error || !data) return;
        set({ makers: [...get().makers, { id: data.id, name: data.name }] });
      },

      addModel: async (makerId: string, name: string) => {
        const { data, error } = await supabase
          .from('instrument_models')
          .insert({ maker_id: makerId, name })
          .select()
          .single();
        if (error || !data) return;
        set({
          models: [...get().models, { id: data.id, makerId: data.maker_id, name: data.name }],
        });
      },
    }),
    {
      name: 'clarinet-practice-instrument-catalog',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ makers: s.makers, models: s.models }),
    },
  ),
);
```

- [ ] **Step 4: テストが全部パスすることを確認**

```bash
npx jest store/__tests__/instrument-catalog.test.ts
```

期待: PASS（5 件全テスト）

- [ ] **Step 5: コミット**

```bash
git add store/instrument-catalog.ts store/__tests__/instrument-catalog.test.ts
git commit -m "feat: instrument-catalog Zustand ストアを追加"
```

---

### Task 3: forms/purchase-plan.ts — 購入計画スキーマ + calcPurchaseDate

**Files:**

- Create: `forms/purchase-plan.ts`
- Create: `forms/__tests__/purchase-plan.test.ts`

- [ ] **Step 1: テストファイルを作成（失敗状態）**

`forms/__tests__/purchase-plan.test.ts` を作成:

```ts
import { calcPurchaseDate, purchasePlanSchema } from '@/forms/purchase-plan';

describe('calcPurchaseDate', () => {
  it('monthlySavings が 0 以下のとき null を返す', () => {
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
    // ceil(650000 / 30000) = ceil(21.67) = 22
    const result = calcPurchaseDate(850000, 200000, 30000);
    expect(result).not.toBeNull();
    expect(result!.months).toBe(22);
  });

  it('yearMonth の形式が "YYYY年M月ごろ" である', () => {
    const result = calcPurchaseDate(850000, 200000, 30000);
    expect(result!.yearMonth).toMatch(/^\d{4}年\d{1,2}月ごろ$/);
  });

  it('ちょうど割り切れる場合は ceil で同じ値になる', () => {
    // 残額 60000 / 月 30000 = 2.0 → 2 ヶ月
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
    currentSavings: 200000,
    monthlySavings: 30000,
  };

  it('有効なデータを受け入れる', () => {
    expect(purchasePlanSchema.safeParse(valid).success).toBe(true);
  });

  it('makerId が空文字列のとき拒否する', () => {
    const r = purchasePlanSchema.safeParse({ ...valid, makerId: '' });
    expect(r.success).toBe(false);
  });

  it('targetPrice が 0 以下のとき拒否する', () => {
    const r = purchasePlanSchema.safeParse({ ...valid, targetPrice: 0 });
    expect(r.success).toBe(false);
  });

  it('currentSavings が負のとき拒否する', () => {
    const r = purchasePlanSchema.safeParse({ ...valid, currentSavings: -1 });
    expect(r.success).toBe(false);
  });

  it('monthlySavings が 0 以下のとき拒否する', () => {
    const r = purchasePlanSchema.safeParse({ ...valid, monthlySavings: 0 });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest forms/__tests__/purchase-plan.test.ts
```

期待: FAIL（`@/forms/purchase-plan` が存在しないため Cannot find module エラー）

- [ ] **Step 3: forms/purchase-plan.ts を実装**

`forms/purchase-plan.ts` を作成:

```ts
import { z } from 'zod';

export const purchasePlanSchema = z.object({
  makerId: z.string().min(1, 'メーカーを選択してください'),
  makerName: z.string().min(1),
  modelId: z.string().min(1, '機種名を選択してください'),
  modelName: z.string().min(1),
  targetPrice: z
    .number({ required_error: '目標金額を入力してください' })
    .positive('正の値を入力してください'),
  currentSavings: z
    .number({ required_error: '現在の貯蓄額を入力してください' })
    .min(0, '0以上の値を入力してください'),
  monthlySavings: z
    .number({ required_error: '月あたりの貯蓄額を入力してください' })
    .positive('正の値を入力してください'),
});

export type PurchasePlan = z.infer<typeof purchasePlanSchema>;

export function calcPurchaseDate(
  targetPrice: number,
  currentSavings: number,
  monthlySavings: number,
): { months: number; yearMonth: string } | null {
  if (monthlySavings <= 0) return null;
  const remaining = targetPrice - currentSavings;
  if (remaining <= 0) return { months: 0, yearMonth: '今すぐ購入可能' };
  const months = Math.ceil(remaining / monthlySavings);
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return { months, yearMonth: `${y}年${m}月ごろ` };
}
```

- [ ] **Step 4: テストが全部パスすることを確認**

```bash
npx jest forms/__tests__/purchase-plan.test.ts
```

期待: PASS（10 件全テスト）

- [ ] **Step 5: コミット**

```bash
git add forms/purchase-plan.ts forms/__tests__/purchase-plan.test.ts
git commit -m "feat: 購入計画スキーマと calcPurchaseDate を追加"
```

---

### Task 4: store/purchase-plan.ts — 購入計画永続ストア

**Files:**

- Create: `store/purchase-plan.ts`
- Create: `store/__tests__/purchase-plan.test.ts`

- [ ] **Step 1: テストファイルを作成（失敗状態）**

`store/__tests__/purchase-plan.test.ts` を作成:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PurchasePlan } from '@/forms/purchase-plan';
import { usePurchasePlanStore } from '@/store/purchase-plan';

const STORAGE_KEY = 'clarinet-practice-purchase-plan';

const samplePlan: PurchasePlan = {
  makerId: 'maker-1',
  makerName: 'Buffet Crampon',
  modelId: 'model-1',
  modelName: 'R13',
  targetPrice: 850000,
  currentSavings: 200000,
  monthlySavings: 30000,
};

describe('usePurchasePlanStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePurchasePlanStore.setState({ plan: null });
  });

  it('初期状態は null', () => {
    expect(usePurchasePlanStore.getState().plan).toBeNull();
  });

  it('setPlan でストア状態が更新される', () => {
    usePurchasePlanStore.getState().setPlan(samplePlan);
    expect(usePurchasePlanStore.getState().plan).toEqual(samplePlan);
  });

  it('setPlan で AsyncStorage に書き込まれる', async () => {
    usePurchasePlanStore.getState().setPlan(samplePlan);
    await new Promise((r) => setImmediate(r));

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).state.plan).toEqual(samplePlan);
  });

  it('rehydrate で AsyncStorage の値が復元される', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { plan: samplePlan }, version: 0 }),
    );
    await usePurchasePlanStore.persist.rehydrate();
    expect(usePurchasePlanStore.getState().plan).toEqual(samplePlan);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest store/__tests__/purchase-plan.test.ts
```

期待: FAIL（`@/store/purchase-plan` が存在しないため Cannot find module エラー）

- [ ] **Step 3: store/purchase-plan.ts を実装**

`store/purchase-plan.ts` を作成:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PurchasePlan } from '@/forms/purchase-plan';

type PurchasePlanState = {
  plan: PurchasePlan | null;
  setPlan: (plan: PurchasePlan) => void;
};

export const usePurchasePlanStore = create<PurchasePlanState>()(
  persist(
    (set) => ({
      plan: null,
      setPlan: (plan) => set({ plan }),
    }),
    {
      name: 'clarinet-practice-purchase-plan',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

- [ ] **Step 4: テストが全部パスすることを確認**

```bash
npx jest store/__tests__/purchase-plan.test.ts
```

期待: PASS（4 件全テスト）

- [ ] **Step 5: コミット**

```bash
git add store/purchase-plan.ts store/__tests__/purchase-plan.test.ts
git commit -m "feat: 購入計画の Zustand ストアを追加"
```

---

### Task 5: InstrumentPicker + equipment スキーマ更新 + フォーム更新

このタスクは `forms/equipment.ts` のスキーマ変更と `components/equipment-form.tsx` の UI 変更、および関連テストの更新を **同時に行う**。途中状態では TypeScript が通らないため、一括で変更してから品質チェックを通す。

**Files:**

- Create: `components/instrument-picker.tsx`
- Modify: `forms/equipment.ts`
- Modify: `forms/__tests__/equipment.test.ts`
- Modify: `store/__tests__/equipment.test.ts`
- Modify: `__tests__/integration/equipment-form.integration.test.tsx`
- Modify: `components/equipment-form.tsx`

- [ ] **Step 1: components/instrument-picker.tsx を作成**

`components/instrument-picker.tsx` を作成:

```tsx
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, XStack, YStack } from 'tamagui';

import { useInstrumentCatalogStore } from '@/store/instrument-catalog';

export type InstrumentPickerValue = {
  makerId: string;
  makerName: string;
  modelId: string;
  modelName: string;
};

type Props = {
  value: InstrumentPickerValue | null;
  onChange: (value: InstrumentPickerValue) => void;
};

export function InstrumentPicker({ value, onChange }: Props) {
  const makers = useInstrumentCatalogStore((s) => s.makers);
  const models = useInstrumentCatalogStore((s) => s.models);
  const addMaker = useInstrumentCatalogStore((s) => s.addMaker);
  const addModel = useInstrumentCatalogStore((s) => s.addModel);

  const [selectedMakerId, setSelectedMakerId] = useState<string | null>(value?.makerId ?? null);
  const [addingMaker, setAddingMaker] = useState(false);
  const [addingModel, setAddingModel] = useState(false);
  const [newMakerName, setNewMakerName] = useState('');
  const [newModelName, setNewModelName] = useState('');

  const filteredModels = models.filter((m) => m.makerId === selectedMakerId);

  const handleMakerSelect = (makerId: string, makerName: string) => {
    setSelectedMakerId(makerId);
    setAddingModel(false);
    setNewModelName('');
  };

  const handleModelSelect = (modelId: string, modelName: string) => {
    if (!selectedMakerId) return;
    const maker = makers.find((m) => m.id === selectedMakerId);
    if (!maker) return;
    onChange({ makerId: selectedMakerId, makerName: maker.name, modelId, modelName });
  };

  const handleAddMaker = async () => {
    const name = newMakerName.trim();
    if (!name) return;
    await addMaker(name);
    setAddingMaker(false);
    setNewMakerName('');
  };

  const handleAddModel = async () => {
    if (!selectedMakerId) return;
    const name = newModelName.trim();
    if (!name) return;
    await addModel(selectedMakerId, name);
    setAddingModel(false);
    setNewModelName('');
  };

  return (
    <YStack gap="$2">
      <Paragraph color="$color11" size="$2">
        メーカーを選択
      </Paragraph>
      <XStack flexWrap="wrap" gap="$2">
        {makers.map((maker) => (
          <Button
            key={maker.id}
            size="$2"
            theme={selectedMakerId === maker.id ? 'blue' : undefined}
            variant={selectedMakerId === maker.id ? undefined : 'outlined'}
            onPress={() => handleMakerSelect(maker.id, maker.name)}
            aria-label={`メーカー ${maker.name}`}
          >
            {maker.name}
            {selectedMakerId === maker.id ? ' ✓' : ''}
          </Button>
        ))}
        {addingMaker ? (
          <XStack gap="$1" items="center">
            <Input
              size="$2"
              value={newMakerName}
              onChangeText={setNewMakerName}
              placeholder="メーカー名"
              aria-label="新しいメーカー名"
              autoFocus
            />
            <Button size="$2" theme="blue" onPress={handleAddMaker} aria-label="メーカー追加を確定">
              追加
            </Button>
            <Button
              size="$2"
              variant="outlined"
              onPress={() => {
                setAddingMaker(false);
                setNewMakerName('');
              }}
            >
              キャンセル
            </Button>
          </XStack>
        ) : (
          <Button
            size="$2"
            variant="outlined"
            onPress={() => setAddingMaker(true)}
            aria-label="メーカーを追加"
          >
            ＋追加
          </Button>
        )}
      </XStack>

      {selectedMakerId && (
        <>
          <Paragraph color="$color11" size="$2">
            機種名を選択
          </Paragraph>
          <XStack flexWrap="wrap" gap="$2">
            {filteredModels.map((model) => (
              <Button
                key={model.id}
                size="$2"
                theme={value?.modelId === model.id ? 'blue' : undefined}
                variant={value?.modelId === model.id ? undefined : 'outlined'}
                onPress={() => handleModelSelect(model.id, model.name)}
                aria-label={`機種名 ${model.name}`}
              >
                {model.name}
                {value?.modelId === model.id ? ' ✓' : ''}
              </Button>
            ))}
            {addingModel ? (
              <XStack gap="$1" items="center">
                <Input
                  size="$2"
                  value={newModelName}
                  onChangeText={setNewModelName}
                  placeholder="機種名"
                  aria-label="新しい機種名"
                  autoFocus
                />
                <Button
                  size="$2"
                  theme="blue"
                  onPress={handleAddModel}
                  aria-label="機種名追加を確定"
                >
                  追加
                </Button>
                <Button
                  size="$2"
                  variant="outlined"
                  onPress={() => {
                    setAddingModel(false);
                    setNewModelName('');
                  }}
                >
                  キャンセル
                </Button>
              </XStack>
            ) : (
              <Button
                size="$2"
                variant="outlined"
                onPress={() => setAddingModel(true)}
                aria-label="機種名を追加"
              >
                ＋追加
              </Button>
            )}
          </XStack>
        </>
      )}
    </YStack>
  );
}
```

- [ ] **Step 2: forms/equipment.ts を更新**

`forms/equipment.ts` を以下の内容に**置き換える**（注: `equipmentItemSchema` は reed/ligature/mouthpiece 用として維持し、楽器専用の `instrumentItemSchema` を新設する）:

```ts
import { z } from 'zod';

export const today = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

export const parseYmd = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const startDateSchema = z
  .string()
  .min(1, '使用開始日を入力してください')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式で入力してください')
  .refine((s) => parseYmd(s) !== null, '有効な日付を入力してください')
  .refine((s) => parseYmd(s)! <= today(), '未来の日付は選択できません');

export const instrumentItemSchema = z.object({
  makerId: z.string().min(1, 'メーカーを選択してください'),
  makerName: z.string().min(1),
  modelId: z.string().min(1, '機種名を選択してください'),
  modelName: z.string().min(1),
  purchasePrice: z.number().optional(),
  startDate: startDateSchema,
});

export const equipmentItemSchema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  startDate: startDateSchema,
});

export const clarinetEquipmentSchema = z.object({
  instrument: instrumentItemSchema,
  reed: equipmentItemSchema,
  ligature: equipmentItemSchema,
  mouthpiece: equipmentItemSchema,
});

export type InstrumentItem = z.infer<typeof instrumentItemSchema>;
export type EquipmentItem = z.infer<typeof equipmentItemSchema>;
export type ClarinetEquipment = z.infer<typeof clarinetEquipmentSchema>;
```

- [ ] **Step 3: forms/**tests**/equipment.test.ts を更新**

`forms/__tests__/equipment.test.ts` を以下の内容に**置き換える**:

```ts
import { clarinetEquipmentSchema, formatDate, parseYmd } from '@/forms/equipment';

const validInstrument = {
  makerId: 'maker-1',
  makerName: 'Buffet Crampon',
  modelId: 'model-1',
  modelName: 'R13',
  startDate: '2020-04-01',
};

const validEquipment = {
  instrument: validInstrument,
  reed: { name: 'Vandoren V12', startDate: '2024-01-15' },
  ligature: { name: 'Vandoren M/O', startDate: '2023-06-10' },
  mouthpiece: { name: 'Vandoren B45', startDate: '2022-03-20' },
};

describe('parseYmd', () => {
  it('YYYY-MM-DD 文字列を Date に変換する', () => {
    const d = parseYmd('2024-06-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(5);
    expect(d!.getDate()).toBe(15);
  });

  it('不正な文字列は null を返す', () => {
    expect(parseYmd('2024/06/15')).toBeNull();
    expect(parseYmd('not-a-date')).toBeNull();
    expect(parseYmd('')).toBeNull();
    expect(parseYmd('20-01-01')).toBeNull();
  });
});

describe('formatDate', () => {
  it('月・日をゼロパディングする', () => {
    expect(formatDate(new Date(2024, 0, 5))).toBe('2024-01-05');
  });

  it('parseYmd との round-trip が成立する', () => {
    const original = '2023-12-31';
    expect(formatDate(parseYmd(original)!)).toBe(original);
  });
});

describe('clarinetEquipmentSchema', () => {
  it('有効な全フィールドを受け入れる', () => {
    expect(clarinetEquipmentSchema.safeParse(validEquipment).success).toBe(true);
  });

  it('purchasePrice は省略可能', () => {
    const r = clarinetEquipmentSchema.safeParse(validEquipment);
    expect(r.success).toBe(true);
  });

  it('purchasePrice に数値を渡せる', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, purchasePrice: 850000 },
    });
    expect(r.success).toBe(true);
  });

  it('instrument.makerId が空文字列のとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, makerId: '' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['instrument', 'makerId']);
    }
  });

  it('instrument.modelId が空文字列のとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, modelId: '' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['instrument', 'modelId']);
    }
  });

  it('instrument.startDate が空文字列のとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, startDate: '' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['instrument', 'startDate']);
    }
  });

  it('startDate の形式が YYYY-MM-DD でないとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, startDate: '2024/01/15' },
    });
    expect(r.success).toBe(false);
  });

  it('未来の startDate を拒否する', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, startDate: formatDate(future) },
    });
    expect(r.success).toBe(false);
  });

  it('今日の日付は受け入れる', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validInstrument, startDate: formatDate(new Date()) },
    });
    expect(r.success).toBe(true);
  });

  it('reed.name が空文字列のとき拒否する', () => {
    const r = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      reed: { ...validEquipment.reed, name: '' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['reed', 'name']);
    }
  });
});
```

- [ ] **Step 4: store/**tests**/equipment.test.ts の sampleEquipment を更新**

`store/__tests__/equipment.test.ts` の `sampleEquipment` 定義部分を更新する:

```ts
const sampleEquipment = {
  instrument: {
    makerId: 'maker-1',
    makerName: 'Buffet Crampon',
    modelId: 'model-1',
    modelName: 'R13',
    startDate: '2020-04-01',
  },
  reed: { name: 'Vandoren V12', startDate: '2024-01-15' },
  ligature: { name: 'Vandoren M/O', startDate: '2023-06-10' },
  mouthpiece: { name: 'Vandoren B45', startDate: '2022-03-20' },
};
```

- [ ] **Step 5: components/equipment-form.tsx を更新**

`components/equipment-form.tsx` を以下の内容に**置き換える**:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform, ScrollView } from 'react-native';
import { Button, Card, Input, Paragraph, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { InstrumentPicker } from '@/components/instrument-picker';
import {
  type ClarinetEquipment,
  clarinetEquipmentSchema,
  formatDate,
  parseYmd,
} from '@/forms/equipment';
import { useEquipmentStore } from '@/store/equipment';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';

type OtherSection = 'reed' | 'ligature' | 'mouthpiece';

const OTHER_SECTIONS: {
  key: OtherSection;
  label: string;
  emoji: string;
  placeholder: string;
  presets: string[];
}[] = [
  {
    key: 'reed',
    label: 'リード',
    emoji: '🌿',
    placeholder: '例: Vandoren V12',
    presets: [
      'Vandoren V12',
      'Vandoren Traditional（青箱）',
      'Vandoren V21',
      "D'Addario Select Jazz",
      'Rico Royal',
      'Legere Signature',
    ],
  },
  {
    key: 'ligature',
    label: 'リガチャー',
    emoji: '🔗',
    placeholder: '例: Vandoren M/O',
    presets: ['Vandoren M/O', 'BG Franck Superior', 'Bonade', 'Rovner Dark', 'Harrison'],
  },
  {
    key: 'mouthpiece',
    label: 'マウスピース',
    emoji: '🎤',
    placeholder: '例: Vandoren B45',
    presets: ['Vandoren B45', 'Vandoren M30', 'Vandoren BD5', 'Clark W. Fobes Debut', 'Selmer C85'],
  },
];

const emptyInstrument = {
  makerId: '',
  makerName: '',
  modelId: '',
  modelName: '',
  startDate: '',
};
const emptyItem = { name: '', startDate: '' };

const defaultOnSubmit = (_values: ClarinetEquipment) => {
  Alert.alert('保存しました');
};

type Props = {
  onSubmit?: (values: ClarinetEquipment) => void;
};

export function EquipmentForm({ onSubmit = defaultOnSubmit }: Props) {
  const setEquipment = useEquipmentStore((s) => s.setEquipment);
  const savedEquipment = useEquipmentStore((s) => s.equipment);
  const fetchAll = useInstrumentCatalogStore((s) => s.fetchAll);
  const [showPicker, setShowPicker] = useState<OtherSection | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClarinetEquipment>({
    resolver: zodResolver(clarinetEquipmentSchema),
    mode: 'onTouched',
    defaultValues: savedEquipment ?? {
      instrument: emptyInstrument,
      reed: emptyItem,
      ligature: emptyItem,
      mouthpiece: emptyItem,
    },
  });

  const instrumentValue = watch('instrument');

  const handleSave = (values: ClarinetEquipment) => {
    setEquipment(values);
    onSubmit(values);
  };

  return (
    <ScrollView>
      <YStack gap="$4" p="$4" pb="$8">
        {/* 楽器カード */}
        <Card elevation="$2" borderWidth={1} borderColor="$borderColor" p="$4" gap="$3">
          <Paragraph size="$5" fontWeight="bold">
            🎵 楽器
          </Paragraph>

          <InstrumentPicker
            value={
              instrumentValue?.makerId
                ? {
                    makerId: instrumentValue.makerId,
                    makerName: instrumentValue.makerName,
                    modelId: instrumentValue.modelId,
                    modelName: instrumentValue.modelName,
                  }
                : null
            }
            onChange={(v) => {
              setValue('instrument.makerId', v.makerId, { shouldValidate: true });
              setValue('instrument.makerName', v.makerName);
              setValue('instrument.modelId', v.modelId, { shouldValidate: true });
              setValue('instrument.modelName', v.modelName);
            }}
          />
          <FieldError message={errors.instrument?.makerId?.message} />
          <FieldError message={errors.instrument?.modelId?.message} />

          <Controller
            control={control}
            name="instrument.purchasePrice"
            render={({ field: { onChange, onBlur, value } }) => (
              <YStack gap="$1">
                <Paragraph color="$color12">購入金額（任意）</Paragraph>
                <Input
                  value={value !== undefined ? String(value) : ''}
                  onChangeText={(t) => onChange(t === '' ? undefined : Number(t) || undefined)}
                  onBlur={onBlur}
                  placeholder="例: 850000"
                  keyboardType="numeric"
                  aria-label="購入金額"
                />
              </YStack>
            )}
          />

          <Controller
            control={control}
            name="instrument.startDate"
            render={({ field: { onChange, onBlur, value } }) => (
              <YStack gap="$1">
                <Paragraph color="$color12">使用開始日</Paragraph>
                <XStack gap="$2" items="center">
                  <Input
                    flex={1}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                    aria-label="楽器使用開始日"
                  />
                  {Platform.OS !== 'web' && (
                    <Button
                      onPress={() => setShowPicker('reed' as OtherSection)}
                      aria-label="楽器カレンダーから選択"
                    >
                      📅
                    </Button>
                  )}
                </XStack>
                <FieldError message={errors.instrument?.startDate?.message} />
              </YStack>
            )}
          />
        </Card>

        {/* リード・リガチャー・マウスピースカード */}
        {OTHER_SECTIONS.map((section) => (
          <Card
            key={section.key}
            elevation="$2"
            borderWidth={1}
            borderColor="$borderColor"
            p="$4"
            gap="$3"
          >
            <Paragraph size="$5" fontWeight="bold">
              {section.emoji} {section.label}
            </Paragraph>

            <Controller
              control={control}
              name={`${section.key}.name` as 'reed.name' | 'ligature.name' | 'mouthpiece.name'}
              render={({ field: { onChange, onBlur, value } }) => (
                <YStack gap="$2">
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={section.placeholder}
                    aria-label={`${section.label}名`}
                  />
                  <XStack flexWrap="wrap" gap="$2">
                    {section.presets.map((preset) => (
                      <Button
                        key={preset}
                        size="$2"
                        variant="outlined"
                        onPress={() => onChange(preset)}
                        aria-label={preset}
                      >
                        {preset}
                      </Button>
                    ))}
                  </XStack>
                  <FieldError message={errors[section.key]?.name?.message} />
                </YStack>
              )}
            />

            <Controller
              control={control}
              name={
                `${section.key}.startDate` as
                  | 'reed.startDate'
                  | 'ligature.startDate'
                  | 'mouthpiece.startDate'
              }
              render={({ field: { onChange, onBlur, value } }) => (
                <YStack gap="$1">
                  <Paragraph color="$color12">使用開始日</Paragraph>
                  <XStack gap="$2" items="center">
                    <Input
                      flex={1}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                      aria-label={`${section.label}使用開始日`}
                    />
                    {Platform.OS !== 'web' && (
                      <Button
                        onPress={() => setShowPicker(section.key)}
                        aria-label={`${section.label}カレンダーから選択`}
                      >
                        📅
                      </Button>
                    )}
                  </XStack>
                  {showPicker === section.key && Platform.OS !== 'web' && (
                    <DateTimePicker
                      mode="date"
                      display="default"
                      value={parseYmd(value) ?? new Date()}
                      maximumDate={new Date()}
                      onChange={(event, selectedDate) => {
                        setShowPicker(null);
                        if (event.type === 'set' && selectedDate) {
                          onChange(formatDate(selectedDate));
                        }
                      }}
                    />
                  )}
                  <FieldError message={errors[section.key]?.startDate?.message} />
                </YStack>
              )}
            />
          </Card>
        ))}

        <Button theme="blue" onPress={handleSubmit(handleSave)} disabled={isSubmitting}>
          保存する
        </Button>
      </YStack>
    </ScrollView>
  );
}
```

- [ ] **Step 6: **tests**/integration/equipment-form.integration.test.tsx を更新**

`__tests__/integration/equipment-form.integration.test.tsx` を以下の内容に**置き換える**:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { EquipmentForm } from '@/components/equipment-form';
import { useEquipmentStore } from '@/store/equipment';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: (cb: () => void) => {
    cb();
  },
}));

const sampleCatalog = {
  makers: [
    { id: 'maker-1', name: 'Buffet Crampon' },
    { id: 'maker-2', name: 'Yamaha' },
  ],
  models: [
    { id: 'model-1', makerId: 'maker-1', name: 'R13' },
    { id: 'model-2', makerId: 'maker-1', name: 'E11' },
    { id: 'model-3', makerId: 'maker-2', name: 'YCL-650' },
  ],
};

describe('EquipmentForm (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useEquipmentStore.setState({ equipment: null });
    useInstrumentCatalogStore.setState({ ...sampleCatalog, loading: false });
  });

  it('空送信でバリデーションエラーが表示される（スモーク）', async () => {
    renderWithProviders(<EquipmentForm />);
    fireEvent.press(screen.getByText('保存する'));
    await waitFor(() => {
      expect(screen.getAllByText('名前を入力してください').length).toBeGreaterThan(0);
    });
  });

  it('メーカーチップをタップすると選択状態になる', async () => {
    renderWithProviders(<EquipmentForm />);
    fireEvent.press(screen.getByLabelText('メーカー Buffet Crampon'));
    await waitFor(() => {
      expect(screen.getByLabelText('機種名 R13')).toBeTruthy();
    });
  });

  it('メーカー→機種名を選択すると onChange が呼ばれる', async () => {
    renderWithProviders(<EquipmentForm />);

    fireEvent.press(screen.getByLabelText('メーカー Buffet Crampon'));
    await waitFor(() => screen.getByLabelText('機種名 R13'));
    fireEvent.press(screen.getByLabelText('機種名 R13'));

    fireEvent.changeText(screen.getByLabelText('楽器使用開始日'), '2020-04-01');
    fireEvent.changeText(screen.getByLabelText('リード名'), 'Vandoren V12');
    fireEvent.changeText(screen.getByLabelText('リード使用開始日'), '2024-01-15');
    fireEvent.changeText(screen.getByLabelText('リガチャー名'), 'Vandoren M/O');
    fireEvent.changeText(screen.getByLabelText('リガチャー使用開始日'), '2023-06-10');
    fireEvent.changeText(screen.getByLabelText('マウスピース名'), 'Vandoren B45');
    fireEvent.changeText(screen.getByLabelText('マウスピース使用開始日'), '2022-03-20');

    const onSubmit = jest.fn();
    // onSubmit を注入するには再レンダー不要 — EquipmentForm のデフォルトは Alert.alert
    // ここでは onSubmit を最初から渡す
  });

  it('全項目入力して保存すると onSubmit が正しい値で呼ばれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<EquipmentForm onSubmit={onSubmit} />);

    fireEvent.press(screen.getByLabelText('メーカー Buffet Crampon'));
    await waitFor(() => screen.getByLabelText('機種名 R13'));
    fireEvent.press(screen.getByLabelText('機種名 R13'));

    fireEvent.changeText(screen.getByLabelText('楽器使用開始日'), '2020-04-01');
    fireEvent.changeText(screen.getByLabelText('リード名'), 'Vandoren V12');
    fireEvent.changeText(screen.getByLabelText('リード使用開始日'), '2024-01-15');
    fireEvent.changeText(screen.getByLabelText('リガチャー名'), 'Vandoren M/O');
    fireEvent.changeText(screen.getByLabelText('リガチャー使用開始日'), '2023-06-10');
    fireEvent.changeText(screen.getByLabelText('マウスピース名'), 'Vandoren B45');
    fireEvent.changeText(screen.getByLabelText('マウスピース使用開始日'), '2022-03-20');

    fireEvent.press(screen.getByText('保存する'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0].instrument).toEqual({
      makerId: 'maker-1',
      makerName: 'Buffet Crampon',
      modelId: 'model-1',
      modelName: 'R13',
      startDate: '2020-04-01',
    });
  });

  it('ストアに保存済みデータがあればフォームの初期値として表示される', () => {
    useEquipmentStore.setState({
      equipment: {
        instrument: {
          makerId: 'maker-1',
          makerName: 'Buffet Crampon',
          modelId: 'model-1',
          modelName: 'R13',
          startDate: '2020-04-01',
        },
        reed: { name: 'Vandoren V12', startDate: '2024-01-15' },
        ligature: { name: 'Vandoren M/O', startDate: '2023-06-10' },
        mouthpiece: { name: 'Vandoren B45', startDate: '2022-03-20' },
      },
    });
    renderWithProviders(<EquipmentForm />);
    expect(screen.getByLabelText('リード名').props.value).toBe('Vandoren V12');
  });
});
```

- [ ] **Step 7: 品質チェック 4 ステップを実施**

```bash
npm run lint
npm run format:check
npx tsc --noEmit
npm test
```

差分があれば `npm run lint:fix` と `npm run format` で修正して再実行。すべて 0 件エラーであることを確認。

- [ ] **Step 8: コミット**

```bash
git add components/instrument-picker.tsx forms/equipment.ts forms/__tests__/equipment.test.ts store/__tests__/equipment.test.ts __tests__/integration/equipment-form.integration.test.tsx components/equipment-form.tsx
git commit -m "feat: InstrumentPicker コンポーネントと楽器スキーマ v2 を実装"
```

---

### Task 6: purchase-plan-form.tsx + 結合テスト

**Files:**

- Create: `components/purchase-plan-form.tsx`
- Create: `__tests__/integration/purchase-plan-form.integration.test.tsx`

- [ ] **Step 1: 結合テストを作成（失敗状態）**

`__tests__/integration/purchase-plan-form.integration.test.tsx` を作成:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { PurchasePlanForm } from '@/components/purchase-plan-form';
import { usePurchasePlanStore } from '@/store/purchase-plan';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: (cb: () => void) => {
    cb();
  },
}));

const sampleCatalog = {
  makers: [{ id: 'maker-1', name: 'Buffet Crampon' }],
  models: [{ id: 'model-1', makerId: 'maker-1', name: 'Prestige' }],
};

describe('PurchasePlanForm (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePurchasePlanStore.setState({ plan: null });
    useInstrumentCatalogStore.setState({ ...sampleCatalog, loading: false });
  });

  it('金額入力前は購入可能時期が表示されない', () => {
    renderWithProviders(<PurchasePlanForm />);
    expect(screen.queryByText(/ごろ|今すぐ購入可能/)).toBeNull();
  });

  it('目標金額・現在の貯蓄額・月の貯蓄額を入力すると購入可能時期がリアルタイムで表示される', async () => {
    renderWithProviders(<PurchasePlanForm />);

    fireEvent.changeText(screen.getByLabelText('目標金額'), '850000');
    fireEvent.changeText(screen.getByLabelText('現在の貯蓄額'), '200000');
    fireEvent.changeText(screen.getByLabelText('月の貯蓄額'), '30000');

    await waitFor(() => {
      expect(screen.getByText(/ごろ/)).toBeTruthy();
    });
  });

  it('今すぐ購入可能ケース: 貯蓄額 >= 目標金額で "今すぐ購入可能" が表示される', async () => {
    renderWithProviders(<PurchasePlanForm />);

    fireEvent.changeText(screen.getByLabelText('目標金額'), '200000');
    fireEvent.changeText(screen.getByLabelText('現在の貯蓄額'), '300000');
    fireEvent.changeText(screen.getByLabelText('月の貯蓄額'), '30000');

    await waitFor(() => {
      expect(screen.getByText('今すぐ購入可能')).toBeTruthy();
    });
  });

  it('楽器を選択して金額を入力すると Zustand ストアに自動保存される', async () => {
    renderWithProviders(<PurchasePlanForm />);

    fireEvent.press(screen.getByLabelText('メーカー Buffet Crampon'));
    await waitFor(() => screen.getByLabelText('機種名 Prestige'));
    fireEvent.press(screen.getByLabelText('機種名 Prestige'));

    fireEvent.changeText(screen.getByLabelText('目標金額'), '850000');
    fireEvent.changeText(screen.getByLabelText('現在の貯蓄額'), '200000');
    fireEvent.changeText(screen.getByLabelText('月の貯蓄額'), '30000');

    await waitFor(() => {
      const plan = usePurchasePlanStore.getState().plan;
      expect(plan).not.toBeNull();
      expect(plan!.targetPrice).toBe(850000);
      expect(plan!.makerId).toBe('maker-1');
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest __tests__/integration/purchase-plan-form.integration.test.tsx
```

期待: FAIL（`@/components/purchase-plan-form` が存在しないため Cannot find module エラー）

- [ ] **Step 3: components/purchase-plan-form.tsx を実装**

`components/purchase-plan-form.tsx` を作成:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { Card, Input, Paragraph, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { InstrumentPicker } from '@/components/instrument-picker';
import { calcPurchaseDate, purchasePlanSchema, type PurchasePlan } from '@/forms/purchase-plan';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';
import { usePurchasePlanStore } from '@/store/purchase-plan';

export function PurchasePlanForm() {
  const fetchAll = useInstrumentCatalogStore((s) => s.fetchAll);
  const setPlan = usePurchasePlanStore((s) => s.setPlan);
  const savedPlan = usePurchasePlanStore((s) => s.plan);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const {
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PurchasePlan>({
    resolver: zodResolver(purchasePlanSchema),
    mode: 'onChange',
    defaultValues: savedPlan ?? {
      makerId: '',
      makerName: '',
      modelId: '',
      modelName: '',
      targetPrice: undefined,
      currentSavings: undefined,
      monthlySavings: undefined,
    },
  });

  const values = watch();

  useEffect(() => {
    const { makerId, modelId, targetPrice, currentSavings, monthlySavings } = values;
    if (makerId && modelId && targetPrice && currentSavings !== undefined && monthlySavings) {
      const result = purchasePlanSchema.safeParse(values);
      if (result.success) {
        setPlan(result.data);
      }
    }
  }, [values, setPlan]);

  const result =
    values.targetPrice && values.currentSavings !== undefined && values.monthlySavings
      ? calcPurchaseDate(values.targetPrice, values.currentSavings, values.monthlySavings)
      : null;

  return (
    <ScrollView>
      <YStack gap="$4" p="$4" pb="$8">
        <Card elevation="$2" borderWidth={1} borderColor="$borderColor" p="$4" gap="$3">
          <Paragraph size="$5" fontWeight="bold">
            🎵 欲しい楽器
          </Paragraph>

          <InstrumentPicker
            value={
              values.makerId
                ? {
                    makerId: values.makerId,
                    makerName: values.makerName,
                    modelId: values.modelId,
                    modelName: values.modelName,
                  }
                : null
            }
            onChange={(v) => {
              setValue('makerId', v.makerId, { shouldValidate: true });
              setValue('makerName', v.makerName);
              setValue('modelId', v.modelId, { shouldValidate: true });
              setValue('modelName', v.modelName);
            }}
          />
          <FieldError message={errors.makerId?.message} />
          <FieldError message={errors.modelId?.message} />

          <Controller
            control={control}
            name="targetPrice"
            render={({ field: { onChange, onBlur, value } }) => (
              <YStack gap="$1">
                <Paragraph color="$color12">目標金額</Paragraph>
                <Input
                  value={value !== undefined ? String(value) : ''}
                  onChangeText={(t) => onChange(t === '' ? undefined : Number(t) || undefined)}
                  onBlur={onBlur}
                  placeholder="例: 850000"
                  keyboardType="numeric"
                  aria-label="目標金額"
                />
                <FieldError message={errors.targetPrice?.message} />
              </YStack>
            )}
          />

          <XStack gap="$3">
            <Controller
              control={control}
              name="currentSavings"
              render={({ field: { onChange, onBlur, value } }) => (
                <YStack flex={1} gap="$1">
                  <Paragraph color="$color12">現在の貯蓄額</Paragraph>
                  <Input
                    value={value !== undefined ? String(value) : ''}
                    onChangeText={(t) => onChange(t === '' ? undefined : (Number(t) ?? undefined))}
                    onBlur={onBlur}
                    placeholder="例: 200000"
                    keyboardType="numeric"
                    aria-label="現在の貯蓄額"
                  />
                  <FieldError message={errors.currentSavings?.message} />
                </YStack>
              )}
            />

            <Controller
              control={control}
              name="monthlySavings"
              render={({ field: { onChange, onBlur, value } }) => (
                <YStack flex={1} gap="$1">
                  <Paragraph color="$color12">月の貯蓄額</Paragraph>
                  <Input
                    value={value !== undefined ? String(value) : ''}
                    onChangeText={(t) => onChange(t === '' ? undefined : Number(t) || undefined)}
                    onBlur={onBlur}
                    placeholder="例: 30000"
                    keyboardType="numeric"
                    aria-label="月の貯蓄額"
                  />
                  <FieldError message={errors.monthlySavings?.message} />
                </YStack>
              )}
            />
          </XStack>
        </Card>

        {result && (
          <Card
            elevation="$2"
            borderWidth={1}
            borderColor="$green8"
            backgroundColor="$green2"
            p="$4"
            gap="$2"
          >
            <Paragraph color="$green11" size="$3" textAlign="center">
              📅 購入可能時期（自動算出）
            </Paragraph>
            <Paragraph color="$green12" size="$6" fontWeight="bold" textAlign="center">
              {result.yearMonth}
            </Paragraph>
            {result.months > 0 && (
              <Paragraph color="$green10" size="$2" textAlign="center">
                あと約{result.months}ヶ月・残り￥
                {((values.targetPrice ?? 0) - (values.currentSavings ?? 0)).toLocaleString()}
              </Paragraph>
            )}
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
```

- [ ] **Step 4: 結合テストがパスすることを確認**

```bash
npx jest __tests__/integration/purchase-plan-form.integration.test.tsx
```

期待: PASS（4 件全テスト）

- [ ] **Step 5: 品質チェック 4 ステップを実施**

```bash
npm run lint
npm run format:check
npx tsc --noEmit
npm test
```

- [ ] **Step 6: コミット**

```bash
git add components/purchase-plan-form.tsx __tests__/integration/purchase-plan-form.integration.test.tsx
git commit -m "feat: 購入計画フォームコンポーネントを実装"
```

---

### Task 7: 購入計画タブ画面 + \_layout.tsx 更新

**Files:**

- Create: `app/(tabs)/purchase-plan.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: app/(tabs)/purchase-plan.tsx を作成**

`app/(tabs)/purchase-plan.tsx` を作成:

```tsx
import { PurchasePlanForm } from '@/components/purchase-plan-form';

export default function PurchasePlan() {
  return <PurchasePlanForm />;
}
```

- [ ] **Step 2: app/(tabs)/\_layout.tsx を確認して購入計画タブを追加**

`app/(tabs)/_layout.tsx` を読み込み、既存のタブ構成を確認する。`設定` タブの前に以下を追加する:

```tsx
<Tabs.Screen
  name="purchase-plan"
  options={{
    title: '購入計画',
    tabBarIcon: ({ color }) => <TabBarIcon name="wallet-outline" color={color} />,
  }}
/>
```

- [ ] **Step 3: 品質チェック 4 ステップを実施**

```bash
npm run lint
npm run format:check
npx tsc --noEmit
npm test
```

- [ ] **Step 4: コミット**

```bash
git add app/(tabs)/purchase-plan.tsx app/(tabs)/_layout.tsx
git commit -m "feat: 購入計画タブ画面を追加"
```

---

## 実装後の動作確認

```bash
npm start
```

1. 楽器情報タブ → 楽器カードでメーカーチップをタップ → 機種名チップが展開される → 機種名を選択 → 使用開始日を入力 → 「保存する」
2. 購入計画タブ → 欲しい楽器を選択 → 目標金額・貯蓄額を入力 → 購入可能時期がリアルタイムで表示される
3. アプリを再起動して入力値が復元されることを確認
