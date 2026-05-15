# 練習記録改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 月別グラフの条件表示・タンギング複数BPM対応・教本デフォルト値の3つの改善を実装する。

**Architecture:** DBの `tempo_bpm` 単一列を `tempo_bpms integer[]` 配列列に置き換え。フォームは `useFieldArray` で動的BPMリストを管理。教本デフォルトはフォームコンポーネント内で前回セッションから計算して `defaultValues` に設定。

**Tech Stack:** Expo Router, React Hook Form, zod, Zustand v5, Tamagui, Supabase (Postgres), Jest + RNTL

---

## ファイル変更マップ

| ファイル                                                         | 変更種別 | 内容                                                                            |
| ---------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| `supabase/migrations/20260515000002_tempo_bpms_array.sql`        | 新規作成 | `tempo_bpm` → `tempo_bpms integer[]` への移行マイグレーション                   |
| `forms/practice-log.ts`                                          | 修正     | `tonguingTempoBpm` を削除し `tonguingTempoBpms` (配列) に変更                   |
| `forms/__tests__/practice-log.test.ts`                           | 修正     | `tonguingTempoBpm` テストを `tonguingTempoBpms` テストに置き換え                |
| `store/practice-log.ts`                                          | 修正     | `BasicMenuEntry.tempoBpm` → `tempoBpms`、`add()`/`fetchAll()` の DB列参照を更新 |
| `store/__tests__/practice-log.test.ts`                           | 修正     | `tempo_bpm`/`tempoBpm` 参照を `tempo_bpms`/`tempoBpms` に更新                   |
| `components/practice-log-form.tsx`                               | 修正     | BPM 単一入力 → `useFieldArray` 動的リスト、教本デフォルト値を追加               |
| `__tests__/integration/practice-log-form.integration.test.tsx`   | 修正     | BPM テストを複数対応に更新、教本デフォルトテストを追加                          |
| `app/(tabs)/index.tsx`                                           | 修正     | グラフ条件表示、BPM 表示を配列対応に更新                                        |
| `__tests__/integration/practice-log-screen.integration.test.tsx` | 修正     | グラフ条件表示テストを追加                                                      |

---

## Task 1: Supabase DBマイグレーション

**Files:**

- Create: `supabase/migrations/20260515000002_tempo_bpms_array.sql`

- [ ] **Step 1: マイグレーションファイルを作成する**

```sql
-- supabase/migrations/20260515000002_tempo_bpms_array.sql
ALTER TABLE practice_session_basic_menus
  ADD COLUMN tempo_bpms integer[];

UPDATE practice_session_basic_menus
  SET tempo_bpms = ARRAY[tempo_bpm]
  WHERE tempo_bpm IS NOT NULL;

ALTER TABLE practice_session_basic_menus
  DROP COLUMN tempo_bpm;
```

- [ ] **Step 2: マイグレーションを適用する**

```bash
supabase db push
```

Expected: `Applying migration 20260515000002_tempo_bpms_array.sql` が出力される。

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260515000002_tempo_bpms_array.sql
git commit -m "feat: tempo_bpm を tempo_bpms integer[] 配列列に変更"
```

---

## Task 2: フォームスキーマ変更 (TDD)

**Files:**

- Modify: `forms/practice-log.ts`
- Modify: `forms/__tests__/practice-log.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`forms/__tests__/practice-log.test.ts` の `describe('tonguingTempoBpm')` ブロック（129〜184行）を以下に置き換える:

```typescript
describe('tonguingTempoBpms', () => {
  it('省略可能', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      textbookEntries: [],
    });
    expect(result.success).toBe(true);
  });

  it('空配列は有効', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpms: [],
      textbookEntries: [],
    });
    expect(result.success).toBe(true);
  });

  it('単一要素 { bpm: 120 } は有効', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpms: [{ bpm: 120 }],
      textbookEntries: [],
    });
    expect(result.success).toBe(true);
  });

  it('複数要素は有効', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpms: [{ bpm: 80 }, { bpm: 100 }, { bpm: 120 }],
      textbookEntries: [],
    });
    expect(result.success).toBe(true);
  });

  it('bpm: 40 は有効（下限）', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpms: [{ bpm: 40 }],
      textbookEntries: [],
    });
    expect(result.success).toBe(true);
  });

  it('bpm: 240 は有効（上限）', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpms: [{ bpm: 240 }],
      textbookEntries: [],
    });
    expect(result.success).toBe(true);
  });

  it('bpm: 39 はエラー', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpms: [{ bpm: 39 }],
      textbookEntries: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('40以上の整数を入力してください');
  });

  it('bpm: 241 はエラー', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpms: [{ bpm: 241 }],
      textbookEntries: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('240以下の整数を入力してください');
  });

  it('bpm: 120.5 はエラー（小数）', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      tonguingTempoBpms: [{ bpm: 120.5 }],
      textbookEntries: [],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest forms/__tests__/practice-log.test.ts
```

Expected: `tonguingTempoBpms` 関連のテストが FAIL する（フィールドがまだ存在しないため）。

- [ ] **Step 3: スキーマを更新して実装する**

`forms/practice-log.ts` を以下に置き換える:

```typescript
import { z } from 'zod';

export const BASIC_MENUS = [
  { type: 'long_tone', label: 'ロングトーン' },
  { type: 'tonguing', label: 'タンギング' },
] as const;

export type BasicMenuType = (typeof BASIC_MENUS)[number]['type'];

const textbookEntrySchema = z.object({
  textbookId: z.string().uuid('教本を選択してください'),
  currentPage: z.number().int().min(0, '0以上の整数を入力してください'),
});

const tonguingBpmEntrySchema = z.object({
  bpm: z
    .number()
    .int()
    .min(40, '40以上の整数を入力してください')
    .max(240, '240以下の整数を入力してください'),
});

export const practiceLogSchema = z.object({
  practicedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください'),
  longToneMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tonguingMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tonguingTempoBpms: z.array(tonguingBpmEntrySchema).optional(),
  memo: z.string().optional(),
  textbookEntries: z.array(textbookEntrySchema),
});

export type PracticeLogInput = z.infer<typeof practiceLogSchema>;

export function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest forms/__tests__/practice-log.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add forms/practice-log.ts forms/__tests__/practice-log.test.ts
git commit -m "feat: tonguingTempoBpm を tonguingTempoBpms 配列に変更"
```

---

## Task 3: ストア変更 (TDD)

**Files:**

- Modify: `store/practice-log.ts`
- Modify: `store/__tests__/practice-log.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`store/__tests__/practice-log.test.ts` を以下の通り変更する。

`fetchAll` テスト内の mock データ (57〜60行) を変更:

```typescript
// 変更前
{ menu_type: 'long_tone', duration_minutes: 15, tempo_bpm: null },
{ menu_type: 'tonguing', duration_minutes: 10, tempo_bpm: null },

// 変更後
{ menu_type: 'long_tone', duration_minutes: 15, tempo_bpms: null },
{ menu_type: 'tonguing', duration_minutes: 10, tempo_bpms: null },
```

`fetchAll` テスト内のアサーション (84〜87行) を変更:

```typescript
// 変更前
expect(sessions[0].basicMenuEntries).toEqual([
  { menuType: 'long_tone', durationMinutes: 15, tempoBpm: null },
  { menuType: 'tonguing', durationMinutes: 10, tempoBpm: null },
]);

// 変更後
expect(sessions[0].basicMenuEntries).toEqual([
  { menuType: 'long_tone', durationMinutes: 15, tempoBpms: [] },
  { menuType: 'tonguing', durationMinutes: 10, tempoBpms: [] },
]);
```

`add で基礎練習あり` テスト内のアサーション (154〜157行) を変更:

```typescript
// 変更前
expect(sessions[0].basicMenuEntries).toEqual([
  { menuType: 'long_tone', durationMinutes: 15, tempoBpm: null },
  { menuType: 'tonguing', durationMinutes: 10, tempoBpm: null },
]);

