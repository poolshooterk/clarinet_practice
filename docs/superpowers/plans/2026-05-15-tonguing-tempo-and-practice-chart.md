# タンギングテンポ入力・月別練習時間グラフ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タンギングに BPM 入力欄を追加し、練習記録一覧画面に月別バーチャートと月ナビゲーションを追加する。

**Architecture:** Feature 1（テンポ入力）は DB マイグレーション → スキーマ → ストア → フォーム UI → カード表示の順に積み上げる。Feature 2（グラフ）は純粋コンポーネント `PracticeChart` を先に作り、その後 `index.tsx` に組み込む。2 つの feature は Task 1–5 と Task 6–7 に分かれており、Task 5 と Task 7 が同じ `app/(tabs)/index.tsx` を触るため順番通りに実行する。

**Tech Stack:** React Native (View-based chart、追加ライブラリなし)、Zustand v5、React Hook Form、zod v4、Tamagui、Supabase JS、Jest + RNTL

---

### Task 1: DBマイグレーション — tempo_bpm カラム追加

**Files:**

- Create: `supabase/migrations/20260515000001_add_tempo_bpm_to_basic_menus.sql`

- [ ] **Step 1: マイグレーションファイルを作成**

```sql
ALTER TABLE practice_session_basic_menus
  ADD COLUMN tempo_bpm INT CHECK (tempo_bpm BETWEEN 40 AND 240);
```

- [ ] **Step 2: Supabase に適用**

```bash
supabase db push
```

期待: エラーなし。`practice_session_basic_menus` に `tempo_bpm` 列が追加される（既存行は NULL）。

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260515000001_add_tempo_bpm_to_basic_menus.sql
git commit -m "feat: practice_session_basic_menus に tempo_bpm カラムを追加"
```

---

### Task 2: フォームスキーマ更新 (`forms/practice-log.ts`) + unit テスト

**Files:**

- Modify: `forms/practice-log.ts`
- Modify: `forms/__tests__/practice-log.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

`forms/__tests__/practice-log.test.ts` に以下の `describe` ブロックを `describe('tonguingMinutes', ...)` の直後に追加する:

```ts
describe('tonguingTempoBpm', () => {
  it('省略可能', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      textbookEntries: [],
    });
    expect(result.success).toBe(true);
  });

  it('40 は有効', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpm: 40,
      textbookEntries: [],
    });
    expect(result.success).toBe(true);
  });

  it('240 は有効', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpm: 240,
      textbookEntries: [],
    });
    expect(result.success).toBe(true);
  });

  it('39 はエラー', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpm: 39,
      textbookEntries: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('40以上の整数を入力してください');
  });

  it('241 はエラー', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpm: 241,
      textbookEntries: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('240以下の整数を入力してください');
  });

  it('小数はエラー', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpm: 120.5,
      textbookEntries: [],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest forms/__tests__/practice-log.test.ts --no-coverage
```

期待: `tonguingTempoBpm` の各ケースが FAIL（フィールドが存在しないため）。

- [ ] **Step 3: スキーマに `tonguingTempoBpm` を追加**

`forms/practice-log.ts` の `practiceLogSchema` を以下のように更新する。`tonguingMinutes` の直後に追加:

```ts
export const practiceLogSchema = z.object({
  practicedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください'),
  longToneMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tonguingMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tonguingTempoBpm: z
    .number()
    .int()
    .min(40, '40以上の整数を入力してください')
    .max(240, '240以下の整数を入力してください')
    .optional(),
  memo: z.string().optional(),
  textbookEntries: z.array(textbookEntrySchema),
});
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest forms/__tests__/practice-log.test.ts --no-coverage
```

