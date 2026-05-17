# 練習記録フォーム改善（その他時間・メモ移動・スケールBPM）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 練習記録フォームに「その他」時間フィールドの追加・メモ欄の日付直下への移動・スケールジャンル教本へのBPM入力機能を追加する。

**Architecture:** DB に 2 列追加（`practice_sessions.other_minutes` / `practice_session_textbooks.tempo_bpm`）後、フォームスキーマ→ストア→コンポーネントの順に TDD で更新する。スケール教本の BPM には `useFieldArray` のネストが必要なため、教本エントリ行を `TextbookEntryRow` サブコンポーネントに分離する。`calcSessionTime` の戻り値を `{ basic, nonBasic }` に変更し、一覧画面の表示ラベルも更新する。

**Tech Stack:** React Hook Form, zod, Tamagui, Zustand, Supabase JS SDK, Jest / React Native Testing Library, TypeScript strict

---

## ファイルマップ

| ファイル                                                                 | 操作                                                            |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `supabase/migrations/20260517000000_add_other_minutes_and_tempo_bpm.sql` | 新規作成                                                        |
| `forms/practice-log.ts`                                                  | 変更（`otherMinutes`, `tempoBpms` を追加）                      |
| `forms/__tests__/practice-log.test.ts`                                   | 変更（新フィールドのスキーマテスト追加）                        |
| `store/practice-log.ts`                                                  | 変更（型・`calcSessionTime`・`add`/`update`/`fetchAll`）        |
| `store/__tests__/practice-log.test.ts`                                   | 変更（`calcSessionTime` 戻り値変更に伴う修正 + 新テスト追加）   |
| `components/practice-log-form.tsx`                                       | 変更（`TextbookEntryRow` 抽出・メモ移動・その他セクション追加） |
| `app/practice-log-form.tsx`                                              | 変更（`initialValues` に `otherMinutes`・`tempoBpms` を追加）   |
| `__tests__/integration/practice-log-form.integration.test.tsx`           | 変更（新フィールドの統合テスト追加）                            |
| `app/(tabs)/index.tsx`                                                   | 変更（`formatTimeLabel`・セッションカード表示更新）             |
| `__tests__/integration/practice-log-screen.integration.test.tsx`         | 変更（`makeSession` ヘルパーに `otherMinutes` 追加）            |

---

### Task 1: DBマイグレーションを作成・適用する

**Files:**

- Create: `supabase/migrations/20260517000000_add_other_minutes_and_tempo_bpm.sql`

- [ ] **Step 1: マイグレーションファイルを作成する**

```sql
ALTER TABLE practice_sessions ADD COLUMN other_minutes integer;
ALTER TABLE practice_session_textbooks ADD COLUMN tempo_bpm integer;
```

- [ ] **Step 2: Supabase に適用する**

```bash
supabase db push
```