// 変更後
expect(sessions[0].basicMenuEntries).toEqual([
  { menuType: 'long_tone', durationMinutes: 15, tempoBpms: [] },
  { menuType: 'tonguing', durationMinutes: 10, tempoBpms: [] },
]);
```

`add で tonguingTempoBpm を渡すと...` テスト (168〜194行) を以下2テストに置き換える:

```typescript
it('add で tonguingTempoBpms を渡すと basicMenuEntries に tempoBpms が入る', async () => {
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
    tonguingTempoBpms: [{ bpm: 80 }, { bpm: 120 }],
    textbookEntries: [],
  });

  const sessions = usePracticeLogStore.getState().sessions;
  expect(sessions[0].basicMenuEntries).toEqual([
    { menuType: 'tonguing', durationMinutes: 15, tempoBpms: [80, 120] },
  ]);
});

it('add で tonguingTempoBpms が空のとき tempoBpms が空配列になる', async () => {
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
    tonguingTempoBpms: [],
    textbookEntries: [],
  });

  const sessions = usePracticeLogStore.getState().sessions;
  expect(sessions[0].basicMenuEntries).toEqual([
    { menuType: 'tonguing', durationMinutes: 15, tempoBpms: [] },
  ]);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest store/__tests__/practice-log.test.ts
```

Expected: `tempoBpm` / `tempo_bpm` 参照でテストが FAIL する。

- [ ] **Step 3: ストアを実装する**

`store/practice-log.ts` を以下に置き換える:

```typescript
import { create } from 'zustand';

import { type PracticeLogInput } from '@/forms/practice-log';
import { supabase } from '@/lib/supabase';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTextbookProgressStore } from '@/store/textbook-progress';

type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  totalPages: number | null;
};

type BasicMenuEntry = {
  menuType: string;
  durationMinutes: number;
  tempoBpms: number[];
};

export type PracticeSession = {
  id: string;
  practicedAt: string;
  durationMinutes: number | null;
  memo: string | null;
  textbookEntries: TextbookEntry[];
  basicMenuEntries: BasicMenuEntry[];
};

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
    tempo_bpms: number[] | null;
  }[];
};