期待: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add forms/practice-log.ts forms/__tests__/practice-log.test.ts
git commit -m "feat: practiceLogSchema に tonguingTempoBpm フィールドを追加"
```

---

### Task 3: ストア更新 (`store/practice-log.ts`) + unit テスト更新

**Files:**

- Modify: `store/practice-log.ts`
- Modify: `store/__tests__/practice-log.test.ts`

- [ ] **Step 1: ストアを更新**

`store/practice-log.ts` を以下のように変更する。

**`BasicMenuEntry` 型に `tempoBpm` を追加:**

```ts
type BasicMenuEntry = {
  menuType: string;
  durationMinutes: number;
  tempoBpm: number | null;
};
```

**`SessionRow` の `practice_session_basic_menus` に `tempo_bpm` を追加:**

```ts
type SessionRow = {
  id: string;
  practiced_at: string;
  duration_minutes: number | null;
  memo: string | null;
  practice_session_textbooks: {
    textbook_id: string;
    current_page: number;
    textbooks: { title: string; total_pages: number | null } | null;
  }[];
  practice_session_basic_menus: {
    menu_type: string;
    duration_minutes: number;
    tempo_bpm: number | null;
  }[];
};
```

**`fetchAll` の select クエリに `tempo_bpm` を追加し、マッピングも更新:**

```ts
const { data, error } = await supabase
  .from('practice_sessions')
  .select(
    'id, practiced_at, duration_minutes, memo, ' +
      'practice_session_textbooks ( textbook_id, current_page, textbooks ( title, total_pages ) ), ' +
      'practice_session_basic_menus ( menu_type, duration_minutes, tempo_bpm )',
  )
  .order('practiced_at', { ascending: false });
```

マッピング部分:

```ts
basicMenuEntries: (row.practice_session_basic_menus ?? []).map((m) => ({
  menuType: m.menu_type,
  durationMinutes: m.duration_minutes,
  tempoBpm: m.tempo_bpm ?? null,
})),
```

**`add` の `basicMenuRows` 構築を更新（`as const` を削除して明示的な配列に変更）:**

```ts
const basicMenuRows = [
  ...(input.longToneMinutes != null
    ? [
        {
          session_id: sessionId,
          menu_type: 'long_tone' as const,
          duration_minutes: input.longToneMinutes,
          tempo_bpm: null as number | null,
        },
      ]
    : []),
  ...(input.tonguingMinutes != null
    ? [
        {
          session_id: sessionId,
          menu_type: 'tonguing' as const,
          duration_minutes: input.tonguingMinutes,
          tempo_bpm: (input.tonguingTempoBpm ?? null) as number | null,
        },
      ]
    : []),
];
```

**`newSession` の `basicMenuEntries` マッピングに `tempoBpm` を追加:**

```ts
basicMenuEntries: basicMenuRows.map((r) => ({
  menuType: r.menu_type,
  durationMinutes: r.duration_minutes,
  tempoBpm: r.tempo_bpm,
})),
```

- [ ] **Step 2: 既存テストを更新（`tempoBpm` フィールドを追加）**

`store/__tests__/practice-log.test.ts` の以下の箇所を更新する。

**`fetchAll` テスト — モックデータに `tempo_bpm` を追加し、アサーションも更新:**

`practice_session_basic_menus` のモックを以下に変更:

```ts
practice_session_basic_menus: [
  { menu_type: 'long_tone', duration_minutes: 15, tempo_bpm: null },
  { menu_type: 'tonguing', duration_minutes: 10, tempo_bpm: null },
],
```

アサーションを以下に変更:

```ts
expect(sessions[0].basicMenuEntries).toEqual([
  { menuType: 'long_tone', durationMinutes: 15, tempoBpm: null },
  { menuType: 'tonguing', durationMinutes: 10, tempoBpm: null },
]);
```

**`add で基礎練習あり` テスト — アサーションを更新:**

```ts
expect(sessions[0].basicMenuEntries).toEqual([
  { menuType: 'long_tone', durationMinutes: 15, tempoBpm: null },
  { menuType: 'tonguing', durationMinutes: 10, tempoBpm: null },
]);
```

- [ ] **Step 3: `add` で `tonguingTempoBpm` が `tempoBpm` にマッピングされることを確認するテストを追加**

`store/__tests__/practice-log.test.ts` の `add で基礎練習あり` の直後に追加:

```ts
it('add で tonguingTempoBpm を渡すと basicMenuEntries に tempoBpm が入る', async () => {
  mockSupabase().auth.getUser.mockResolvedValueOnce({
    data: { user: { id: 'user-1' } },
  });
  mockSupabase().from.mockReturnValueOnce({
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: 'new-session' }, error: null }),
      }),
    }),
  });
  mockSupabase().from.mockReturnValueOnce({
    insert: jest.fn().mockResolvedValue({ error: null }),
  });

  await usePracticeLogStore.getState().add({
    practicedAt: '2026-05-12',
    tonguingMinutes: 15,
    tonguingTempoBpm: 120,
    textbookEntries: [],
  });

  const sessions = usePracticeLogStore.getState().sessions;
  expect(sessions[0].basicMenuEntries).toEqual([
    { menuType: 'tonguing', durationMinutes: 15, tempoBpm: 120 },
  ]);
});
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest store/__tests__/practice-log.test.ts --no-coverage
```

期待: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add store/practice-log.ts store/__tests__/practice-log.test.ts
git commit -m "feat: BasicMenuEntry に tempoBpm を追加し fetchAll/add を更新"
```

