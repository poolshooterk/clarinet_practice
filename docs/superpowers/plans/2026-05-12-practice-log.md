# 練習記録 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 練習セッションを記録し、使用した教本の現在ページを自動更新する一覧＋フォーム画面を実装する

**Architecture:** `practice_sessions` / `practice_session_textbooks` の 2 テーブルを追加し、セッション保存時に `textbook_progress` を upsert する。フォームは RHF + zod + `useFieldArray` で教本エントリを動的に管理し、ストアは `persist` なし（Supabase が正）で実装する。

**Tech Stack:** Expo Router v6, Supabase, Zustand v5, React Hook Form, zod, Tamagui Select/Input, `@react-native-community/datetimepicker`

---

## ファイルマップ

| 操作         | パス                                                           |
| ------------ | -------------------------------------------------------------- |
| 新規作成     | `supabase/migrations/20260512000004_add_practice_sessions.sql` |
| 新規作成     | `forms/practice-log.ts`                                        |
| 新規作成     | `forms/__tests__/practice-log.test.ts`                         |
| 新規作成     | `store/practice-log.ts`                                        |
| 新規作成     | `store/__tests__/practice-log.test.ts`                         |
| 新規作成     | `components/practice-log-form.tsx`                             |
| 新規作成     | `app/practice-log-form.tsx`                                    |
| 全面置き換え | `app/(tabs)/index.tsx`                                         |
| 新規作成     | `__tests__/integration/practice-log-form.integration.test.tsx` |

---

### Task 1: Supabase マイグレーション

**Files:**

- Create: `supabase/migrations/20260512000004_add_practice_sessions.sql`

- [ ] **Step 1: マイグレーションファイルを作成する**

```sql
-- practice_sessions: 練習セッション本体
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

-- practice_session_textbooks: セッションに紐づく教本進捗
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

- [ ] **Step 2: マイグレーションを Supabase に適用する**

```bash
supabase db push
```

Expected: `Applying migration 20260512000004_add_practice_sessions.sql...` と表示され、エラーなし

- [ ] **Step 3: コミットする**

```bash
git add supabase/migrations/20260512000004_add_practice_sessions.sql
git commit -m "feat: practice_sessions / practice_session_textbooks テーブルを追加"
```

---

### Task 2: forms/practice-log.ts（zod スキーマ）

**Files:**

- Create: `forms/practice-log.ts`
- Create: `forms/__tests__/practice-log.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`forms/__tests__/practice-log.test.ts`:

```ts
import { practiceLogSchema, today } from '@/forms/practice-log';

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

describe('practiceLogSchema', () => {
  it('practicedAt のみと空の textbookEntries で合格する', () => {
    expect(
      practiceLogSchema.safeParse({ practicedAt: '2026-05-12', textbookEntries: [] }).success,
    ).toBe(true);
  });

  it('全フィールドが揃っていれば合格する', () => {
    expect(
      practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        durationMinutes: 45,
        memo: 'メモ',
        textbookEntries: [{ textbookId: VALID_UUID, currentPage: 14 }],
      }).success,
    ).toBe(true);
  });

  it('practicedAt が空文字のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({ practicedAt: '', textbookEntries: [] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['practicedAt']);
  });

  it('practicedAt が YYYY/MM/DD 形式のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({ practicedAt: '2026/05/12', textbookEntries: [] });
    expect(r.success).toBe(false);
  });

  it('durationMinutes が 1 のとき合格する', () => {
    expect(
      practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        durationMinutes: 1,
        textbookEntries: [],
      }).success,
    ).toBe(true);
  });

  it('durationMinutes が 0 のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      durationMinutes: 0,
      textbookEntries: [],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['durationMinutes']);
  });

  it('durationMinutes が負数のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      durationMinutes: -1,
      textbookEntries: [],
    });
    expect(r.success).toBe(false);
  });

  it('durationMinutes が小数のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      durationMinutes: 1.5,
      textbookEntries: [],
    });
    expect(r.success).toBe(false);
  });

  it('durationMinutes が省略可能', () => {
    expect(
      practiceLogSchema.safeParse({ practicedAt: '2026-05-12', textbookEntries: [] }).success,
    ).toBe(true);
  });

  it('textbookId が uuid でないとき拒否する', () => {
    const r = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      textbookEntries: [{ textbookId: 'not-a-uuid', currentPage: 0 }],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['textbookEntries', 0, 'textbookId']);
  });

  it('currentPage が 0 のとき合格する（境界値）', () => {
    expect(
      practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [{ textbookId: VALID_UUID, currentPage: 0 }],
      }).success,
    ).toBe(true);
  });

  it('currentPage が負数のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      textbookEntries: [{ textbookId: VALID_UUID, currentPage: -1 }],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['textbookEntries', 0, 'currentPage']);
  });

  it('currentPage が小数のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      textbookEntries: [{ textbookId: VALID_UUID, currentPage: 1.5 }],
    });
    expect(r.success).toBe(false);
  });
});

describe('today', () => {
  it('YYYY-MM-DD 形式の文字列を返す', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest forms/__tests__/practice-log
```