type PracticeLogState = {
  sessions: PracticeSession[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: PracticeLogInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const usePracticeLogStore = create<PracticeLogState>()((set, get) => ({
  sessions: [],
  loading: false,

  fetchAll: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    set({ loading: true });
    const { data, error } = await supabase
      .from('practice_sessions')
      .select(
        'id, practiced_at, duration_minutes, memo, ' +
          'practice_session_textbooks ( textbook_id, current_page, textbooks ( title, total_pages ) ), ' +
          'practice_session_basic_menus ( menu_type, duration_minutes, tempo_bpms )',
      )
      .order('practiced_at', { ascending: false });
    set({ loading: false });

    if (error || !data) return;

    const rows = data as unknown as SessionRow[];
    set({
      sessions: rows.map((row) => ({
        id: row.id,
        practicedAt: row.practiced_at,
        durationMinutes: row.duration_minutes ?? null,
        memo: row.memo ?? null,
        textbookEntries: (row.practice_session_textbooks ?? []).map((entry) => ({
          textbookId: entry.textbook_id,
          textbookTitle: entry.textbooks?.title ?? '',
          currentPage: entry.current_page,
          totalPages: entry.textbooks?.total_pages ?? null,
        })),
        basicMenuEntries: (row.practice_session_basic_menus ?? []).map((m) => ({
          menuType: m.menu_type,
          durationMinutes: m.duration_minutes,
          tempoBpms: m.tempo_bpms ?? [],
        })),
      })),
    });
  },

  add: async (input: PracticeLogInput) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const totalDuration = (input.longToneMinutes ?? 0) + (input.tonguingMinutes ?? 0);

    const { data: session, error: sessionError } = await supabase
      .from('practice_sessions')
      .insert({
        user_id: userData.user.id,
        practiced_at: input.practicedAt,
        duration_minutes: totalDuration > 0 ? totalDuration : null,
        memo: input.memo || null,
      })
      .select()
      .single();
    if (sessionError || !session) return;

    const sessionId = (session as { id: string }).id;

    if (input.textbookEntries.length > 0) {
      const { error: entriesError } = await supabase.from('practice_session_textbooks').insert(
        input.textbookEntries.map((entry) => ({
          session_id: sessionId,
          textbook_id: entry.textbookId,
          current_page: entry.currentPage,
        })),
      );
      if (entriesError) {
        await supabase.from('practice_sessions').delete().eq('id', sessionId);
        return;
      }

      for (const entry of input.textbookEntries) {
        await useTextbookProgressStore.getState().upsert(entry.textbookId, entry.currentPage);
      }
    }

    const basicMenuRows = [
      ...(input.longToneMinutes != null
        ? [
            {
              session_id: sessionId,
              menu_type: 'long_tone' as const,
              duration_minutes: input.longToneMinutes,
              tempo_bpms: null as number[] | null,
            },
          ]
        : []),
      ...(input.tonguingMinutes != null
        ? [
            {
              session_id: sessionId,
              menu_type: 'tonguing' as const,
              duration_minutes: input.tonguingMinutes,
              tempo_bpms: input.tonguingTempoBpms?.length
                ? input.tonguingTempoBpms.map((e) => e.bpm)
                : null,
            },
          ]
        : []),
    ];

    if (basicMenuRows.length > 0) {
      const { error: basicError } = await supabase
        .from('practice_session_basic_menus')
        .insert(basicMenuRows);
      if (basicError) {
        await supabase.from('practice_sessions').delete().eq('id', sessionId);
        return;
      }
    }

    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;
    const newSession: PracticeSession = {
      id: sessionId,
      practicedAt: input.practicedAt,
      durationMinutes: totalDuration > 0 ? totalDuration : null,
      memo: input.memo || null,
      textbookEntries: input.textbookEntries.map((entry) => {
        const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
        return {
          textbookId: entry.textbookId,
          textbookTitle: tb?.title ?? '',
          currentPage: entry.currentPage,
          totalPages: tb?.totalPages ?? null,
        };
      }),
      basicMenuEntries: basicMenuRows.map((r) => ({
        menuType: r.menu_type,
        durationMinutes: r.duration_minutes,
        tempoBpms: r.tempo_bpms ?? [],
      })),
    };
    set({ sessions: [newSession, ...get().sessions] });
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('practice_sessions').delete().eq('id', id);
    if (error) return;
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  },
}));
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest store/__tests__/practice-log.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add store/practice-log.ts store/__tests__/practice-log.test.ts
git commit -m "feat: ストアの tempoBpm を tempoBpms 配列に変更"
```

---

## Task 4: フォームUI変更 (TDD)

**Files:**

- Modify: `components/practice-log-form.tsx`
- Modify: `__tests__/integration/practice-log-form.integration.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`__tests__/integration/practice-log-form.integration.test.tsx` で以下の変更を行う。

**既存のBPM関連テスト4件 (189〜239行) を以下に置き換える:**

