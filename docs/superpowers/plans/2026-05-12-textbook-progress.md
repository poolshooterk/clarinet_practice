# 教本進捗管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 教本一覧画面でページ番号ベースの進捗バーを表示し、タップで現在ページを更新できるモーダルを実装する。

**Architecture:** `textbooks` テーブルに `total_pages` を追加し、ユーザーごとの進捗を `textbook_progress` テーブル（Supabase）で管理する。`store/textbook-progress.ts`（新規）が進捗の fetch/upsert を担当し、`app/textbooks.tsx` がモーダル UI を持つ。フォームには `totalPages` フィールドを追加する。

**Tech Stack:** Supabase（RLS）、Zustand v5、React Hook Form + Zod、Tamagui、React Native Modal

---

## ファイルマップ

| 操作 | ファイル                                                              | 変更内容                                                |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| 新規 | `supabase/migrations/20260512000001_add_total_pages_to_textbooks.sql` | `total_pages` カラム追加                                |
| 新規 | `supabase/migrations/20260512000002_add_textbook_progress.sql`        | `textbook_progress` テーブル作成                        |
| 修正 | `forms/textbook.ts`                                                   | `totalPages` フィールド追加                             |
| 修正 | `forms/__tests__/textbook.test.ts`                                    | `totalPages` テスト追加                                 |
| 修正 | `store/textbook-catalog.ts`                                           | `Textbook` 型と CRUD アクションに `totalPages` を追加   |
| 修正 | `store/__tests__/textbook-catalog.test.ts`                            | `totalPages` 対応（toEqual の期待値と setState の修正） |
| 新規 | `store/textbook-progress.ts`                                          | 進捗ストア（fetchAll / upsert）                         |
| 新規 | `store/__tests__/textbook-progress.test.ts`                           | 進捗ストアの単体テスト                                  |
| 修正 | `components/textbook-form.tsx`                                        | 総ページ数フィールドを追加                              |
| 修正 | `app/textbook-form.tsx`                                               | `defaultValues` に `totalPages` を追加                  |
| 修正 | `__tests__/integration/textbook-form.integration.test.tsx`            | `totalPages` テスト追加                                 |
| 修正 | `app/textbooks.tsx`                                                   | 行構造変更・進捗バー・モーダル追加                      |
| 新規 | `__tests__/integration/textbook-progress-modal.integration.test.tsx`  | 進捗モーダルの結合テスト                                |

---

### Task 1: マイグレーションファイルを作成して Supabase に適用する

**Files:**

- Create: `supabase/migrations/20260512000001_add_total_pages_to_textbooks.sql`
- Create: `supabase/migrations/20260512000002_add_textbook_progress.sql`

- [ ] **Step 1: `total_pages` カラム追加マイグレーションを作成する**

```sql
-- supabase/migrations/20260512000001_add_total_pages_to_textbooks.sql
alter table textbooks
  add column total_pages integer check (total_pages > 0);
```

- [ ] **Step 2: `textbook_progress` テーブルマイグレーションを作成する**