---

### Task 4: フォームUI更新 (`components/practice-log-form.tsx`) + integration テスト追加

**Files:**

- Modify: `components/practice-log-form.tsx`
- Modify: `__tests__/integration/practice-log-form.integration.test.tsx`

- [ ] **Step 1: integration テストに失敗するケースを追加**

`__tests__/integration/practice-log-form.integration.test.tsx` の末尾（最後の `});` の直前）に追加:

```ts
it('タンギングに値を入力すると BPM 入力欄が表示される', async () => {
  renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
  expect(screen.queryByLabelText('タンギング テンポ (BPM)')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
  await waitFor(() => {
    expect(screen.getByLabelText('タンギング テンポ (BPM)')).toBeTruthy();
  });
});

it('タンギングの値を消すと BPM 入力欄が非表示になる', async () => {
  renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
  await waitFor(() => {
    expect(screen.getByLabelText('タンギング テンポ (BPM)')).toBeTruthy();
  });
  fireEvent.changeText(screen.getByLabelText('タンギング'), '');
  await waitFor(() => {
    expect(screen.queryByLabelText('タンギング テンポ (BPM)')).toBeNull();
  });
});

it('BPM に 39 を入力して保存するとバリデーションエラーが表示される', async () => {
  renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
  await waitFor(() => {
    expect(screen.getByLabelText('タンギング テンポ (BPM)')).toBeTruthy();
  });
  fireEvent.changeText(screen.getByLabelText('タンギング テンポ (BPM)'), '39');
  fireEvent.press(screen.getByLabelText('保存'));
  await waitFor(() => {
    expect(screen.getByText('40以上の整数を入力してください')).toBeTruthy();
  });
});

it('BPM を入力して保存すると onSubmit に tonguingTempoBpm が含まれる', async () => {
  const onSubmit = jest.fn();
  renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
  fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
  await waitFor(() => {
    expect(screen.getByLabelText('タンギング テンポ (BPM)')).toBeTruthy();
  });
  fireEvent.changeText(screen.getByLabelText('タンギング テンポ (BPM)'), '120');
  fireEvent.press(screen.getByLabelText('保存'));
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
  expect(onSubmit.mock.calls[0][0]).toMatchObject({
    tonguingMinutes: 15,
    tonguingTempoBpm: 120,
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest __tests__/integration/practice-log-form.integration.test.tsx --no-coverage
```

期待: 追加した 4 件が FAIL（BPM フィールド未実装のため）。

- [ ] **Step 3: フォームUI に BPM 入力欄を追加**

`components/practice-log-form.tsx` を以下のように変更する。

**`defaultValues` に `tonguingTempoBpm` を追加:**

```ts
defaultValues: {
  practicedAt: today(),
  longToneMinutes: undefined,
  tonguingMinutes: undefined,
  tonguingTempoBpm: undefined,
  memo: '',
  textbookEntries: [],
},
```

**タンギングの `Controller` ブロックの直後（同じ `BASIC_MENUS.map` のループの外、`{totalMinutes > 0 && ...}` の前）に BPM フィールドを追加:**