```typescript
it('タンギングに値を入力すると「テンポを追加」ボタンが表示される', async () => {
  renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
  expect(screen.queryByLabelText('テンポを追加')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
  await waitFor(() => {
    expect(screen.getByLabelText('テンポを追加')).toBeTruthy();
  });
});

it('タンギングの値を消すと「テンポを追加」ボタンが非表示になる', async () => {
  renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
  await waitFor(() => {
    expect(screen.getByLabelText('テンポを追加')).toBeTruthy();
  });
  fireEvent.changeText(screen.getByLabelText('タンギング'), '');
  await waitFor(() => {
    expect(screen.queryByLabelText('テンポを追加')).toBeNull();
  });
});

it('「テンポを追加」を押すと BPM 入力欄が追加される', async () => {
  renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
  await waitFor(() => {
    expect(screen.getByLabelText('テンポを追加')).toBeTruthy();
  });
  fireEvent.press(screen.getByLabelText('テンポを追加'));
  expect(screen.getByLabelText('BPM 1')).toBeTruthy();
  expect(screen.getByLabelText('BPM 1 を削除')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('テンポを追加'));
  expect(screen.getByLabelText('BPM 2')).toBeTruthy();
});

it('BPM 入力欄を削除できる', async () => {
  renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
  await waitFor(() => {
    expect(screen.getByLabelText('テンポを追加')).toBeTruthy();
  });
  fireEvent.press(screen.getByLabelText('テンポを追加'));
  expect(screen.getByLabelText('BPM 1')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('BPM 1 を削除'));
  await waitFor(() => {
    expect(screen.queryByLabelText('BPM 1')).toBeNull();
  });
});

it('BPM に 39 を入力して保存するとバリデーションエラーが表示される', async () => {
  renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
  await waitFor(() => {
    expect(screen.getByLabelText('テンポを追加')).toBeTruthy();
  });
  fireEvent.press(screen.getByLabelText('テンポを追加'));
  fireEvent.changeText(screen.getByLabelText('BPM 1'), '39');
  fireEvent.press(screen.getByLabelText('保存'));
  await waitFor(() => {
    expect(screen.getByText('40以上の整数を入力してください')).toBeTruthy();
  });
});

it('BPM を複数入力して保存すると onSubmit に tonguingTempoBpms が含まれる', async () => {
  const onSubmit = jest.fn();
  renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
  fireEvent.changeText(screen.getByLabelText('タンギング'), '15');
  await waitFor(() => {
    expect(screen.getByLabelText('テンポを追加')).toBeTruthy();
  });
  fireEvent.press(screen.getByLabelText('テンポを追加'));
  fireEvent.press(screen.getByLabelText('テンポを追加'));
  fireEvent.changeText(screen.getByLabelText('BPM 1'), '80');
  fireEvent.changeText(screen.getByLabelText('BPM 2'), '120');
  fireEvent.press(screen.getByLabelText('保存'));
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
  expect(onSubmit.mock.calls[0][0]).toMatchObject({
    tonguingMinutes: 15,
    tonguingTempoBpms: [{ bpm: 80 }, { bpm: 120 }],
  });
});
```

**ファイル末尾（`});` の直前）に教本デフォルトテストを追加する:**

```typescript
describe('教本デフォルト値', () => {
  it('前回セッションの教本が初期値として表示される', async () => {
    const { usePracticeLogStore } = await import('@/store/practice-log');
    usePracticeLogStore.setState({
      sessions: [
        {
          id: 'prev-session',
          practicedAt: '2026-05-14',
          durationMinutes: 20,
          memo: null,
          textbookEntries: [
            {
              textbookId: TB1_ID,
              textbookTitle: 'ローズ 32のエチュード',
              currentPage: 14,
              totalPages: 32,
            },
          ],
          basicMenuEntries: [],
        },
      ],
      loading: false,
    });

    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText('ページ 1')).toBeTruthy();
    });
    expect(screen.getByDisplayValue('14')).toBeTruthy();
  });

  it('カタログに存在しない教本は除外される', async () => {
    const { usePracticeLogStore } = await import('@/store/practice-log');
    usePracticeLogStore.setState({
      sessions: [
        {
          id: 'prev-session',
          practicedAt: '2026-05-14',
          durationMinutes: 20,
          memo: null,
          textbookEntries: [
            {
              textbookId: 'deleted-textbook-id-that-is-not-a-valid-uuid',
              textbookTitle: '削除済み教本',
              currentPage: 5,
              totalPages: null,
            },
          ],
          basicMenuEntries: [],
        },
      ],
      loading: false,
    });

    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);

    await waitFor(() => {
      expect(screen.queryByLabelText('ページ 1')).toBeNull();
    });
  });

  it('前回セッションがない場合は教本エントリが空', () => {
    const { usePracticeLogStore } = await import('@/store/practice-log');
    usePracticeLogStore.setState({ sessions: [], loading: false });

    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);

    expect(screen.queryByLabelText('ページ 1')).toBeNull();
  });
});
```

また、`beforeEach` に `usePracticeLogStore` のリセットを追加する（現在の `beforeEach` ブロックに追記）:

```typescript
beforeEach(async () => {
  await AsyncStorage.clear();
  // 既存コード...
  jest.clearAllMocks();
  // 追加
  const { usePracticeLogStore } = await import('@/store/practice-log');
  usePracticeLogStore.setState({ sessions: [], loading: false });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest __tests__/integration/practice-log-form.integration.test.tsx
```