Expected: FAIL — `Cannot find module '@/forms/practice-log'`

- [ ] **Step 3: 実装を書く**

`forms/practice-log.ts`:

```ts
import { z } from 'zod';

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
npx jest forms/__tests__/practice-log
```

Expected: PASS — 13 tests

- [ ] **Step 5: コミットする**

```bash
git add forms/practice-log.ts forms/__tests__/practice-log.test.ts
git commit -m "feat: practiceLogSchema と today/formatDate ヘルパーを追加"
```

---

### Task 3: store/practice-log.ts（Zustand ストア）

**Files:**

- Create: `store/practice-log.ts`
- Create: `store/__tests__/practice-log.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`store/__tests__/practice-log.test.ts`:

```ts
import { usePracticeLogStore } from '@/store/practice-log';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('@/store/textbook-catalog', () => ({
  useTextbookCatalogStore: {
    getState: jest.fn().mockReturnValue({ textbooks: [] }),
  },
}));

const mockSupabase = () => jest.requireMock('@/lib/supabase').supabase;
const mockCatalog = () => jest.requireMock('@/store/textbook-catalog').useTextbookCatalogStore;

describe('usePracticeLogStore', () => {
  beforeEach(() => {
    usePracticeLogStore.setState({ sessions: [], loading: false });
    jest.clearAllMocks();
  });

  it('初期状態: sessions は空配列', () => {
    expect(usePracticeLogStore.getState().sessions).toEqual([]);
    expect(usePracticeLogStore.getState().loading).toBe(false);
  });

  it('fetchAll で sessions がセットされる', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockSupabase().from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'session-1',
              practiced_at: '2026-05-12',
              duration_minutes: 45,
              memo: 'テスト',
              practice_session_textbooks: [
                {
                  textbook_id: 'tb-1',
                  current_page: 14,
                  textbooks: { title: 'ローズ 32のエチュード', total_pages: 32 },
                },
              ],
            },
          ],
          error: null,
        }),
      }),
    });

    await usePracticeLogStore.getState().fetchAll();

    const sessions = usePracticeLogStore.getState().sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: 'session-1',
      practicedAt: '2026-05-12',
      durationMinutes: 45,
      memo: 'テスト',
    });
    expect(sessions[0].textbookEntries[0]).toMatchObject({
      textbookId: 'tb-1',
      textbookTitle: 'ローズ 32のエチュード',
      currentPage: 14,
      totalPages: 32,
    });
  });

  it('fetchAll でユーザーが未ログインのとき sessions を変更せず from を呼ばない', async () => {
    usePracticeLogStore.setState({ sessions: [] });
    mockSupabase().auth.getUser.mockResolvedValueOnce({ data: { user: null } });

    await usePracticeLogStore.getState().fetchAll();

    expect(mockSupabase().from).not.toHaveBeenCalled();
    expect(usePracticeLogStore.getState().sessions).toEqual([]);
  });

  it('add でセッションが sessions の先頭に追加される', async () => {
    const existing = {
      id: 'old',
      practicedAt: '2026-05-11',
      durationMinutes: null,
      memo: null,
      textbookEntries: [],
    };
    usePracticeLogStore.setState({ sessions: [existing] });

    mockCatalog().getState.mockReturnValue({
      textbooks: [
        {
          id: 'tb-1',
          title: 'ローズ 32のエチュード',
          publisher: null,
          difficulty: null,
          totalPages: 32,
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
    mockSupabase().from.mockReturnValueOnce({
      insert: jest.fn().mockResolvedValue({ error: null }),
    });
    mockSupabase().from.mockReturnValueOnce({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    });

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-12',
      durationMinutes: undefined,
      memo: undefined,
      textbookEntries: [{ textbookId: 'tb-1', currentPage: 14 }],
    });

    const sessions = usePracticeLogStore.getState().sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe('new-session');
    expect(sessions[0].practicedAt).toBe('2026-05-12');
    expect(sessions[0].textbookEntries[0]).toMatchObject({
      textbookId: 'tb-1',
      textbookTitle: 'ローズ 32のエチュード',
      currentPage: 14,
      totalPages: 32,
    });
    expect(sessions[1].id).toBe('old');
  });

  it('add でユーザーが未ログインのとき sessions を変更せず from を呼ばない', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({ data: { user: null } });

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-12',
      textbookEntries: [],
    });

    expect(mockSupabase().from).not.toHaveBeenCalled();
    expect(usePracticeLogStore.getState().sessions).toEqual([]);
  });

  it('remove で対象セッションが削除される', async () => {
    usePracticeLogStore.setState({
      sessions: [
        {
          id: 'session-1',
          practicedAt: '2026-05-12',
          durationMinutes: null,
          memo: null,
          textbookEntries: [],
        },
        {
          id: 'session-2',
          practicedAt: '2026-05-11',
          durationMinutes: null,
          memo: null,
          textbookEntries: [],
        },
      ],
    });
    mockSupabase().from.mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    await usePracticeLogStore.getState().remove('session-1');

    const sessions = usePracticeLogStore.getState().sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('session-2');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest store/__tests__/practice-log
```

Expected: FAIL — `Cannot find module '@/store/practice-log'`

- [ ] **Step 3: 実装を書く**

`store/practice-log.ts`:

```ts
import { create } from 'zustand';

import { type PracticeLogInput } from '@/forms/practice-log';
import { supabase } from '@/lib/supabase';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  totalPages: number | null;
};

export type PracticeSession = {
  id: string;
  practicedAt: string;
  durationMinutes: number | null;
  memo: string | null;
  textbookEntries: TextbookEntry[];
};

type SessionRow = {
  id: string;
  practiced_at: string;
  duration_minutes: number | null;
  memo: string | null;
  practice_session_textbooks: Array<{
    textbook_id: string;
    current_page: number;
    textbooks: { title: string; total_pages: number | null } | null;
  }>;
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
        'id, practiced_at, duration_minutes, memo, practice_session_textbooks ( textbook_id, current_page, textbooks ( title, total_pages ) )',
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
      })),
    });
  },

  add: async (input: PracticeLogInput) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data: session, error: sessionError } = await supabase
      .from('practice_sessions')
      .insert({
        user_id: userData.user.id,
        practiced_at: input.practicedAt,
        duration_minutes: input.durationMinutes ?? null,
        memo: input.memo || null,
      })
      .select()
      .single();
    if (sessionError || !session) return;

    if (input.textbookEntries.length > 0) {
      const { error: entriesError } = await supabase.from('practice_session_textbooks').insert(
        input.textbookEntries.map((entry) => ({
          session_id: (session as { id: string }).id,
          textbook_id: entry.textbookId,
          current_page: entry.currentPage,
        })),
      );
      if (entriesError) return;

      for (const entry of input.textbookEntries) {
        await supabase.from('textbook_progress').upsert(
          {
            user_id: userData.user.id,
            textbook_id: entry.textbookId,
            current_page: entry.currentPage,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,textbook_id' },
        );
      }
    }

    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;
    const newSession: PracticeSession = {
      id: (session as { id: string }).id,
      practicedAt: input.practicedAt,
      durationMinutes: input.durationMinutes ?? null,
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
npx jest store/__tests__/practice-log
```

Expected: PASS — 6 tests

- [ ] **Step 5: 品質チェックと コミット**

```bash
npm run lint && npx tsc --noEmit
git add store/practice-log.ts store/__tests__/practice-log.test.ts
git commit -m "feat: usePracticeLogStore を追加（fetchAll / add / remove）"
```

---

### Task 4: components/practice-log-form.tsx（フォーム UI）

**Files:**

- Create: `components/practice-log-form.tsx`

- [ ] **Step 1: 実装を書く**

`components/practice-log-form.tsx`:

```tsx
import DateTimePicker from '@react-native-community/datetimepicker';
import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Platform, ScrollView } from 'react-native';
import { Button, Input, Paragraph, Select, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { type PracticeLogInput, formatDate, practiceLogSchema, today } from '@/forms/practice-log';
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
  const [showPicker, setShowPicker] = useState(false);

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
      durationMinutes: undefined,
      memo: '',
      textbookEntries: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'textbookEntries' });
  const watchedEntries = watch('textbookEntries') ?? [];

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

        {/* 練習時間 */}
        <Controller
          control={control}
          name="durationMinutes"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph color="$color12">練習時間（分） 任意</Paragraph>
              <Input
                value={value !== undefined ? String(value) : ''}
                onChangeText={(t) => {
                  const n = Number(t);
                  onChange(t === '' || isNaN(n) ? undefined : n);
                }}
                onBlur={onBlur}
                placeholder="例: 45"
                keyboardType="numeric"
                aria-label="練習時間"
              />
              <FieldError message={errors.durationMinutes?.message} />
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

        {/* 教本エントリ */}
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
                    render={({ field: { onChange, value } }) => (
                      <YStack flex={1} gap="$1">
                        <Select value={value} onValueChange={onChange}>
                          <Select.Trigger flex={1} aria-label={`教本を選択 ${index + 1}`}>
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
                    variant="outlined"
                    onPress={() => remove(index)}
                    aria-label={`エントリ ${index + 1} を削除`}
                  >
                    ✕
                  </Button>
                </XStack>

                <XStack gap="$2" items="center" flexWrap="wrap">
                  <Paragraph fontSize="$2" color="$color10">
                    現在ページ:
                  </Paragraph>
                  <Controller
                    control={control}
                    name={`textbookEntries.${index}.currentPage`}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <>
                        <Input
                          w={64}
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
                        <FieldError
                          message={errors.textbookEntries?.[index]?.currentPage?.message}
                        />
                      </>
                    )}
                  />
                </XStack>
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