```sql
-- supabase/migrations/20260512000002_add_textbook_progress.sql
create table textbook_progress (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  textbook_id  uuid        not null references textbooks(id) on delete cascade,
  current_page integer     not null default 0 check (current_page >= 0),
  updated_at   timestamptz default now(),
  unique(user_id, textbook_id)
);

alter table textbook_progress enable row level security;

create policy "自分の進捗を参照可能"
  on textbook_progress for select
  using (auth.uid() = user_id);

create policy "自分の進捗を追加可能"
  on textbook_progress for insert
  with check (auth.uid() = user_id);

create policy "自分の進捗を更新可能"
  on textbook_progress for update
  using (auth.uid() = user_id);

create policy "自分の進捗を削除可能"
  on textbook_progress for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 3: Supabase にマイグレーションを適用する**

```bash
npx supabase db push
```

Expected: `Applying migration 20260512000001...` および `Applying migration 20260512000002...` が表示されてエラーなし。

- [ ] **Step 4: コミットする**

```bash
git add supabase/migrations/20260512000001_add_total_pages_to_textbooks.sql supabase/migrations/20260512000002_add_textbook_progress.sql
git commit -m "feat: textbooks に total_pages カラムと textbook_progress テーブルを追加"
```

---

### Task 2: `textbookSchema` に `totalPages` フィールドを追加する

**Files:**

- Modify: `forms/__tests__/textbook.test.ts`
- Modify: `forms/textbook.ts`

- [ ] **Step 1: 失敗するテストを書く**

`forms/__tests__/textbook.test.ts` に以下を追記する（既存のテストはそのまま）。

```ts
it('totalPages が省略可能', () => {
  expect(textbookSchema.safeParse({ title: 'テスト' }).success).toBe(true);
});

it('totalPages に正整数を渡すと有効', () => {
  expect(textbookSchema.safeParse({ title: 'テスト', totalPages: 100 }).success).toBe(true);
});

it('totalPages に 0 を渡すと拒否する', () => {
  const r = textbookSchema.safeParse({ title: 'テスト', totalPages: 0 });
  expect(r.success).toBe(false);
  if (!r.success) expect(r.error.issues[0].path).toEqual(['totalPages']);
});

it('totalPages に負数を渡すと拒否する', () => {
  const r = textbookSchema.safeParse({ title: 'テスト', totalPages: -1 });
  expect(r.success).toBe(false);
});

it('totalPages に小数を渡すと拒否する', () => {
  const r = textbookSchema.safeParse({ title: 'テスト', totalPages: 1.5 });
  expect(r.success).toBe(false);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest forms/__tests__/textbook.test.ts
```

Expected: `totalPages に正整数を渡すと有効` など新規テストが FAIL。

- [ ] **Step 3: `forms/textbook.ts` に `totalPages` を追加する**

```ts
import { z } from 'zod';

export const DIFFICULTY_OPTIONS = ['初心者', '初中級', '中級', '上級'] as const;
export type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];

export const textbookSchema = z.object({
  title: z.string().min(1, '教本名を入力してください'),
  publisher: z.string().optional(),
  difficulty: z.enum(DIFFICULTY_OPTIONS).optional(),
  totalPages: z.number().int().min(1, '1以上の整数を入力してください').optional(),
});

export type TextbookInput = z.infer<typeof textbookSchema>;
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest forms/__tests__/textbook.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミットする**

```bash
git add forms/textbook.ts forms/__tests__/textbook.test.ts
git commit -m "feat: textbookSchema に totalPages フィールドを追加"
```

---

### Task 3: `textbook-catalog` ストアに `totalPages` を追加する

**Files:**

- Modify: `store/__tests__/textbook-catalog.test.ts`
- Modify: `store/textbook-catalog.ts`

- [ ] **Step 1: 既存テストと新規テストを更新して失敗状態を作る**

`store/__tests__/textbook-catalog.test.ts` を以下の全体に置き換える。

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTextbookCatalogStore } from '@/store/textbook-catalog';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockFrom = () => jest.requireMock('@/lib/supabase').supabase.from as jest.Mock;

const rows = [
  {
    id: 'tb-1',
    title: 'ローズ 32のエチュード',
    publisher: '全音楽譜出版社',
    difficulty: '中級',
    total_pages: 32,
  },
  { id: 'tb-2', title: 'クローゼ 教則本', publisher: null, difficulty: '上級', total_pages: null },
];