現在のループ `BASIC_MENUS.map(...)` の直後に追加:

```tsx
{
  watchedTonguing !== undefined && (
    <Controller
      control={control}
      name="tonguingTempoBpm"
      render={({ field: { onChange, onBlur, value } }) => (
        <YStack gap="$1">
          <Paragraph color="$color11" fontSize="$3">
            テンポ（BPM）任意
          </Paragraph>
          <Input
            value={value !== undefined ? String(value) : ''}
            onChangeText={(t) => {
              const n = Number(t);
              onChange(t === '' || isNaN(n) ? undefined : n);
            }}
            onBlur={onBlur}
            placeholder="例: 120"
            keyboardType="numeric"
            aria-label="タンギング テンポ (BPM)"
          />
          <FieldError message={errors.tonguingTempoBpm?.message} />
        </YStack>
      )}
    />
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest __tests__/integration/practice-log-form.integration.test.tsx --no-coverage
```

期待: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add components/practice-log-form.tsx __tests__/integration/practice-log-form.integration.test.tsx
git commit -m "feat: タンギング分数入力後に BPM 入力欄を表示"
```

---

### Task 5: カード表示更新 (`app/(tabs)/index.tsx`) + 品質チェック

**Files:**

- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: カード内の basicMenuEntries 表示ロジックを更新**

`app/(tabs)/index.tsx` の `renderItem` 内、basicMenuEntries を表示している箇所を以下に変更する。

変更前:

```tsx
{
  item.basicMenuEntries.length > 0 && (
    <XStack gap="$3" mt="$1" flexWrap="wrap">
      {item.basicMenuEntries.map((entry) => (
        <Paragraph key={entry.menuType} fontSize="$2" color="$color10">
          {`${BASIC_MENUS.find((m) => m.type === entry.menuType)?.label ?? entry.menuType}: ${entry.durationMinutes}分`}
        </Paragraph>
      ))}
    </XStack>
  );
}
```

変更後:

```tsx
{
  item.basicMenuEntries.length > 0 && (
    <XStack gap="$3" mt="$1" flexWrap="wrap">
      {item.basicMenuEntries.map((entry) => {
        const label = BASIC_MENUS.find((m) => m.type === entry.menuType)?.label ?? entry.menuType;
        const suffix =
          entry.menuType === 'tonguing' && entry.tempoBpm != null ? ` ♩=${entry.tempoBpm}` : '';
        return (
          <Paragraph key={entry.menuType} fontSize="$2" color="$color10">
            {`${label}: ${entry.durationMinutes}分${suffix}`}
          </Paragraph>
        );
      })}
    </XStack>
  );
}
```

- [ ] **Step 2: 品質チェックを実施**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

期待: エラー 0 件、全テスト PASS。

- [ ] **Step 3: コミット**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat: 練習カードにタンギングの BPM を表示"
```

---

### Task 6: PracticeChart コンポーネント作成 + unit テスト

**Files:**

- Create: `components/practice-chart.tsx`
- Create: `components/__tests__/practice-chart.test.ts`

- [ ] **Step 1: 失敗するテストを作成**

`components/__tests__/practice-chart.test.ts` を以下の内容で作成:

```ts
import { buildDayMap } from '@/components/practice-chart';
import type { PracticeSession } from '@/store/practice-log';

function makeSession(
  id: string,
  practicedAt: string,
  durationMinutes: number | null,
): PracticeSession {
  return {
    id,
    practicedAt,
    durationMinutes,
    memo: null,
    textbookEntries: [],
    basicMenuEntries: [],
  };
}

describe('buildDayMap', () => {
  it('指定月のセッションのみ集計する', () => {
    const sessions = [makeSession('1', '2026-05-10', 30), makeSession('2', '2026-04-20', 45)];
    const result = buildDayMap(sessions, '2026-05');
    expect(result[10]).toBe(30);
    expect(result[20]).toBeUndefined();
  });

  it('同日の複数セッションを合算する', () => {
    const sessions = [makeSession('1', '2026-05-10', 20), makeSession('2', '2026-05-10', 15)];
    const result = buildDayMap(sessions, '2026-05');
    expect(result[10]).toBe(35);
  });

  it('durationMinutes が null のセッションはスキップする', () => {
    const sessions = [makeSession('1', '2026-05-01', null)];
    const result = buildDayMap(sessions, '2026-05');
    expect(result).toEqual({});
  });

  it('durationMinutes が 0 のセッションはスキップする', () => {
    const sessions = [makeSession('1', '2026-05-01', 0)];
    const result = buildDayMap(sessions, '2026-05');
    expect(result).toEqual({});
  });

  it('セッションが空のとき空のマップを返す', () => {
    expect(buildDayMap([], '2026-05')).toEqual({});
  });

  it('指定月にセッションがないとき空のマップを返す', () => {
    const sessions = [makeSession('1', '2026-04-10', 30)];
    expect(buildDayMap(sessions, '2026-05')).toEqual({});
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest components/__tests__/practice-chart.test.ts --no-coverage
```

期待: FAIL（`buildDayMap` が存在しないため）。

- [ ] **Step 3: `practice-chart.tsx` を作成**

`components/practice-chart.tsx` を以下の内容で作成:

```tsx
import { useMemo } from 'react';
import { View } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { today } from '@/forms/practice-log';
import type { PracticeSession } from '@/store/practice-log';

const MAX_BAR_HEIGHT = 60;
const LABEL_DAYS = [1, 8, 15, 22];

export function buildDayMap(sessions: PracticeSession[], month: string): Record<number, number> {
  const map: Record<number, number> = {};
  for (const s of sessions) {
    if (!s.practicedAt.startsWith(month)) continue;
    if (!s.durationMinutes) continue;
    const day = Number(s.practicedAt.slice(8, 10));
    map[day] = (map[day] ?? 0) + s.durationMinutes;
  }
  return map;
}

type Props = { sessions: PracticeSession[]; month: string };

export function PracticeChart({ sessions, month }: Props) {
  const [y, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const dayMap = useMemo(() => buildDayMap(sessions, month), [sessions, month]);
  const maxMinutes = Math.max(1, ...Object.values(dayMap));

  const todayStr = today();
  const isCurrentMonth = month === todayStr.slice(0, 7);
  const todayDay = Number(todayStr.slice(8, 10));

  return (
    <YStack px="$3" pt="$2" pb="$1">
      <XStack height={MAX_BAR_HEIGHT} items="flex-end" gap={1}>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const minutes = dayMap[day] ?? 0;
          const barH = minutes > 0 ? Math.round((minutes / maxMinutes) * MAX_BAR_HEIGHT) : 0;
          const isToday = isCurrentMonth && day === todayDay;
          return (
            <View
              key={day}
              style={{
                flex: 1,
                height: barH,
                backgroundColor: isToday ? '#3b82f6' : '#93c5fd',
                borderRadius: 1,
              }}
            />
          );
        })}
      </XStack>
      <XStack>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          return (
            <View key={day} style={{ flex: 1, alignItems: 'center' }}>
              {LABEL_DAYS.includes(day) && (
                <Paragraph fontSize="$1" color="$color9">
                  {day}
                </Paragraph>
              )}
            </View>
          );
        })}
      </XStack>
    </YStack>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest components/__tests__/practice-chart.test.ts --no-coverage
```

期待: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add components/practice-chart.tsx components/__tests__/practice-chart.test.ts
git commit -m "feat: PracticeChart コンポーネントと buildDayMap ヘルパーを追加"
```

---

### Task 7: インデックス画面更新 (`app/(tabs)/index.tsx`) + integration テスト

**Files:**

- Modify: `app/(tabs)/index.tsx`
- Create: `__tests__/integration/practice-log-screen.integration.test.tsx`

- [ ] **Step 1: integration テストを作成（失敗する状態）**

`__tests__/integration/practice-log-screen.integration.test.tsx` を以下の内容で作成:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';

import PracticeLogScreen from '@/app/(tabs)/index';
import { today } from '@/forms/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
  useFocusEffect: () => {},
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const THIS_MONTH = today().slice(0, 7);
const [ty, tm] = THIS_MONTH.split('-').map(Number);
const prevDate = new Date(ty, tm - 2, 1);
const PREV_MONTH = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

const THIS_DATE = `${THIS_MONTH}-15`;
const PREV_DATE = `${PREV_MONTH}-10`;

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${Number(m)}月`;
}