- [ ] **Step 2: 品質チェックを通す**

```bash
npm run lint && npx tsc --noEmit && npm test
```

Expected: エラー 0 件、全テスト PASS

- [ ] **Step 3: コミットする**

```bash
git add components/practice-log-form.tsx
git commit -m "feat: PracticeLogForm コンポーネントを追加（useFieldArray + Tamagui Select）"
```

---

### Task 5: app/practice-log-form.tsx（新規記録画面）

**Files:**

- Create: `app/practice-log-form.tsx`

- [ ] **Step 1: 実装を書く**

`app/practice-log-form.tsx`:

```tsx
import { router, Stack } from 'expo-router';
import { useRef } from 'react';
import { Pressable } from 'react-native';
import { Paragraph } from 'tamagui';

import { PracticeLogForm, type PracticeLogFormRef } from '@/components/practice-log-form';
import { type PracticeLogInput } from '@/forms/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';

export default function PracticeLogFormScreen() {
  const formRef = useRef<PracticeLogFormRef>(null);
  const add = usePracticeLogStore((s) => s.add);

  const handleSubmit = async (data: PracticeLogInput) => {
    await add(data);
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '練習を記録',
          headerShown: true,
          headerRight: () => (
            <Pressable onPress={() => formRef.current?.submit()}>
              <Paragraph color="$blue9" mr="$2">
                保存
              </Paragraph>
            </Pressable>
          ),
        }}
      />
      <PracticeLogForm ref={formRef} onSubmit={handleSubmit} />
    </>
  );
}
```