describe('useTextbookCatalogStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useTextbookCatalogStore.setState({ textbooks: [], loading: false });
  });

  it('初期状態: textbooks は空配列', () => {
    expect(useTextbookCatalogStore.getState().textbooks).toEqual([]);
  });

  it('fetchAll で textbooks がセットされる', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    });
    await useTextbookCatalogStore.getState().fetchAll();
    const { textbooks } = useTextbookCatalogStore.getState();
    expect(textbooks).toHaveLength(2);
    expect(textbooks[0]).toEqual({
      id: 'tb-1',
      title: 'ローズ 32のエチュード',
      publisher: '全音楽譜出版社',
      difficulty: '中級',
      totalPages: 32,
    });
    expect(textbooks[1].totalPages).toBeNull();
  });

  it('fetchAll がエラーを返してもキャッシュが維持される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: rows.map((r) => ({
        id: r.id,
        title: r.title,
        publisher: r.publisher ?? null,
        difficulty: r.difficulty as '中級' | '上級',
        totalPages: r.total_pages ?? null,
      })),
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: null, error: new Error('network') }),
      }),
    });
    await useTextbookCatalogStore.getState().fetchAll();
    expect(useTextbookCatalogStore.getState().textbooks).toHaveLength(2);
  });

  it('add で textbooks に追加される', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'tb-new',
              title: '新しい教本',
              publisher: null,
              difficulty: null,
              total_pages: 80,
            },
            error: null,
          }),
        }),
      }),
    });
    await useTextbookCatalogStore.getState().add({ title: '新しい教本', totalPages: 80 });
    const { textbooks } = useTextbookCatalogStore.getState();
    const added = textbooks.find((t) => t.title === '新しい教本');
    expect(added).toBeDefined();
    expect(added?.totalPages).toBe(80);
  });

  it('update で該当教本の totalPages が更新される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: [
        { id: 'tb-1', title: '旧タイトル', publisher: null, difficulty: null, totalPages: null },
      ],
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useTextbookCatalogStore
      .getState()
      .update('tb-1', { title: '新タイトル', totalPages: 60 });
    const t = useTextbookCatalogStore.getState().textbooks.find((x) => x.id === 'tb-1');
    expect(t?.title).toBe('新タイトル');
    expect(t?.totalPages).toBe(60);
  });

  it('remove で該当教本が削除される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: [
        { id: 'tb-1', title: 'ローズ', publisher: null, difficulty: null, totalPages: null },
      ],
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useTextbookCatalogStore.getState().remove('tb-1');
    expect(useTextbookCatalogStore.getState().textbooks).toHaveLength(0);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest store/__tests__/textbook-catalog.test.ts