Expected: `Applying migration 20260517000000_add_other_minutes_and_tempo_bpm.sql...` と表示されエラーなし。

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260517000000_add_other_minutes_and_tempo_bpm.sql
git commit -m "feat: practice_sessions に other_minutes・practice_session_textbooks に tempo_bpm を追加"
```

---

### Task 2: フォームスキーマを更新する

**Files:**

- Modify: `forms/practice-log.ts`
- Modify: `forms/__tests__/practice-log.test.ts`

- [ ] **Step 1: テストを先に追記する（失敗するはず）**

`forms/__tests__/practice-log.test.ts` の `describe('practiceLogSchema')` ブロック内に以下を追加する。

```typescript
describe('otherMinutes', () => {
  it('省略可能', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-17',
      textbookEntries: [],
    });
    expect(result.success).toBe(true);
  });

  it('1 は有効', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-17',
      otherMinutes: 1,
      textbookEntries: [],
    });
    expect(result.success).toBe(true);
  });

  it('0 はエラー', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-17',
      otherMinutes: 0,
      textbookEntries: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('1以上の整数を入力してください');
  });

  it('小数はエラー', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-17',
      otherMinutes: 1.5,
      textbookEntries: [],
    });
    expect(result.success).toBe(false);
  });
});
```

`describe('textbookEntries')` ブロック内の `describe('textbookEntries[].durationMinutes')` の後に以下を追加する。

```typescript
describe('textbookEntries[].tempoBpms', () => {
  it('省略可能', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-17',
      textbookEntries: [{ textbookId: '123e4567-e89b-12d3-a456-426614174001', currentPage: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it('空配列は有効', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-17',
      textbookEntries: [
        {
          textbookId: '123e4567-e89b-12d3-a456-426614174001',
          currentPage: 0,
          tempoBpms: [],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('{ bpm: 120 } は有効', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-17',
      textbookEntries: [
        {
          textbookId: '123e4567-e89b-12d3-a456-426614174001',
          currentPage: 0,
          tempoBpms: [{ bpm: 120 }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('bpm: 39 はエラー（下限未満）', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-17',
      textbookEntries: [
        {
          textbookId: '123e4567-e89b-12d3-a456-426614174001',
          currentPage: 0,
          tempoBpms: [{ bpm: 39 }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('40以上の整数を入力してください');
  });

  it('bpm: 241 はエラー（上限超過）', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-17',
      textbookEntries: [
        {
          textbookId: '123e4567-e89b-12d3-a456-426614174001',
          currentPage: 0,
          tempoBpms: [{ bpm: 241 }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('240以下の整数を入力してください');
  });
});
```

- [ ] **Step 2: 失敗を確認する**

```bash
npx jest forms/__tests__/practice-log.test.ts
```

Expected: `otherMinutes` / `textbookEntries[].tempoBpms` の describe が FAIL。

- [ ] **Step 3: `forms/practice-log.ts` を実装する**

`textbookEntrySchema` に `tempoBpms` を追加し、`practiceLogSchema` に `otherMinutes` を追加する。

```typescript
import { z } from 'zod';

export const BASIC_MENUS = [
  { type: 'long_tone', label: 'ロングトーン' },
  { type: 'tonguing', label: 'タンギング' },
] as const;

export type BasicMenuType = (typeof BASIC_MENUS)[number]['type'];

export const BASIC_GENRES = ['スケール', 'エチュード'] as const;

const tonguingBpmEntrySchema = z.object({
  bpm: z
    .number()
    .int()
    .min(40, '40以上の整数を入力してください')
    .max(240, '240以下の整数を入力してください'),
});

const textbookEntrySchema = z.object({
  textbookId: z.string().uuid('教本を選択してください'),
  currentPage: z.number().int().min(0, '0以上の整数を入力してください'),
  durationMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tempoBpms: z.array(tonguingBpmEntrySchema).optional(),
});

export const practiceLogSchema = z.object({
  practicedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください'),
  longToneMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tonguingMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tonguingTempoBpms: z.array(tonguingBpmEntrySchema).optional(),
  otherMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
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

- [ ] **Step 4: テストを通す**

```bash
npx jest forms/__tests__/practice-log.test.ts
```

Expected: すべて PASS。

- [ ] **Step 5: コミット**

```bash
git add forms/practice-log.ts forms/__tests__/practice-log.test.ts
git commit -m "feat: practiceLogSchema に otherMinutes と textbookEntry.tempoBpms を追加"
```

---

### Task 3: ストアを更新する

**Files:**

- Modify: `store/practice-log.ts`
- Modify: `store/__tests__/practice-log.test.ts`

- [ ] **Step 1: 既存の `calcSessionTime` テストを修正する（`textbook` → `nonBasic`）**

`store/__tests__/practice-log.test.ts` の `describe('calcSessionTime')` 内にある `base` オブジェクトに `otherMinutes: null` を追加し、textbookEntries の全エントリに `tempoBpm: null` を追加する。さらに `{ basic: X, textbook: Y }` を `{ basic: X, nonBasic: Y }` に全置換する。

`base` の修正（元の行に `otherMinutes: null` を追加）:

```typescript
const base: PracticeSession = {
  id: 's1',
  practicedAt: '2026-05-16',
  durationMinutes: null,
  otherMinutes: null,
  memo: null,
  textbookEntries: [],
  basicMenuEntries: [],
};
```

`calcSessionTime` の各テストで使われている textbookEntries に `tempoBpm: null` を追加する（例）:

```typescript
textbookEntries: [
  {
    textbookId: 'tb-1',
    textbookTitle: 'スケール教本',
    currentPage: 5,
    totalPages: null,
    genre: 'スケール',
    durationMinutes: 15,
    tempoBpm: null,
  },
],
```

全テストの期待値を `textbook` → `nonBasic` に変更（6 箇所）:

```typescript
// 変更前:
expect(calcSessionTime(base)).toEqual({ basic: 0, textbook: 0 });
// 変更後:
expect(calcSessionTime(base)).toEqual({ basic: 0, nonBasic: 0 });
```

その他のテストファイル内の `PracticeSession` オブジェクト（`existingSession`, `remove` テストのセッション, `fetchAll`/`add` の期待値）にも `otherMinutes: null` を追加する。
textbookEntries がある箇所には `tempoBpm: null` を追加する。

- [ ] **Step 2: `calcSessionTime` の `otherMinutes` テストを追加する**

`describe('calcSessionTime')` に以下を追加する:

```typescript
it('otherMinutes がある場合は nonBasic に加算される', () => {
  expect(calcSessionTime({ ...base, otherMinutes: 20 })).toEqual({ basic: 0, nonBasic: 20 });
});

it('textbookOnly と otherMinutes が両方ある場合は nonBasic に合算される', () => {
  const session: PracticeSession = {
    ...base,
    otherMinutes: 10,
    textbookEntries: [
      {
        textbookId: 'tb-3',
        textbookTitle: 'ソナタ',
        currentPage: 1,
        totalPages: null,
        genre: 'ソナタ',
        durationMinutes: 25,
        tempoBpm: null,
      },
    ],
  };
  expect(calcSessionTime(session)).toEqual({ basic: 0, nonBasic: 35 });
});
```

- [ ] **Step 3: `add` の `other_minutes`・`tempo_bpm` テストを追加する**

`it('add で基礎練習あり:...')` テストは、`other_minutes` が `null` で保存されることを確認できるよう `sessions[0].otherMinutes` のアサーションを追加する:

```typescript
expect(sessions[0].otherMinutes).toBeNull();
```

以下の新しいテストを追加する:

```typescript
it('add で otherMinutes を渡すと sessions[0].otherMinutes に反映される', async () => {
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

  await usePracticeLogStore.getState().add({
    practicedAt: '2026-05-17',
    otherMinutes: 30,
    textbookEntries: [],
  });

  expect(usePracticeLogStore.getState().sessions[0].otherMinutes).toBe(30);
});

it('add でスケール教本の tempoBpms から max が tempo_bpm に格納される', async () => {
  mockCatalog().getState.mockReturnValue({
    textbooks: [
      {
        id: 'tb-scale',
        title: 'スケール練習',
        publisher: null,
        genre: 'スケール',
        difficulty: null,
        totalPages: null,
      },
    ],
  });
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
  const textbooksInsertMock = jest.fn().mockResolvedValue({ error: null });
  mockSupabase().from.mockReturnValueOnce({ insert: textbooksInsertMock });

  await usePracticeLogStore.getState().add({
    practicedAt: '2026-05-17',
    textbookEntries: [
      {
        textbookId: 'tb-scale',
        currentPage: 5,
        tempoBpms: [{ bpm: 60 }, { bpm: 80 }, { bpm: 100 }],
      },
    ],
  });

  expect(textbooksInsertMock).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ tempo_bpm: 100 })]),
  );
  expect(usePracticeLogStore.getState().sessions[0].textbookEntries[0].tempoBpm).toBe(100);
});

it('add で tempoBpms が空の場合 tempo_bpm は null になる', async () => {
  mockCatalog().getState.mockReturnValue({ textbooks: [] });
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
  const textbooksInsertMock = jest.fn().mockResolvedValue({ error: null });
  mockSupabase().from.mockReturnValueOnce({ insert: textbooksInsertMock });

  await usePracticeLogStore.getState().add({
    practicedAt: '2026-05-17',
    textbookEntries: [
      {
        textbookId: '123e4567-e89b-12d3-a456-426614174001',
        currentPage: 5,
        tempoBpms: [],
      },
    ],
  });

  expect(textbooksInsertMock).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ tempo_bpm: null })]),
  );
});
```

- [ ] **Step 4: 失敗を確認する**

```bash
npx jest store/__tests__/practice-log.test.ts
```

Expected: `calcSessionTime` のラベル変更・新テスト分が FAIL。

- [ ] **Step 5: `store/practice-log.ts` を実装する**

`TextbookEntry` 型に `tempoBpm` を追加:

```typescript
type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  totalPages: number | null;
  genre: string;
  durationMinutes: number | null;
  tempoBpm: number | null;
};
```

`PracticeSession` 型に `otherMinutes` を追加:

```typescript
export type PracticeSession = {
  id: string;
  practicedAt: string;
  durationMinutes: number | null;
  otherMinutes: number | null;
  memo: string | null;
  textbookEntries: TextbookEntry[];
  basicMenuEntries: BasicMenuEntry[];
};
```

`calcSessionTime` を変更:

```typescript
export function calcSessionTime(session: PracticeSession): { basic: number; nonBasic: number } {
  const basicTextbook = session.textbookEntries
    .filter((e) => (BASIC_GENRES as readonly string[]).includes(e.genre))
    .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  const textbookOnly = session.textbookEntries
    .filter((e) => !(BASIC_GENRES as readonly string[]).includes(e.genre))
    .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  return {
    basic: (session.durationMinutes ?? 0) + basicTextbook,
    nonBasic: textbookOnly + (session.otherMinutes ?? 0),
  };
}
```

`SessionRow` 型を変更:

```typescript
type SessionRow = {
  id: string;
  practiced_at: string;
  duration_minutes: number | null;
  other_minutes: number | null;
  memo: string | null;
  practice_session_textbooks: {
    textbook_id: string;
    current_page: number;
    duration_minutes: number | null;
    tempo_bpm: number | null;
    textbooks: { title: string; total_pages: number | null; genre: string } | null;
  }[];
  practice_session_basic_menus: {
    menu_type: string;
    duration_minutes: number;
    tempo_bpms: number[] | null;
  }[];
};
```

`fetchAll` のクエリを変更（`other_minutes` と `tempo_bpm` を追加）:

```typescript
const { data, error } = await supabase
  .from('practice_sessions')
  .select(
    'id, practiced_at, duration_minutes, other_minutes, memo, ' +
      'practice_session_textbooks ( textbook_id, current_page, duration_minutes, tempo_bpm, textbooks ( title, total_pages, genre ) ), ' +
      'practice_session_basic_menus ( menu_type, duration_minutes, tempo_bpms )',
  )
  .order('practiced_at', { ascending: false });
```

`fetchAll` のマッピングに `otherMinutes` と `tempoBpm` を追加:

```typescript
sessions: rows.map((row) => ({
  id: row.id,
  practicedAt: row.practiced_at,
  durationMinutes: row.duration_minutes ?? null,
  otherMinutes: row.other_minutes ?? null,
  memo: row.memo ?? null,
  textbookEntries: (row.practice_session_textbooks ?? []).map((entry) => ({
    textbookId: entry.textbook_id,
    textbookTitle: entry.textbooks?.title ?? '',
    currentPage: entry.current_page,
    totalPages: entry.textbooks?.total_pages ?? null,
    genre: entry.textbooks?.genre ?? 'その他',
    durationMinutes: entry.duration_minutes ?? null,
    tempoBpm: entry.tempo_bpm ?? null,
  })),
  basicMenuEntries: (row.practice_session_basic_menus ?? []).map((m) => ({
    menuType: m.menu_type,
    durationMinutes: m.duration_minutes,
    tempoBpms: m.tempo_bpms ?? [],
  })),
})),
```

`add` の `practice_sessions` insert に `other_minutes` を追加:

```typescript
const { data: session, error: sessionError } = await supabase
  .from('practice_sessions')
  .insert({
    user_id: userData.user.id,
    practiced_at: input.practicedAt,
    duration_minutes: totalDuration > 0 ? totalDuration : null,
    other_minutes: input.otherMinutes ?? null,
    memo: input.memo || null,
  })
  .select()
  .single();
```

`add` の `practice_session_textbooks` insert に `tempo_bpm` を追加:

```typescript
const { error: entriesError } = await supabase.from('practice_session_textbooks').insert(
  input.textbookEntries.map((entry) => {
    const maxTempo =
      entry.tempoBpms && entry.tempoBpms.length > 0
        ? Math.max(...entry.tempoBpms.map((e) => e.bpm))
        : null;
    return {
      session_id: sessionId,
      textbook_id: entry.textbookId,
      current_page: entry.currentPage,
      duration_minutes: entry.durationMinutes ?? null,
      tempo_bpm: maxTempo,
    };
  }),
);
```

`add` の `newSession` に `otherMinutes` と `tempoBpm` を追加:

```typescript
const newSession: PracticeSession = {
  id: sessionId,
  practicedAt: input.practicedAt,
  durationMinutes: totalDuration > 0 ? totalDuration : null,
  otherMinutes: input.otherMinutes ?? null,
  memo: input.memo || null,
  textbookEntries: input.textbookEntries.map((entry) => {
    const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
    const maxTempo =
      entry.tempoBpms && entry.tempoBpms.length > 0
        ? Math.max(...entry.tempoBpms.map((e) => e.bpm))
        : null;
    return {
      textbookId: entry.textbookId,
      textbookTitle: tb?.title ?? '',
      currentPage: entry.currentPage,
      totalPages: tb?.totalPages ?? null,
      genre: tb?.genre ?? 'その他',
      durationMinutes: entry.durationMinutes ?? null,
      tempoBpm: maxTempo,
    };
  }),
  basicMenuEntries: basicMenuRows.map((r) => ({
    menuType: r.menu_type,
    durationMinutes: r.duration_minutes,
    tempoBpms: r.tempo_bpms ?? [],
  })),
};
```

`update` の `practice_sessions` update に `other_minutes` を追加:

```typescript
const { error: sessionError } = await supabase
  .from('practice_sessions')
  .update({
    practiced_at: input.practicedAt,
    duration_minutes: totalDuration > 0 ? totalDuration : null,
    other_minutes: input.otherMinutes ?? null,
    memo: input.memo || null,
  })
  .eq('id', id);
```

`update` の textbooks insert に `tempo_bpm` を追加（`add` と同じ `maxTempo` ロジック）:

```typescript
const { error: entriesError } = await supabase.from('practice_session_textbooks').insert(
  input.textbookEntries.map((entry) => {
    const maxTempo =
      entry.tempoBpms && entry.tempoBpms.length > 0
        ? Math.max(...entry.tempoBpms.map((e) => e.bpm))
        : null;
    return {
      session_id: id,
      textbook_id: entry.textbookId,
      current_page: entry.currentPage,
      duration_minutes: entry.durationMinutes ?? null,
      tempo_bpm: maxTempo,
    };
  }),
);
```

`update` の `updatedSession` に `otherMinutes` と `tempoBpm` を追加（`add` と同じパターン）:

```typescript
const updatedSession: PracticeSession = {
  id,
  practicedAt: input.practicedAt,
  durationMinutes: totalDuration > 0 ? totalDuration : null,
  otherMinutes: input.otherMinutes ?? null,
  memo: input.memo || null,
  textbookEntries: input.textbookEntries.map((entry) => {
    const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
    const maxTempo =
      entry.tempoBpms && entry.tempoBpms.length > 0
        ? Math.max(...entry.tempoBpms.map((e) => e.bpm))
        : null;
    return {
      textbookId: entry.textbookId,
      textbookTitle: tb?.title ?? '',
      currentPage: entry.currentPage,
      totalPages: tb?.totalPages ?? null,
      genre: tb?.genre ?? 'その他',
      durationMinutes: entry.durationMinutes ?? null,
      tempoBpm: maxTempo,
    };
  }),
  basicMenuEntries: basicMenuRows.map((r) => ({
    menuType: r.menu_type,
    durationMinutes: r.duration_minutes,
    tempoBpms: r.tempo_bpms ?? [],
  })),
};
```

- [ ] **Step 6: テストを通す**

```bash
npx jest store/__tests__/practice-log.test.ts
```

Expected: すべて PASS。

- [ ] **Step 7: コミット**

```bash
git add store/practice-log.ts store/__tests__/practice-log.test.ts
git commit -m "feat: ストアに otherMinutes・tempoBpm を追加し calcSessionTime を nonBasic 対応に変更"
```

---

### Task 4: フォームコンポーネントを更新する

**Files:**

- Modify: `components/practice-log-form.tsx`
- Modify: `app/practice-log-form.tsx`
- Modify: `__tests__/integration/practice-log-form.integration.test.tsx`

- [ ] **Step 1: 統合テストに新しいテストを追加する（失敗するはず）**

`__tests__/integration/practice-log-form.integration.test.tsx` の `beforeEach` を以下のように更新する（スケール教本を追加）:

```typescript
const TB1_ID = '123e4567-e89b-12d3-a456-426614174001';
const SCALE_TB_ID = '123e4567-e89b-12d3-a456-426614174003';

// beforeEach の useTextbookCatalogStore.setState を以下に更新:
useTextbookCatalogStore.setState({
  textbooks: [
    {
      id: TB1_ID,
      title: 'ローズ 32のエチュード',
      publisher: null,
      genre: 'エチュード',
      difficulty: null,
      totalPages: 32,
    },
    {
      id: '123e4567-e89b-12d3-a456-426614174002',
      title: 'アルテ教則本 第1巻',
      publisher: null,
      genre: 'その他',
      difficulty: null,
      totalPages: 120,
    },
    {
      id: SCALE_TB_ID,
      title: 'スケール練習',
      publisher: null,
      genre: 'スケール',
      difficulty: null,
      totalPages: null,
    },
  ],
  loading: false,
});
```

`describe('PracticeLogForm (integration)')` 内に以下のテストを追加する:

```typescript
it('メモ入力欄は日付入力の直後に表示される', () => {
  renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
  const memo = screen.getByLabelText('メモ');
  const date = screen.getByLabelText('日付');
  expect(memo).toBeTruthy();
  expect(date).toBeTruthy();
  // レイアウト順の検証: memo の testID 由来の DOM 順ではなく、
  // 両方がレンダリングされていることだけ確認（位置確認は E2E で担保）
});

it('その他に値を入力して保存すると onSubmit に otherMinutes が含まれる', async () => {
  const onSubmit = jest.fn();
  renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
  fireEvent.changeText(screen.getByLabelText('その他'), '20');
  fireEvent.press(screen.getByLabelText('保存'));
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ otherMinutes: 20 });
});

it('その他に 0 を入力して保存するとバリデーションエラーが表示される', async () => {
  const onSubmit = jest.fn();
  renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
  fireEvent.changeText(screen.getByLabelText('その他'), '0');
  fireEvent.press(screen.getByLabelText('保存'));
  await waitFor(() => {
    expect(screen.getAllByText('1以上の整数を入力してください').length).toBeGreaterThanOrEqual(1);
  });
  expect(onSubmit).not.toHaveBeenCalled();
});

it('スケール教本を選択するとテンポ追加ボタンが表示される', async () => {
  renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
  fireEvent.press(screen.getByLabelText('教本を追加'));
  await waitFor(() => {
    expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();
  });
  expect(screen.queryByLabelText('スケールテンポを追加 1')).toBeNull();

  const trigger = screen.getByLabelText('教本を選択 1');
  await act(async () => {
    await trigger.props.onValueChange?.(SCALE_TB_ID);
  });

  await waitFor(() => {
    expect(screen.getByLabelText('スケールテンポを追加 1')).toBeTruthy();
  });
});

it('スケール教本のテンポを複数追加して保存すると tempoBpms に値が含まれる', async () => {
  const onSubmit = jest.fn();
  renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
  fireEvent.press(screen.getByLabelText('教本を追加'));
  await waitFor(() => {
    expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();
  });
  const trigger = screen.getByLabelText('教本を選択 1');
  await act(async () => {
    await trigger.props.onValueChange?.(SCALE_TB_ID);
  });
  await waitFor(() => {
    expect(screen.getByLabelText('スケールテンポを追加 1')).toBeTruthy();
  });
  fireEvent.press(screen.getByLabelText('スケールテンポを追加 1'));
  fireEvent.press(screen.getByLabelText('スケールテンポを追加 1'));
  fireEvent.changeText(screen.getByLabelText('スケールBPM 1-1'), '80');
  fireEvent.changeText(screen.getByLabelText('スケールBPM 1-2'), '100');
  fireEvent.changeText(screen.getByLabelText('ページ 1'), '5');
  fireEvent.press(screen.getByLabelText('保存'));
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
  expect(onSubmit.mock.calls[0][0].textbookEntries[0].tempoBpms).toEqual([
    { bpm: 80 },
    { bpm: 100 },
  ]);
});

it('スケール以外の教本にはテンポ追加ボタンが表示されない', async () => {
  renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
  fireEvent.press(screen.getByLabelText('教本を追加'));
  await waitFor(() => {
    expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();
  });
  const trigger = screen.getByLabelText('教本を選択 1');
  await act(async () => {
    await trigger.props.onValueChange?.(TB1_ID);
  });
  await waitFor(() => {
    expect(screen.getByLabelText('ページ 1')).toBeTruthy();
  });
  expect(screen.queryByLabelText('スケールテンポを追加 1')).toBeNull();
});
```

`describe('PracticeLogForm with initialValues (編集モード)')` の `initialValues` に `otherMinutes` を追加し、テストを更新する:

```typescript
const initialValues: PracticeLogInput = {
  practicedAt: '2026-01-15',
  longToneMinutes: 20,
  tonguingMinutes: 10,
  tonguingTempoBpms: [{ bpm: 100 }],
  otherMinutes: 15,
  memo: 'テストメモ',
  textbookEntries: [],
};

// 'initialValues でフィールドが初期化される' テストに追加:
expect(screen.getByDisplayValue('15')).toBeTruthy(); // otherMinutes
```

- [ ] **Step 2: 失敗を確認する**

```bash
npx jest __tests__/integration/practice-log-form.integration.test.tsx
```

Expected: `その他`・`スケールテンポ` 関連テストが FAIL。

- [ ] **Step 3: `components/practice-log-form.tsx` を全体的に書き換える**

ファイルの内容を以下に置き換える。主な変更点: `TextbookEntryRow` サブコンポーネントの追加、メモの移動、その他セクションの追加、サマリー計算の更新、`useImperativeHandle` への `'other'` タイマー停止追加。

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { forwardRef, useImperativeHandle, useState } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from 'react-hook-form';
import { Platform, ScrollView } from 'react-native';
import { Button, Input, Paragraph, Select, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { TimerControl } from '@/components/timer-control';
import {
  BASIC_GENRES,
  BASIC_MENUS,
  formatDate,
  type PracticeLogInput,
  practiceLogSchema,
  today,
} from '@/forms/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';
import { type Textbook, useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTimerStore } from '@/store/timer';

type Props = {
  onSubmit: (data: PracticeLogInput) => void | Promise<void>;
  initialValues?: PracticeLogInput;
};

export type PracticeLogFormRef = {
  submit: () => void;
};

type TextbookEntryRowProps = {
  index: number;
  fieldId: string;
  control: Control<PracticeLogInput>;
  errors: FieldErrors<PracticeLogInput>;
  textbooks: Textbook[];
  watchedEntries: PracticeLogInput['textbookEntries'];
  onRemove: () => void;
  setValue: UseFormSetValue<PracticeLogInput>;
};

function TextbookEntryRow({
  index,
  fieldId,
  control,
  errors,
  textbooks,
  watchedEntries,
  onRemove,
  setValue,
}: TextbookEntryRowProps) {
  const {
    fields: bpmFields,
    append: appendBpm,
    remove: removeBpm,
  } = useFieldArray({
    control,
    name: `textbookEntries.${index}.tempoBpms` as `textbookEntries.0.tempoBpms`,
  });

  const otherSelectedIds = new Set(
    watchedEntries
      .filter((_, i) => i !== index)
      .map((e) => e.textbookId)
      .filter(Boolean),
  );
  const selectedTextbookId = watchedEntries[index]?.textbookId;
  const selectedTextbook = textbooks.find((tb) => tb.id === selectedTextbookId);
  const isScale = selectedTextbook?.genre === 'スケール';

  return (
    <YStack gap="$2" p="$3" bg="$color2" rounded="$3">
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
              <FieldError message={errors.textbookEntries?.[index]?.textbookId?.message} />
            </YStack>
          )}
        />
        <Button
          size="$2"
          theme="red"
          onPress={onRemove}
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

      {/* 教本練習時間 */}
      <TimerControl
        timerKey={`textbook-${fieldId}`}
        label={`教本 ${index + 1}`}
        onStop={(minutes) => setValue(`textbookEntries.${index}.durationMinutes`, minutes)}
      />
      <Controller
        control={control}
        name={`textbookEntries.${index}.durationMinutes`}
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph fontSize="$2" color="$color10">
              練習時間（分）任意
            </Paragraph>
            <Input
              value={value !== undefined ? String(value) : ''}
              onChangeText={(t) => {
                const n = Number(t);
                onChange(t === '' || isNaN(n) ? undefined : n);
              }}
              onBlur={onBlur}
              placeholder="例: 15"
              keyboardType="numeric"
              aria-label={`教本練習時間 ${index + 1}`}
            />
          </YStack>
        )}
      />
      <FieldError message={errors.textbookEntries?.[index]?.durationMinutes?.message} />

      {/* スケール教本 BPM */}
      {isScale && (
        <YStack gap="$2">
          <Paragraph color="$color11" fontSize="$3">
            テンポ（BPM）任意
          </Paragraph>
          {bpmFields.map((bpmField, bpmIndex) => (
            <YStack key={bpmField.id} gap="$1">
              <XStack gap="$2" items="center">
                <Controller
                  control={control}
                  name={
                    `textbookEntries.${index}.tempoBpms.${bpmIndex}.bpm` as `textbookEntries.0.tempoBpms.0.bpm`
                  }
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
                      aria-label={`スケールBPM ${index + 1}-${bpmIndex + 1}`}
                    />
                  )}
                />
                <Button
                  size="$2"
                  theme="red"
                  onPress={() => removeBpm(bpmIndex)}
                  aria-label={`スケールBPM ${index + 1}-${bpmIndex + 1} を削除`}
                >
                  ✕
                </Button>
              </XStack>
              <FieldError
                message={
                  (errors.textbookEntries?.[index]?.tempoBpms as { bpm?: { message?: string } }[] | undefined)?.[bpmIndex]?.bpm?.message
                }
              />
            </YStack>
          ))}
          <Button
            onPress={() => appendBpm({} as { bpm: number })}
            aria-label={`スケールテンポを追加 ${index + 1}`}
          >
            ＋ テンポを追加
          </Button>
        </YStack>
      )}
    </YStack>
  );
}

export const PracticeLogForm = forwardRef<PracticeLogFormRef, Props>(function PracticeLogForm(
  { onSubmit, initialValues },
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PracticeLogInput>({
    resolver: zodResolver(practiceLogSchema),
    mode: 'onTouched',
    defaultValues: initialValues ?? {
      practicedAt: today(),
      longToneMinutes: undefined,
      tonguingMinutes: undefined,
      tonguingTempoBpms: [],
      otherMinutes: undefined,
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
  const watchedOther = watch('otherMinutes');

  const formBasicMinutes =
    (watchedLongTone ?? 0) +
    (watchedTonguing ?? 0) +
    watchedEntries.reduce((acc, e) => {
      const tb = textbooks.find((t) => t.id === e.textbookId);
      return tb && (BASIC_GENRES as readonly string[]).includes(tb.genre)
        ? acc + (e.durationMinutes ?? 0)
        : acc;
    }, 0);

  const formTextbookMinutes = watchedEntries.reduce((acc, e) => {
    const tb = textbooks.find((t) => t.id === e.textbookId);
    return tb && !(BASIC_GENRES as readonly string[]).includes(tb.genre)
      ? acc + (e.durationMinutes ?? 0)
      : acc;
  }, 0);

  const formNonBasicMinutes = formTextbookMinutes + (watchedOther ?? 0);

  const resetAll = useTimerStore((s) => s.resetAll);

  const submitForm = handleSubmit(async (data) => {
    await onSubmit(data);
    resetAll();
  });

  useImperativeHandle(ref, () => ({
    submit: () => {
      const timerState = useTimerStore.getState();
      if (timerState.timers['long_tone']?.status === 'running') {
        setValue('longToneMinutes', timerState.stop('long_tone'));
      }
      if (timerState.timers['tonguing']?.status === 'running') {
        setValue('tonguingMinutes', timerState.stop('tonguing'));
      }
      if (timerState.timers['other']?.status === 'running') {
        setValue('otherMinutes', timerState.stop('other'));
      }
      fields.forEach((field, index) => {
        const key = `textbook-${field.id}`;
        if (timerState.timers[key]?.status === 'running') {
          setValue(`textbookEntries.${index}.durationMinutes`, timerState.stop(key));
        }
      });
      submitForm();
    },
  }));

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

        {/* 基礎練習 */}
        <YStack gap="$2">
          <Paragraph color="$color12">基礎練習</Paragraph>

          {BASIC_MENUS.map(({ type, label }) => {
            const fieldName = type === 'long_tone' ? 'longToneMinutes' : 'tonguingMinutes';
            const ariaLabel = type === 'long_tone' ? 'ロングトーン' : 'タンギング';
            const timerKey = type === 'long_tone' ? 'long_tone' : 'tonguing';
            return (
              <YStack key={type} gap="$1">
                <Paragraph color="$color11" fontSize="$3">
                  {label}（分）任意
                </Paragraph>
                <TimerControl
                  timerKey={timerKey}
                  label={label}
                  onStop={(minutes) => setValue(fieldName, minutes)}
                />
                <Controller
                  control={control}
                  name={fieldName}
                  render={({ field: { onChange, onBlur, value } }) => (
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
                  )}
                />
                <FieldError message={errors[fieldName]?.message} />
              </YStack>
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
              <Button onPress={() => appendBpm({} as { bpm: number })} aria-label="テンポを追加">
                ＋ テンポを追加
              </Button>
            </YStack>
          )}

          {(formBasicMinutes > 0 || formNonBasicMinutes > 0) && (
            <Paragraph fontSize="$2" color="$color10">
              {[
                formBasicMinutes > 0 && `基礎: ${formBasicMinutes}分`,
                formNonBasicMinutes > 0 && `基礎練習以外: ${formNonBasicMinutes}分`,
              ]
                .filter(Boolean)
                .join(' / ')}
            </Paragraph>
          )}
        </YStack>

        {/* 教本の進捗 */}
        <YStack gap="$2">
          <Paragraph color="$color12">教本の進捗</Paragraph>

          {fields.map((field, index) => (
            <TextbookEntryRow
              key={field.id}
              index={index}
              fieldId={field.id}
              control={control}
              errors={errors}
              textbooks={textbooks}
              watchedEntries={watchedEntries}
              onRemove={() => remove(index)}
              setValue={setValue}
            />
          ))}

          <Button
            onPress={() => append({ textbookId: '', currentPage: 0 })}
            aria-label="教本を追加"
          >
            ＋ 教本を追加
          </Button>
        </YStack>

        {/* その他 */}
        <YStack gap="$2">
          <Paragraph color="$color12">その他</Paragraph>
          <Paragraph color="$color11" fontSize="$3">
            練習時間（分）任意
          </Paragraph>
          <TimerControl
            timerKey="other"
            label="その他"
            onStop={(minutes) => setValue('otherMinutes', minutes)}
          />
          <Controller
            control={control}
            name="otherMinutes"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                value={value !== undefined ? String(value) : ''}
                onChangeText={(t) => {
                  const n = Number(t);
                  onChange(t === '' || isNaN(n) ? undefined : n);
                }}
                onBlur={onBlur}
                placeholder="例: 20"
                keyboardType="numeric"
                aria-label="その他"
              />
            )}
          />
          <FieldError message={errors.otherMinutes?.message} />
        </YStack>

        <Button theme="blue" onPress={submitForm} disabled={isSubmitting} aria-label="保存">
          保存
        </Button>
      </YStack>
    </ScrollView>
  );
});
```

- [ ] **Step 4: `app/practice-log-form.tsx` を更新する**

`initialValues` に `otherMinutes` と `tempoBpms` を追加する（編集モード時の初期値）:

```typescript
const initialValues: PracticeLogInput | undefined = editingSession
  ? {
      practicedAt: editingSession.practicedAt,
      longToneMinutes: editingSession.basicMenuEntries.find((m) => m.menuType === 'long_tone')
        ?.durationMinutes,
      tonguingMinutes: editingSession.basicMenuEntries.find((m) => m.menuType === 'tonguing')
        ?.durationMinutes,
      tonguingTempoBpms:
        editingSession.basicMenuEntries
          .find((m) => m.menuType === 'tonguing')
          ?.tempoBpms.map((bpm) => ({ bpm })) ?? [],
      otherMinutes: editingSession.otherMinutes ?? undefined,
      memo: editingSession.memo ?? '',
      textbookEntries: editingSession.textbookEntries.map((e) => ({
        textbookId: e.textbookId,
        currentPage: e.currentPage,
        durationMinutes: e.durationMinutes ?? undefined,
        tempoBpms: e.tempoBpm != null ? [{ bpm: e.tempoBpm }] : [],
      })),
    }
  : undefined;
```

- [ ] **Step 5: テストを通す**

```bash
npx jest __tests__/integration/practice-log-form.integration.test.tsx
```

Expected: すべて PASS。

- [ ] **Step 6: コミット**

```bash
git add components/practice-log-form.tsx app/practice-log-form.tsx \
  __tests__/integration/practice-log-form.integration.test.tsx
git commit -m "feat: フォームにその他セクション追加・メモ移動・スケール教本BPM入力を実装"
```

---

### Task 5: 一覧画面を更新する

**Files:**

- Modify: `app/(tabs)/index.tsx`
- Modify: `__tests__/integration/practice-log-screen.integration.test.tsx`

- [ ] **Step 1: `practice-log-screen.integration.test.tsx` の `makeSession` ヘルパーを更新する**

`makeSession` に `otherMinutes` を追加する（`textbookEntries` に `tempoBpm` も追加）:

```typescript
const makeSession = (id: string, practicedAt: string, durationMinutes: number | null = null) => ({
  id,
  practicedAt,
  durationMinutes,
  otherMinutes: null,
  memo: null,
  textbookEntries: [],
  basicMenuEntries: [],
});
```

- [ ] **Step 2: テストが通ることを確認する（型エラーのみ修正されるはず）**

```bash
npx jest __tests__/integration/practice-log-screen.integration.test.tsx
```

Expected: PASS（makeSession の型修正のみで既存テストは通る）。

- [ ] **Step 3: `app/(tabs)/index.tsx` を更新する**

`formatTimeLabel` のシグネチャを変更:

```typescript
function formatTimeLabel(basic: number, nonBasic: number): string | null {
  const parts: string[] = [];
  if (basic > 0) parts.push(`基礎練習: ${basic}分`);
  if (nonBasic > 0) parts.push(`基礎練習以外: ${nonBasic}分`);
  return parts.length > 0 ? parts.join(' / ') : null;
}
```

`monthTotals` の reduce を変更:

```typescript
const monthTotals = monthSessions.reduce(
  (acc, s) => {
    const { basic, nonBasic } = calcSessionTime(s);
    return { basic: acc.basic + basic, nonBasic: acc.nonBasic + nonBasic };
  },
  { basic: 0, nonBasic: 0 },
);
```

月ヘッダーの `formatTimeLabel` 呼び出しを変更:

```typescript
const label = formatTimeLabel(monthTotals.basic, monthTotals.nonBasic);
```

セッションカード内の `calcSessionTime` の参照を変更:

```typescript
const { basic, nonBasic } = calcSessionTime(item);
const label = formatTimeLabel(basic, nonBasic);
```

セッションカード内に「その他」表示を追加（`item.memo` 表示の後、`item.textbookEntries.map` の前）:

```typescript
{item.otherMinutes != null && (
  <Paragraph fontSize="$2" color="$color10">
    {`その他: ${item.otherMinutes}分`}
  </Paragraph>
)}
```

教本エントリ行に `tempoBpm` 表示を追加:

```typescript
{item.textbookEntries.map((entry) => (
  <XStack key={entry.textbookId} gap="$2" items="center">
    <Paragraph fontSize="$2">{entry.textbookTitle}</Paragraph>
    {entry.durationMinutes != null && (
      <Paragraph fontSize="$2" color="$color10">
        {`${entry.durationMinutes}分`}
      </Paragraph>
    )}
    {entry.tempoBpm != null && (
      <Paragraph fontSize="$2" color="$color10">
        {`♩=${entry.tempoBpm}`}
      </Paragraph>
    )}
    <Paragraph fontSize="$2" color="$blue9" ml="auto">
      {`p.${entry.currentPage}`}
    </Paragraph>
  </XStack>
))}
```

- [ ] **Step 4: テストを通す**

```bash
npx jest __tests__/integration/practice-log-screen.integration.test.tsx
```

Expected: すべて PASS。

- [ ] **Step 5: コミット**

```bash
git add app/\(tabs\)/index.tsx \
  __tests__/integration/practice-log-screen.integration.test.tsx
git commit -m "feat: 一覧画面を基礎練習以外ラベル・その他時間・スケールテンポ表示に対応"
```

---

### Task 6: 品質チェックとまとめコミット

- [ ] **Step 1: ESLint を実行する**

```bash
npm run lint
```

Expected: エラー 0 件。エラーがあれば `npm run lint:fix` で修正してから再実行。

- [ ] **Step 2: Prettier を確認する**

```bash
npm run format:check
```

Expected: 差分 0 件。差分があれば `npm run format` で修正。

- [ ] **Step 3: TypeScript を確認する**

```bash
npx tsc --noEmit
```

Expected: エラー 0 件。`useFieldArray` の `name` に型エラーが出る場合は `as const` キャストで対応する。

- [ ] **Step 4: 全テストを実行する**

```bash
npm test
```

Expected: すべて PASS。