Expected: 新しいBPMテストと教本デフォルトテストが FAIL する。

- [ ] **Step 3: フォームコンポーネントを実装する**

`components/practice-log-form.tsx` を以下に置き換える:

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Platform, ScrollView } from 'react-native';
import { Button, Input, Paragraph, Select, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import {
  BASIC_MENUS,
  formatDate,
  type PracticeLogInput,
  practiceLogSchema,
  today,
} from '@/forms/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

type Props = {
  onSubmit: (data: PracticeLogInput) => void | Promise<void>;
};

export type PracticeLogFormRef = {
  submit: () => void;
};

export const PracticeLogForm = forwardRef<PracticeLogFormRef, Props>(function PracticeLogForm(
  { onSubmit },
  ref,
) {
  const textbooks = useTextbookCatalogStore((s) => s.textbooks);
  const sessions = usePracticeLogStore((s) => s.sessions);
  const [showPicker, setShowPicker] = useState(false);

  const textbookIds = new Set(textbooks.map((t) => t.id));
  const lastTextbookEntries = (sessions[0]?.textbookEntries ?? [])
    .filter((e) => textbookIds.has(e.textbookId))
    .map((e) => ({ textbookId: e.textbookId, currentPage: e.currentPage }));

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PracticeLogInput>({
    resolver: zodResolver(practiceLogSchema),
    mode: 'onTouched',
    defaultValues: {
      practicedAt: today(),
      longToneMinutes: undefined,
      tonguingMinutes: undefined,
      tonguingTempoBpms: [],
      memo: '',
      textbookEntries: lastTextbookEntries,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'textbookEntries' });
  const {
    fields: bpmFields,
    append: appendBpm,
    remove: removeBpm,
  } = useFieldArray({ control, name: 'tonguingTempoBpms' });
  const watchedEntries = watch('textbookEntries') ?? [];
  const watchedLongTone = watch('longToneMinutes');
  const watchedTonguing = useWatch({ control, name: 'tonguingMinutes' });
  const totalMinutes = (watchedLongTone ?? 0) + (watchedTonguing ?? 0);

  const submitForm = handleSubmit(onSubmit);
  useImperativeHandle(ref, () => ({ submit: submitForm }));

  return (
    <ScrollView>
      <YStack gap="$4" p="$4">
        {/* 日付 */}
        <Controller
          control={control}
          name="practicedAt"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph color="$color12">日付 *</Paragraph>
              <XStack gap="$2" items="center">
                <Input
                  flex={1}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="YYYY-MM-DD"
                  aria-label="日付"
                />
                {Platform.OS !== 'web' && (
                  <Button size="$2" onPress={() => setShowPicker(true)} aria-label="カレンダー">
                    カレンダー
                  </Button>
                )}
              </XStack>
              {showPicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={(() => {
                    const parts = value.split('-');
                    if (parts.length === 3) {
                      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    }
                    return new Date();
                  })()}
                  mode="date"
                  onChange={(_, date) => {
                    setShowPicker(false);
                    if (date) onChange(formatDate(date));
                  }}
                />
              )}
              <FieldError message={errors.practicedAt?.message} />
            </YStack>
          )}
        />

        {/* 基礎練習 */}
        <YStack gap="$2">
          <Paragraph color="$color12">基礎練習</Paragraph>

          {BASIC_MENUS.map(({ type, label }) => {
            const fieldName = type === 'long_tone' ? 'longToneMinutes' : 'tonguingMinutes';
            const ariaLabel = type === 'long_tone' ? 'ロングトーン' : 'タンギング';
            return (
              <Controller
                key={type}
                control={control}
                name={fieldName}
                render={({ field: { onChange, onBlur, value } }) => (
                  <YStack gap="$1">
                    <Paragraph color="$color11" fontSize="$3">
                      {label}（分）任意
                    </Paragraph>
                    <Input
                      value={value !== undefined ? String(value) : ''}
                      onChangeText={(t) => {
                        const n = Number(t);
                        onChange(t === '' || isNaN(n) ? undefined : n);
                      }}
                      onBlur={onBlur}
                      placeholder="例: 10"
                      keyboardType="numeric"
                      aria-label={ariaLabel}
                    />
                    <FieldError message={errors[fieldName]?.message} />
                  </YStack>
                )}
              />
            );
          })}

          {watchedTonguing !== undefined && (
            <YStack gap="$2">
              <Paragraph color="$color11" fontSize="$3">
                テンポ（BPM）任意
              </Paragraph>
              {bpmFields.map((field, index) => (
                <YStack key={field.id} gap="$1">
                  <XStack gap="$2" items="center">
                    <Controller
                      control={control}
                      name={`tonguingTempoBpms.${index}.bpm`}
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          flex={1}
                          value={value !== undefined ? String(value) : ''}
                          onChangeText={(t) => {
                            const n = Number(t);
                            onChange(t === '' || isNaN(n) ? undefined : n);
                          }}
                          onBlur={onBlur}
                          placeholder="例: 120"
                          keyboardType="numeric"
                          aria-label={`BPM ${index + 1}`}
                        />
                      )}
                    />
                    <Button
                      size="$2"
                      theme="red"
                      onPress={() => removeBpm(index)}
                      aria-label={`BPM ${index + 1} を削除`}
                    >
                      ✕
                    </Button>
                  </XStack>
                  <FieldError message={errors.tonguingTempoBpms?.[index]?.bpm?.message} />
                </YStack>
              ))}
              <Button
                onPress={() => appendBpm({} as { bpm: number })}
                aria-label="テンポを追加"
              >
                ＋ テンポを追加
              </Button>
            </YStack>
          )}

          {totalMinutes > 0 && (
            <Paragraph fontSize="$2" color="$color10">
              合計: {totalMinutes}分
            </Paragraph>
          )}
        </YStack>

        {/* メモ */}
        <Controller
          control={control}
          name="memo"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph color="$color12">メモ 任意</Paragraph>
              <Input
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="自由記入"
                multiline
                numberOfLines={3}
                aria-label="メモ"
              />
            </YStack>
          )}
        />

        {/* 教本の進捗 */}
        <YStack gap="$2">
          <Paragraph color="$color12">教本の進捗</Paragraph>

          {fields.map((field, index) => {
            const otherSelectedIds = new Set(
              watchedEntries
                .filter((_, i) => i !== index)
                .map((e) => e.textbookId)
                .filter(Boolean),
            );
            const selectedTextbookId = watchedEntries[index]?.textbookId;
            const selectedTextbook = textbooks.find((tb) => tb.id === selectedTextbookId);

            return (
              <YStack key={field.id} gap="$2" p="$3" bg="$color2" rounded="$3">
                <XStack gap="$2" items="center">
                  <Controller
                    control={control}
                    name={`textbookEntries.${index}.textbookId`}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <YStack flex={1} gap="$1">
                        <Select value={value} onValueChange={onChange}>
                          <Select.Trigger
                            flex={1}
                            onBlur={onBlur}
                            aria-label={`教本を選択 ${index + 1}`}
                          >
                            <Select.Value placeholder="教本を選択" />
                          </Select.Trigger>
                          <Select.Content>
                            <Select.ScrollUpButton />
                            <Select.Viewport>
                              {textbooks.map((tb, i) => (
                                <Select.Item
                                  key={tb.id}
                                  index={i}
                                  value={tb.id}
                                  disabled={otherSelectedIds.has(tb.id)}
                                >
                                  <Select.ItemText>{tb.title}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Viewport>
                            <Select.ScrollDownButton />
                          </Select.Content>
                        </Select>
                        <FieldError
                          message={errors.textbookEntries?.[index]?.textbookId?.message}
                        />
                      </YStack>
                    )}
                  />
                  <Button
                    size="$2"
                    theme="red"
                    onPress={() => remove(index)}
                    aria-label={`エントリ ${index + 1} を削除`}
                  >
                    ✕
                  </Button>
                </XStack>

                <YStack gap="$1">
                  <XStack gap="$2" items="center">
                    <Paragraph fontSize="$2" color="$color10">
                      現在ページ:
                    </Paragraph>
                    <Controller
                      control={control}
                      name={`textbookEntries.${index}.currentPage`}
                      render={({ field: { onChange, onBlur, value } }) => (
                        <XStack gap="$2" items="center">
                          <Input
                            width={64}
                            value={value !== undefined ? String(value) : ''}
                            onChangeText={(t) => {
                              const n = Number(t);
                              onChange(t === '' || isNaN(n) ? undefined : n);
                            }}
                            onBlur={onBlur}
                            keyboardType="numeric"
                            aria-label={`ページ ${index + 1}`}
                          />
                          {selectedTextbook?.totalPages != null && (
                            <Paragraph fontSize="$2" color="$color10">
                              / {selectedTextbook.totalPages}
                            </Paragraph>
                          )}
                        </XStack>
                      )}
                    />
                  </XStack>
                  <FieldError message={errors.textbookEntries?.[index]?.currentPage?.message} />
                </YStack>
              </YStack>
            );
          })}

          <Button
            onPress={() => append({ textbookId: '', currentPage: 0 })}
            aria-label="教本を追加"
          >
            ＋ 教本を追加
          </Button>
        </YStack>

        <Button theme="blue" onPress={submitForm} disabled={isSubmitting} aria-label="保存">
          保存
        </Button>
      </YStack>
    </ScrollView>
  );
});
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest __tests__/integration/practice-log-form.integration.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add components/practice-log-form.tsx __tests__/integration/practice-log-form.integration.test.tsx
git commit -m "feat: タンギング複数BPM入力・教本デフォルト値を実装"
```

---

## Task 5: 画面変更 (TDD)

**Files:**

- Modify: `app/(tabs)/index.tsx`
- Modify: `__tests__/integration/practice-log-screen.integration.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`__tests__/integration/practice-log-screen.integration.test.tsx` のファイル末尾（最後の `});` の直前）に以下を追加:

```typescript
it('今月に記録がある場合は PracticeChart が描画される', () => {
  usePracticeLogStore.setState({
    sessions: [makeSession('s1', THIS_DATE, 30)],
    loading: false,
  });
  renderWithProviders(<PracticeLogScreen />);
  expect(screen.getByLabelText('月別練習グラフ')).toBeTruthy();
});

it('今月に記録がない場合は PracticeChart が描画されない', async () => {
  usePracticeLogStore.setState({
    sessions: [makeSession('s2', PREV_DATE, 45)],
    loading: false,
  });
  renderWithProviders(<PracticeLogScreen />);
  expect(screen.queryByLabelText('月別練習グラフ')).toBeNull();
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest __tests__/integration/practice-log-screen.integration.test.tsx
```

Expected: グラフ表示テスト2件が FAIL する（`aria-label` が付いていない / 常時表示のため）。

- [ ] **Step 3: 画面を実装する**

`app/(tabs)/index.tsx` を以下に置き換える:

```typescript
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
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
            {monthSessions.length > 0 && (
              <View aria-label="月別練習グラフ">
                <PracticeChart sessions={monthSessions} month={selectedMonth} />
              </View>
            )}
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
                      entry.menuType === 'tonguing' && entry.tempoBpms.length > 0
                        ? ` ♩=${entry.tempoBpms.join(', ')}`
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

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest __tests__/integration/practice-log-screen.integration.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
git add app/\(tabs\)/index.tsx __tests__/integration/practice-log-screen.integration.test.tsx
git commit -m "feat: グラフ条件表示と複数BPM表示を実装"
```

---

## Task 6: 品質チェック

- [ ] **Step 1: ESLint**

```bash
npm run lint
```

Expected: エラー 0 件。エラーがあれば `npm run lint:fix` で修正後、再実行。

- [ ] **Step 2: Prettier**

```bash
npm run format:check
```

Expected: 差分 0 件。差分があれば `npm run format` で整形後、再実行。

- [ ] **Step 3: TypeScript**

```bash
npx tsc --noEmit
```

Expected: エラー 0 件。

- [ ] **Step 4: 全テスト**

```bash
npm test
```

Expected: 全テスト PASS。

- [ ] **Step 5: 最終コミット（差分がある場合のみ）**

lint/format の自動修正で変更があった場合:

```bash
git add -p
git commit -m "style: lint/format 自動修正"
```