```

Expected: `fetchAll で textbooks がセットされる` などが FAIL（`totalPages` が型にない）。

- [ ] **Step 3: `store/textbook-catalog.ts` を更新する**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type Difficulty, type TextbookInput } from '@/forms/textbook';
import { supabase } from '@/lib/supabase';

export type Textbook = {
  id: string;
  title: string;
  publisher: string | null;
  difficulty: Difficulty | null;
  totalPages: number | null;
};

type TextbookCatalogState = {
  textbooks: Textbook[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: TextbookInput) => Promise<void>;
  update: (id: string, input: TextbookInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useTextbookCatalogStore = create<TextbookCatalogState>()(
  persist(
    (set, get) => ({
      textbooks: [],
      loading: false,

      fetchAll: async () => {
        set({ loading: true });
        const { data, error } = await supabase.from('textbooks').select('*').order('title');
        set({ loading: false });
        if (error || !data) return;
        set({
          textbooks: data.map((row) => ({
            id: row.id,
            title: row.title,
            publisher: row.publisher ?? null,
            difficulty: (row.difficulty as Difficulty) ?? null,
            totalPages: (row.total_pages as number) ?? null,
          })),
        });
      },

      add: async (input: TextbookInput) => {
        const { data, error } = await supabase
          .from('textbooks')
          .insert({
            title: input.title,
            publisher: input.publisher || null,
            difficulty: input.difficulty ?? null,
            total_pages: input.totalPages ?? null,
          })
          .select()
          .single();
        if (error || !data) return;
        set({
          textbooks: [
            ...get().textbooks,
            {
              id: data.id,
              title: data.title,
              publisher: data.publisher ?? null,
              difficulty: (data.difficulty as Difficulty) ?? null,
              totalPages: (data.total_pages as number) ?? null,
            },
          ],
        });
      },

      update: async (id: string, input: TextbookInput) => {
        const { error } = await supabase
          .from('textbooks')
          .update({
            title: input.title,
            publisher: input.publisher || null,
            difficulty: input.difficulty ?? null,
            total_pages: input.totalPages ?? null,
          })
          .eq('id', id);
        if (error) return;
        set({
          textbooks: get().textbooks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  title: input.title,
                  publisher: input.publisher || null,
                  difficulty: input.difficulty ?? null,
                  totalPages: input.totalPages ?? null,
                }
              : t,
          ),
        });
      },

      remove: async (id: string) => {
        const { error } = await supabase.from('textbooks').delete().eq('id', id);
        if (error) return;
        set({ textbooks: get().textbooks.filter((t) => t.id !== id) });
      },
    }),
    {
      name: 'clarinet-practice-textbook-catalog',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ textbooks: s.textbooks }),
    },
  ),
);
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest store/__tests__/textbook-catalog.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミットする**

```bash
git add store/textbook-catalog.ts store/__tests__/textbook-catalog.test.ts
git commit -m "feat: textbook-catalog ストアに totalPages を追加"
```

---

### Task 4: `textbook-progress` ストアを作成する

**Files:**

- Create: `store/__tests__/textbook-progress.test.ts`
- Create: `store/textbook-progress.ts`

- [ ] **Step 1: 失敗する単体テストを作成する**

```ts
// store/__tests__/textbook-progress.test.ts
import { useTextbookProgressStore } from '@/store/textbook-progress';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockSupabase = () => jest.requireMock('@/lib/supabase').supabase;