- [ ] **Step 2: 品質チェックを通す**

```bash
npm run lint && npx tsc --noEmit && npm test
```

Expected: エラー 0 件、全テスト PASS

- [ ] **Step 3: コミットする**

```bash
git add app/practice-log-form.tsx
git commit -m "feat: 練習記録フォーム画面を追加"
```

---

### Task 6: app/(tabs)/index.tsx の全面置き換え（練習記録一覧）

**Files:**

- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: 全面置き換えを行う**

`app/(tabs)/index.tsx`:

```tsx
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { usePracticeLogStore } from '@/store/practice-log';

function dayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
}

export default function PracticeLogScreen() {
  const sessions = usePracticeLogStore((s) => s.sessions);
  const loading = usePracticeLogStore((s) => s.loading);
  const fetchAll = usePracticeLogStore((s) => s.fetchAll);
  const remove = usePracticeLogStore((s) => s.remove);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthSessions = sessions.filter((s) => s.practicedAt.startsWith(currentMonth));
  const totalMinutes = monthSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

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
        data={sessions}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <XStack justify="space-between" items="center" p="$3">
            <Paragraph fontSize="$2" color="$color10">
              {`${currentMonth.slice(5)}月: ${monthSessions.length}回 / 計${totalMinutes}分`}
            </Paragraph>
            <Pressable onPress={() => router.push('/practice-log-form')}>
              <Paragraph color="$blue9" fontSize="$2">
                ＋ 記録
              </Paragraph>
            </Pressable>
          </XStack>
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
            </YStack>
          </Pressable>
        )}
      />
    </>
  );
}
```