const makeSession = (id: string, practicedAt: string, durationMinutes: number | null = null) => ({
  id,
  practicedAt,
  durationMinutes,
  memo: null,
  textbookEntries: [],
  basicMenuEntries: [],
});

describe('PracticeLogScreen (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePracticeLogStore.setState({
      sessions: [makeSession('s1', THIS_DATE, 30), makeSession('s2', PREV_DATE, 45)],
      loading: false,
    });
    jest.clearAllMocks();
  });

  it('初期表示で今月の日付が見える', () => {
    renderWithProviders(<PracticeLogScreen />);
    expect(screen.getByText(new RegExp(THIS_DATE))).toBeTruthy();
  });

  it('初期表示で前月の日付は見えない', () => {
    renderWithProviders(<PracticeLogScreen />);
    expect(screen.queryByText(new RegExp(PREV_DATE))).toBeNull();
  });

  it('月ラベルに今月が表示される', () => {
    renderWithProviders(<PracticeLogScreen />);
    expect(screen.getByText(formatMonthLabel(THIS_MONTH))).toBeTruthy();
  });

  it('＜ を押すと前月のラベルが表示され前月の記録が見える', async () => {
    renderWithProviders(<PracticeLogScreen />);
    fireEvent.press(screen.getByLabelText('前月へ'));
    await waitFor(() => {
      expect(screen.getByText(formatMonthLabel(PREV_MONTH))).toBeTruthy();
      expect(screen.getByText(new RegExp(PREV_DATE))).toBeTruthy();
    });
    expect(screen.queryByText(new RegExp(THIS_DATE))).toBeNull();
  });

  it('前月から ＞ を押すと今月に戻る', async () => {
    renderWithProviders(<PracticeLogScreen />);
    fireEvent.press(screen.getByLabelText('前月へ'));
    await waitFor(() => {
      expect(screen.getByText(formatMonthLabel(PREV_MONTH))).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('次月へ'));
    await waitFor(() => {
      expect(screen.getByText(formatMonthLabel(THIS_MONTH))).toBeTruthy();
    });
  });

  it('今月のとき ＞ を押しても月は変わらない', async () => {
    renderWithProviders(<PracticeLogScreen />);
    fireEvent.press(screen.getByLabelText('次月へ'));
    await waitFor(() => {
      expect(screen.getByText(formatMonthLabel(THIS_MONTH))).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest __tests__/integration/practice-log-screen.integration.test.tsx --no-coverage
```

期待: FAIL（月ナビ UI 未実装のため）。

- [ ] **Step 3: `app/(tabs)/index.tsx` を更新**

ファイル全体を以下の内容に置き換える:

```tsx
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { PracticeChart } from '@/components/practice-chart';
import { BASIC_MENUS, today } from '@/forms/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';

function dayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${Number(m)}月`;
}

export default function PracticeLogScreen() {
  const sessions = usePracticeLogStore((s) => s.sessions);
  const loading = usePracticeLogStore((s) => s.loading);
  const fetchAll = usePracticeLogStore((s) => s.fetchAll);
  const remove = usePracticeLogStore((s) => s.remove);

  const currentMonth = today().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const monthSessions = sessions.filter((s) => s.practicedAt.startsWith(selectedMonth));
  const totalMinutes = monthSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  function prevMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function nextMonth() {
    if (selectedMonth >= currentMonth) return;
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const handleLongPress = (id: string) => {
    Alert.alert('練習記録を削除', 'この記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: '練習記録' }} />
      <FlatList
        data={monthSessions}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <YStack>
            <XStack justify="space-between" items="center" px="$4" pt="$3" pb="$1">
              <Pressable onPress={prevMonth} aria-label="前月へ">
                <Paragraph color="$blue9" fontSize="$5">
                  ＜
                </Paragraph>
              </Pressable>
              <YStack items="center" gap="$1">
                <Paragraph fontWeight="bold">{formatMonthLabel(selectedMonth)}</Paragraph>
                <Paragraph fontSize="$2" color="$color10">
                  {`${monthSessions.length}回 / 計${totalMinutes}分`}
                </Paragraph>
              </YStack>
              <Pressable
                onPress={nextMonth}
                disabled={selectedMonth >= currentMonth}
                aria-label="次月へ"
              >
                <Paragraph
                  color={selectedMonth >= currentMonth ? '$color9' : '$blue9'}
                  fontSize="$5"
                >
                  ＞
                </Paragraph>
              </Pressable>
            </XStack>
            <PracticeChart sessions={monthSessions} month={selectedMonth} />
            <Pressable
              onPress={() => router.push('/practice-log-form')}
              style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 4 }}
            >
              <Paragraph color="$blue9" fontSize="$2">
                ＋ 記録
              </Paragraph>
            </Pressable>
          </YStack>
        }
        ListEmptyComponent={
          !loading ? (
            <Paragraph text="center" color="$color10" mt="$8">
              記録がまだありません
            </Paragraph>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => handleLongPress(item.id)}>
            <YStack
              mx="$3"
              mb="$2"
              p="$3"
              bg="$color1"
              rounded="$3"
              borderWidth={1}
              borderColor="$borderColor"
            >
              <XStack justify="space-between" items="baseline" mb="$1">
                <Paragraph fontWeight="bold">
                  {`${item.practicedAt}（${dayOfWeek(item.practicedAt)}）`}
                </Paragraph>
                {item.durationMinutes != null && (
                  <Paragraph fontSize="$2" color="$color10">
                    {`${item.durationMinutes}分`}
                  </Paragraph>
                )}
              </XStack>
              {item.memo ? (
                <Paragraph fontSize="$2" color="$color11" numberOfLines={1} mb="$1">
                  {item.memo}
                </Paragraph>
              ) : null}
              {item.textbookEntries.map((entry) => (
                <XStack key={entry.textbookId} gap="$2" items="center">
                  <Paragraph fontSize="$2">{entry.textbookTitle}</Paragraph>
                  <Paragraph fontSize="$2" color="$blue9" ml="auto">
                    {`p.${entry.currentPage}`}
                  </Paragraph>
                </XStack>
              ))}
              {item.basicMenuEntries.length > 0 && (
                <XStack gap="$3" mt="$1" flexWrap="wrap">
                  {item.basicMenuEntries.map((entry) => {
                    const label =
                      BASIC_MENUS.find((m) => m.type === entry.menuType)?.label ?? entry.menuType;
                    const suffix =
                      entry.menuType === 'tonguing' && entry.tempoBpm != null
                        ? ` ♩=${entry.tempoBpm}`
                        : '';
                    return (
                      <Paragraph key={entry.menuType} fontSize="$2" color="$color10">
                        {`${label}: ${entry.durationMinutes}分${suffix}`}
                      </Paragraph>
                    );
                  })}
                </XStack>
              )}
            </YStack>
          </Pressable>
        )}
      />
    </>
  );
}
```

> **注意:** このステップは Task 5 で加えた BPM カード表示の変更も含むため、Task 5 のコミット内容とのマージは不要。Task 5 → Task 7 の順で実行した場合は index.tsx がすでに BPM 変更済みのため、BPM 部分はそのまま残して上書きすること。

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest __tests__/integration/practice-log-screen.integration.test.tsx --no-coverage
```

期待: 全テスト PASS。

- [ ] **Step 5: 品質チェックを実施**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

期待: エラー 0 件、全テスト PASS。

- [ ] **Step 6: コミット**

```bash
git add app/\(tabs\)/index.tsx __tests__/integration/practice-log-screen.integration.test.tsx
git commit -m "feat: 月別練習時間グラフと月ナビゲーションを追加"
```