describe('useTextbookProgressStore', () => {
  beforeEach(() => {
    useTextbookProgressStore.setState({ progress: {} });
    jest.clearAllMocks();
  });

  it('初期状態: progress は空オブジェクト', () => {
    expect(useTextbookProgressStore.getState().progress).toEqual({});
  });

  it('fetchAll で progress マップがセットされる', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase().from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [
            { textbook_id: 'tb-1', current_page: 10 },
            { textbook_id: 'tb-2', current_page: 30 },
          ],
          error: null,
        }),
      }),
    });
    await useTextbookProgressStore.getState().fetchAll();
    expect(useTextbookProgressStore.getState().progress).toEqual({
      'tb-1': 10,
      'tb-2': 30,
    });
  });

  it('fetchAll でユーザーが未ログインのとき progress を変更しない', async () => {
    useTextbookProgressStore.setState({ progress: { 'tb-1': 5 } });
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    await useTextbookProgressStore.getState().fetchAll();
    expect(useTextbookProgressStore.getState().progress).toEqual({ 'tb-1': 5 });
  });

  it('upsert で progress マップに追加される', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase().from.mockReturnValueOnce({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    });
    await useTextbookProgressStore.getState().upsert('tb-1', 15);
    expect(useTextbookProgressStore.getState().progress['tb-1']).toBe(15);
  });

  it('同一 textbookId の再 upsert で値が上書きされる', async () => {
    useTextbookProgressStore.setState({ progress: { 'tb-1': 10 } });
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase().from.mockReturnValueOnce({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    });
    await useTextbookProgressStore.getState().upsert('tb-1', 25);
    expect(useTextbookProgressStore.getState().progress['tb-1']).toBe(25);
  });

  it('upsert で Supabase がエラーを返したとき progress を変更しない', async () => {
    useTextbookProgressStore.setState({ progress: { 'tb-1': 10 } });
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase().from.mockReturnValueOnce({
      upsert: jest.fn().mockResolvedValue({ error: new Error('network') }),
    });
    await useTextbookProgressStore.getState().upsert('tb-1', 25);
    expect(useTextbookProgressStore.getState().progress['tb-1']).toBe(10);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest store/__tests__/textbook-progress.test.ts
```

Expected: `Cannot find module '@/store/textbook-progress'`。

- [ ] **Step 3: `store/textbook-progress.ts` を作成する**

```ts
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

type TextbookProgressState = {
  progress: Record<string, number>;
  fetchAll: () => Promise<void>;
  upsert: (textbookId: string, currentPage: number) => Promise<void>;
};

export const useTextbookProgressStore = create<TextbookProgressState>()((set) => ({
  progress: {},

  fetchAll: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;
    const { data: rows, error } = await supabase
      .from('textbook_progress')
      .select('textbook_id, current_page')
      .eq('user_id', data.user.id);
    if (error || !rows) return;
    const progressMap: Record<string, number> = {};
    for (const row of rows) {
      progressMap[row.textbook_id as string] = row.current_page as number;
    }
    set({ progress: progressMap });
  },

  upsert: async (textbookId: string, currentPage: number) => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;
    const { error } = await supabase.from('textbook_progress').upsert(
      {
        user_id: data.user.id,
        textbook_id: textbookId,
        current_page: currentPage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,textbook_id' },
    );
    if (error) return;
    set((state) => ({
      progress: { ...state.progress, [textbookId]: currentPage },
    }));
  },
}));
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest store/__tests__/textbook-progress.test.ts
```

Expected: 全テスト PASS。

- [ ] **Step 5: コミットする**

```bash
git add store/textbook-progress.ts store/__tests__/textbook-progress.test.ts
git commit -m "feat: textbook-progress ストアを追加"
```

---

### Task 5: `TextbookForm` に総ページ数フィールドを追加する

**Files:**

- Modify: `__tests__/integration/textbook-form.integration.test.tsx`
- Modify: `components/textbook-form.tsx`
- Modify: `app/textbook-form.tsx`

- [ ] **Step 1: 失敗する結合テストを追加する**

`__tests__/integration/textbook-form.integration.test.tsx` の既存の `describe` ブロック末尾に追記する。

```ts
  it('totalPages を入力して保存すると onSubmit に数値が渡される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('教本名'), 'ローズ 32のエチュード');
    fireEvent.changeText(screen.getByLabelText('総ページ数'), '100');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ totalPages: 100 });
  });

  it('totalPages に 0 を入力するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('教本名'), 'テスト教本');
    fireEvent.changeText(screen.getByLabelText('総ページ数'), '0');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('1以上の整数を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('defaultValues に totalPages が含まれるとフォームに表示される', () => {
    renderWithProviders(
      <TextbookForm
        defaultValues={{ title: 'テスト', totalPages: 80 }}
      />,
    );
    expect(screen.getByLabelText('総ページ数').props.value).toBe('80');
  });
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest __tests__/integration/textbook-form.integration.test.tsx
```

Expected: 新規テスト 3 件が FAIL（`総ページ数` ラベルが見つからない）。

- [ ] **Step 3: `components/textbook-form.tsx` を更新する**

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { DIFFICULTY_OPTIONS, type TextbookInput, textbookSchema } from '@/forms/textbook';

const defaultOnSubmit = (_values: TextbookInput) => {
  Alert.alert('保存しました');
};

type Props = {
  defaultValues?: TextbookInput;
  onSubmit?: (values: TextbookInput) => void | Promise<void>;
  onDelete?: () => void;
};

export function TextbookForm({ defaultValues, onSubmit = defaultOnSubmit, onDelete }: Props) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TextbookInput>({
    resolver: zodResolver(textbookSchema),
    mode: 'onTouched',
    defaultValues: defaultValues ?? {
      title: '',
      publisher: '',
      difficulty: undefined,
      totalPages: undefined,
    },
  });

  return (
    <YStack gap="$4" p="$4">
      <Controller
        control={control}
        name="title"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">教本名 *</Paragraph>
            <Input
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="例: ローズ 32のエチュード"
              aria-label="教本名"
            />
            <FieldError message={errors.title?.message} />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="publisher"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">出版社</Paragraph>
            <Input
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="例: 全音楽譜出版社"
              aria-label="出版社"
            />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="difficulty"
        render={({ field: { onChange, value } }) => (
          <YStack gap="$2">
            <Paragraph color="$color12">難易度</Paragraph>
            <XStack flexWrap="wrap" gap="$2">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  size="$2"
                  theme={value === opt ? 'blue' : undefined}
                  variant={value === opt ? undefined : 'outlined'}
                  onPress={() => onChange(value === opt ? undefined : opt)}
                  aria-label={`難易度 ${opt}`}
                >
                  {opt}
                </Button>
              ))}
            </XStack>
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="totalPages"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">総ページ数</Paragraph>
            <Input
              value={value !== undefined ? String(value) : ''}
              onChangeText={(t) => {
                const n = Number(t);
                onChange(t === '' || isNaN(n) ? undefined : n);
              }}
              onBlur={onBlur}
              placeholder="例: 100"
              keyboardType="numeric"
              aria-label="総ページ数"
            />
            <FieldError message={errors.totalPages?.message} />
          </YStack>
        )}
      />

      <Button theme="blue" onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
        保存
      </Button>

      {onDelete && (
        <Button theme="red" variant="outlined" onPress={onDelete} mt="$4">
          この教本を削除
        </Button>
      )}
    </YStack>
  );
}
```