- [ ] **Step 2: 品質チェックを通す**

```bash
npm run lint && npx tsc --noEmit && npm test
```

Expected: エラー 0 件、全テスト PASS

- [ ] **Step 3: コミットする**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat: 練習記録一覧画面を実装（useFocusEffect / FlatList / 長押し削除）"
```

---

### Task 7: 結合テスト

**Files:**

- Create: `__tests__/integration/practice-log-form.integration.test.tsx`

- [ ] **Step 1: 結合テストを書く**

`__tests__/integration/practice-log-form.integration.test.tsx`:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { PracticeLogForm } from '@/components/practice-log-form';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn() },
  useFocusEffect: () => {},
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

describe('PracticeLogForm (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useTextbookCatalogStore.setState({
      textbooks: [
        {
          id: 'tb-1',
          title: 'ローズ 32のエチュード',
          publisher: null,
          difficulty: null,
          totalPages: 32,
        },
        {
          id: 'tb-2',
          title: 'アルテ教則本 第1巻',
          publisher: null,
          difficulty: null,
          totalPages: 120,
        },
      ],
      loading: false,
    });
    jest.clearAllMocks();
  });

  it('practicedAt を空にして保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByLabelText('日付'), '');
    fireEvent.press(screen.getByLabelText('保存'));

    await waitFor(() => {
      expect(screen.getByText('日付を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('教本エントリの追加・削除が動作する', () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);

    // 追加: ＋ 教本を追加ボタンでエントリが出現する
    fireEvent.press(screen.getByLabelText('教本を追加'));
    expect(screen.getByLabelText('エントリ 1 を削除')).toBeTruthy();
    expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();

    // 削除: ✕ でエントリが消える
    fireEvent.press(screen.getByLabelText('エントリ 1 を削除'));
    expect(screen.queryByLabelText('エントリ 1 を削除')).toBeNull();
  });

  it('durationMinutes に 0 を入力して保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByLabelText('練習時間'), '0');
    fireEvent.press(screen.getByLabelText('保存'));

    await waitFor(() => {
      expect(screen.getByText('1以上の整数を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('教本エントリを追加して保存すると onSubmit に正しい値が渡される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);

    // エントリ追加
    fireEvent.press(screen.getByLabelText('教本を追加'));

    // Tamagui Select を開いて教本を選択
    fireEvent.press(screen.getByLabelText('教本を選択 1'));
    await waitFor(() => {
      expect(screen.getByText('ローズ 32のエチュード')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('ローズ 32のエチュード'));

    // ページ入力
    await waitFor(() => {
      expect(screen.getByLabelText('ページ 1')).toBeTruthy();
    });
    fireEvent.changeText(screen.getByLabelText('ページ 1'), '14');

    // 保存
    fireEvent.press(screen.getByLabelText('保存'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      textbookEntries: [{ textbookId: 'tb-1', currentPage: 14 }],
    });
  });
});
```

- [ ] **Step 2: テストを実行して確認する**

```bash
npx jest __tests__/integration/practice-log-form.integration
```

Expected: PASS — 4 tests

> **注意:** `教本エントリを追加して保存すると onSubmit に正しい値が渡される` テストで Tamagui Select の Sheet が jest 環境で描画されない場合、このテストのみ `screen.getByText('ローズ 32のエチュード')` が見つからない可能性がある。その場合は `fireEvent.press(screen.getByLabelText('教本を選択 1'))` の後に `await screen.findByText('ローズ 32のエチュード')` を試すか、Select の代わりに Button 列で実装する回避策を検討すること。

- [ ] **Step 3: 全品質チェックを通す**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

Expected: エラー 0 件、全テスト PASS

- [ ] **Step 4: コミットする**

```bash
git add __tests__/integration/practice-log-form.integration.test.tsx
git commit -m "test: PracticeLogForm 結合テストを追加"
```