- [ ] **Step 4: `app/textbook-form.tsx` の `defaultValues` に `totalPages` を追加する**

`app/textbook-form.tsx` の `defaultValues` 部分のみ変更する（13〜19行目付近）。

```ts
const defaultValues: TextbookInput | undefined = existing
  ? {
      title: existing.title,
      publisher: existing.publisher ?? undefined,
      difficulty: existing.difficulty ?? undefined,
      totalPages: existing.totalPages ?? undefined,
    }
  : undefined;
```

- [ ] **Step 5: テストが通ることを確認する**

```bash
npx jest __tests__/integration/textbook-form.integration.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 6: コミットする**

```bash
git add components/textbook-form.tsx app/textbook-form.tsx __tests__/integration/textbook-form.integration.test.tsx
git commit -m "feat: TextbookForm に総ページ数フィールドを追加"
```

---

### Task 6: `app/textbooks.tsx` を進捗バー・モーダル対応に更新する

**Files:**

- Create: `__tests__/integration/textbook-progress-modal.integration.test.tsx`
- Modify: `app/textbooks.tsx`

- [ ] **Step 1: 失敗する結合テストを作成する**

```tsx
// __tests__/integration/textbook-progress-modal.integration.test.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';

import TextbooksScreen from '@/app/textbooks';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTextbookProgressStore } from '@/store/textbook-progress';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
  useFocusEffect: () => {},
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockSupabase = () => jest.requireMock('@/lib/supabase').supabase;

describe('TextbooksScreen 進捗管理 (integration)', () => {
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
      ],
      loading: false,
    });
    useTextbookProgressStore.setState({ progress: {} });
    jest.clearAllMocks();
  });

  it('totalPages がある教本に進捗テキストが表示される', () => {
    renderWithProviders(<TextbooksScreen />);
    expect(screen.getByText('0 / 32')).toBeTruthy();
  });

  it('進捗がある教本には現在ページが表示される', () => {
    useTextbookProgressStore.setState({ progress: { 'tb-1': 10 } });
    renderWithProviders(<TextbooksScreen />);
    expect(screen.getByText('10 / 32')).toBeTruthy();
  });

  it('行をタップするとモーダルが開く', async () => {
    renderWithProviders(<TextbooksScreen />);
    fireEvent.press(screen.getByLabelText('ローズ 32のエチュードの進捗を更新'));
    await waitFor(() => {
      expect(screen.getByText('/ 32 ページ')).toBeTruthy();
    });
  });

  it('モーダルでページを入力して保存すると upsert が呼ばれる', async () => {
    mockSupabase().auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const upsertMock = jest.fn().mockResolvedValue({ error: null });
    mockSupabase().from.mockReturnValue({ upsert: upsertMock });

    renderWithProviders(<TextbooksScreen />);
    fireEvent.press(screen.getByLabelText('ローズ 32のエチュードの進捗を更新'));

    await waitFor(() => {
      expect(screen.getByLabelText('現在ページ')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('現在ページ'), '15');
    fireEvent.press(screen.getByText('保存'));

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({ textbook_id: 'tb-1', current_page: 15 }),
        { onConflict: 'user_id,textbook_id' },
      );
    });
  });

  it('totalPages が未設定の教本をタップすると Alert が表示される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: [
        {
          id: 'tb-2',
          title: 'ページなし教本',
          publisher: null,
          difficulty: null,
          totalPages: null,
        },
      ],
      loading: false,
    });
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    renderWithProviders(<TextbooksScreen />);
    fireEvent.press(screen.getByLabelText('ページなし教本の進捗を更新'));
    expect(alertSpy).toHaveBeenCalledWith('総ページ数が未設定です', expect.any(String));
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest __tests__/integration/textbook-progress-modal.integration.test.tsx
```

Expected: テストが FAIL（`TextbooksScreen` に進捗バーやモーダルがない）。

- [ ] **Step 3: `app/textbooks.tsx` を更新する**

```tsx
import { Link, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, View } from 'react-native';
import { Button, Input, Paragraph, Spinner, Text, XStack, YStack } from 'tamagui';

import { type Textbook, useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTextbookProgressStore } from '@/store/textbook-progress';

const DIFFICULTY_COLORS: Record<string, string> = {
  初心者: '#a6e3a1',
  初中級: '#fab387',
  中級: '#f9e2af',
  上級: '#f38ba8',
};

export default function TextbooksScreen() {
  const textbooks = useTextbookCatalogStore((s) => s.textbooks);
  const loading = useTextbookCatalogStore((s) => s.loading);
  const fetchAll = useTextbookCatalogStore((s) => s.fetchAll);
  const remove = useTextbookCatalogStore((s) => s.remove);
  const progress = useTextbookProgressStore((s) => s.progress);
  const fetchAllProgress = useTextbookProgressStore((s) => s.fetchAll);
  const upsert = useTextbookProgressStore((s) => s.upsert);

  const [modalTextbook, setModalTextbook] = useState<Textbook | null>(null);
  const [modalPage, setModalPage] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      fetchAllProgress();
    }, [fetchAll, fetchAllProgress]),
  );

  const handleLongPress = (textbook: Textbook) => {
    Alert.alert('教本を削除', `「${textbook.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => remove(textbook.id) },
    ]);
  };

  const handleRowPress = (textbook: Textbook) => {
    if (!textbook.totalPages) {
      Alert.alert('総ページ数が未設定です', '教本の編集画面で総ページ数を設定してください');
      return;
    }
    setModalPage(String(progress[textbook.id] ?? 0));
    setModalTextbook(textbook);
  };

  const handleModalSave = async () => {
    if (!modalTextbook) return;
    const page = Number(modalPage);
    if (isNaN(page) || page < 0) return;
    await upsert(modalTextbook.id, page);
    setModalTextbook(null);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '教本管理',
          headerRight: () => (
            <Link href="/textbook-form" style={{ marginRight: 12 }}>
              <Text color="$blue10">＋ 追加</Text>
            </Link>
          ),
        }}
      />
      {loading ? (
        <YStack flex={1} items="center" justify="center">
          <Spinner />
        </YStack>
      ) : (
        <FlatList
          data={textbooks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <YStack items="center" justify="center" mt="$8">
              <Paragraph color="$color10">教本が登録されていません</Paragraph>
            </YStack>
          }
          renderItem={({ item }) => (
            <XStack
              bg="$color2"
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$4"
              mb="$2"
              overflow="hidden"
              items="center"
            >
              <Pressable
                onPress={() => handleRowPress(item)}
                onLongPress={() => handleLongPress(item)}
                style={{ flex: 1, padding: 12 }}
                aria-label={`${item.title}の進捗を更新`}
              >
                <XStack items="center" justify="space-between">
                  <Paragraph fontWeight="bold" flex={1}>
                    {item.title}
                  </Paragraph>
                  {item.difficulty && (
                    <Text
                      fontSize={11}
                      px="$2"
                      py="$1"
                      rounded="$2"
                      style={{ backgroundColor: DIFFICULTY_COLORS[item.difficulty] ?? '#ccc' }}
                      color="$color1"
                    >
                      {item.difficulty}
                    </Text>
                  )}
                </XStack>
                {item.publisher && (
                  <Paragraph size="$2" color="$color10">
                    {item.publisher}
                  </Paragraph>
                )}
                {item.totalPages && (
                  <XStack items="center" gap="$2" mt="$1">
                    <View
                      style={{
                        flex: 1,
                        height: 6,
                        backgroundColor: '#e0e0e0',
                        borderRadius: 3,
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.min(100, Math.round(((progress[item.id] ?? 0) / item.totalPages) * 100))}%`,
                          height: 6,
                          backgroundColor: '#4a9eff',
                          borderRadius: 3,
                        }}
                      />
                    </View>
                    <Text fontSize={11} color="$color10">
                      {progress[item.id] ?? 0} / {item.totalPages}
                    </Text>
                  </XStack>
                )}
              </Pressable>
              <Pressable
                onPress={() => router.push(`/textbook-form?id=${item.id}`)}
                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                aria-label={`${item.title}を編集`}
              >
                <Text color="$color10" fontSize={20}>
                  ›
                </Text>
              </Pressable>
            </XStack>
          )}
        />
      )}

      <Modal
        visible={modalTextbook !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalTextbook(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <YStack bg="$background" rounded="$4" p="$4" gap="$3">
            <Paragraph fontWeight="bold" numberOfLines={1}>
              {modalTextbook?.title}
            </Paragraph>
            <XStack items="center" gap="$2">
              <Input
                value={modalPage}
                onChangeText={setModalPage}
                keyboardType="numeric"
                style={{ width: 80, textAlign: 'center' }}
                aria-label="現在ページ"
              />
              <Paragraph color="$color10">/ {modalTextbook?.totalPages} ページ</Paragraph>
            </XStack>
            <XStack gap="$2">
              <Button flex={1} variant="outlined" onPress={() => setModalTextbook(null)}>
                キャンセル
              </Button>
              <Button flex={1} theme="blue" onPress={handleModalSave}>
                保存
              </Button>
            </XStack>
          </YStack>
        </View>
      </Modal>
    </>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest __tests__/integration/textbook-progress-modal.integration.test.tsx
```

Expected: 全テスト PASS。

- [ ] **Step 5: 品質チェック 4 ステップを通す**

```bash
npm run lint
npm run format:check
npx tsc --noEmit
npm test
```

Expected: エラー・差分・型エラー・テスト失敗のいずれも 0 件。

差分があれば `npm run lint:fix` / `npm run format` で修正後に再実行。

- [ ] **Step 6: コミットする**

```bash
git add app/textbooks.tsx __tests__/integration/textbook-progress-modal.integration.test.tsx
git commit -m "feat: 教本一覧に進捗バーと更新モーダルを追加"
```
