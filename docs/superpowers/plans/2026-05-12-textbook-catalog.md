# 練習教本カタログ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `textbooks` テーブルを Supabase に作成し、設定タブから教本の追加・編集・削除ができる画面を実装する。

**Architecture:** `instrument-catalog` のパターンに倣い、Supabase を Single Source of Truth として Zustand + AsyncStorage でキャッシュする。画面は Root Stack に `app/textbooks.tsx`（一覧）と `app/textbook-form.tsx`（追加/編集）を追加し、設定タブから `router.push('/textbooks')` で遷移する。

**Tech Stack:** Supabase (PostgreSQL / RLS), Zustand v5, Zod v4, React Hook Form + zodResolver, Tamagui, expo-router v6

---

### Task 1: DB マイグレーション作成と適用

**Files:**

- Create: `supabase/migrations/20260512000000_add_textbooks.sql`

- [ ] **Step 1: マイグレーション SQL ファイルを作成する**

`supabase/migrations/20260512000000_add_textbooks.sql` を以下の内容で作成する:

```sql
create table textbooks (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  publisher  text,
  difficulty text        check (difficulty in ('初心者', '初中級', '中級', '上級')),
  created_at timestamptz default now()
);

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

- [ ] **Step 2: Supabase MCP でマイグレーションを適用する**

`mcp__supabase__apply_migration` ツールを以下のパラメータで呼び出す:

- `name`: `"20260512000000_add_textbooks"`
- `query`: Step 1 の SQL の全文

適用後、`mcp__supabase__list_tables` を呼んで `textbooks` がリストに現れることを確認する。

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260512000000_add_textbooks.sql
git commit -m "feat: textbooks テーブルとRLSポリシーを追加"
```

---

### Task 2: Zod スキーマと単体テスト

**Files:**

- Create: `forms/textbook.ts`
- Create: `forms/__tests__/textbook.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`forms/__tests__/textbook.test.ts` を作成する:

```ts
import { textbookSchema } from '@/forms/textbook';

describe('textbookSchema', () => {
  it('title のみで有効', () => {
    expect(textbookSchema.safeParse({ title: 'ローズ' }).success).toBe(true);
  });

  it('全フィールドが揃っていれば有効', () => {
    expect(
      textbookSchema.safeParse({
        title: 'ローズ 32のエチュード',
        publisher: '全音楽譜出版社',
        difficulty: '中級',
      }).success,
    ).toBe(true);
  });

  it('title が空文字のとき拒否する', () => {
    const r = textbookSchema.safeParse({ title: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['title']);
  });

  it('difficulty が無効な値のとき拒否する', () => {
    const r = textbookSchema.safeParse({ title: 'テスト', difficulty: '超上級' });
    expect(r.success).toBe(false);
  });

  it('difficulty が省略可能', () => {
    expect(textbookSchema.safeParse({ title: 'テスト' }).success).toBe(true);
  });

  it('publisher が省略可能', () => {
    expect(textbookSchema.safeParse({ title: 'テスト' }).success).toBe(true);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest forms/__tests__/textbook.test.ts
```

期待: `Cannot find module '@/forms/textbook'` でエラー

- [ ] **Step 3: スキーマを実装する**

`forms/textbook.ts` を作成する:

```ts
import { z } from 'zod';

export const DIFFICULTY_OPTIONS = ['初心者', '初中級', '中級', '上級'] as const;
export type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];

export const textbookSchema = z.object({
  title: z.string().min(1, '教本名を入力してください'),
  publisher: z.string().optional(),
  difficulty: z.enum(DIFFICULTY_OPTIONS).optional(),
});

export type TextbookInput = z.infer<typeof textbookSchema>;
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest forms/__tests__/textbook.test.ts
```

期待: 6件 PASS

- [ ] **Step 5: コミット**

```bash
git add forms/textbook.ts forms/__tests__/textbook.test.ts
git commit -m "feat: textbookSchema と Difficulty 型を追加"
```

---

### Task 3: Zustand ストアと単体テスト

**Files:**

- Create: `store/textbook-catalog.ts`
- Create: `store/__tests__/textbook-catalog.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`store/__tests__/textbook-catalog.test.ts` を作成する:

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
  { id: 'tb-1', title: 'ローズ 32のエチュード', publisher: '全音楽譜出版社', difficulty: '中級' },
  { id: 'tb-2', title: 'クローゼ 教則本', publisher: null, difficulty: '上級' },
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
    });
  });

  it('fetchAll がエラーを返してもキャッシュが維持される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: rows.map((r) => ({
        ...r,
        publisher: r.publisher ?? null,
        difficulty: r.difficulty as '中級' | '上級',
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
            data: { id: 'tb-new', title: '新しい教本', publisher: null, difficulty: null },
            error: null,
          }),
        }),
      }),
    });
    await useTextbookCatalogStore.getState().add({ title: '新しい教本' });
    const { textbooks } = useTextbookCatalogStore.getState();
    expect(textbooks.some((t) => t.title === '新しい教本')).toBe(true);
  });

  it('update で該当教本のタイトルが更新される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: [{ id: 'tb-1', title: '旧タイトル', publisher: null, difficulty: null }],
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useTextbookCatalogStore.getState().update('tb-1', { title: '新タイトル' });
    const t = useTextbookCatalogStore.getState().textbooks.find((x) => x.id === 'tb-1');
    expect(t?.title).toBe('新タイトル');
  });

  it('remove で該当教本が削除される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: [{ id: 'tb-1', title: 'ローズ', publisher: null, difficulty: null }],
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

期待: `Cannot find module '@/store/textbook-catalog'` でエラー

- [ ] **Step 3: ストアを実装する**

`store/textbook-catalog.ts` を作成する:

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

期待: 7件 PASS

- [ ] **Step 5: コミット**

```bash
git add store/textbook-catalog.ts store/__tests__/textbook-catalog.test.ts
git commit -m "feat: useTextbookCatalogStore を追加"
```

---

### Task 4: フォームコンポーネントと結合テスト

**Files:**

- Create: `components/textbook-form.tsx`
- Create: `__tests__/integration/textbook-form.integration.test.tsx`

- [ ] **Step 1: 失敗する結合テストを書く**

`__tests__/integration/textbook-form.integration.test.tsx` を作成する:

```tsx
import { fireEvent, waitFor } from '@testing-library/react-native';

import { TextbookForm } from '@/components/textbook-form';
import { renderWithProviders, screen } from '@/test-utils/render';

describe('TextbookForm (integration)', () => {
  it('教本名が空のまま保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('教本名を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('教本名と難易度を入力して保存すると onSubmit が正しい値で呼ばれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('教本名'), 'ローズ 32のエチュード');
    fireEvent.changeText(screen.getByLabelText('出版社'), '全音楽譜出版社');
    fireEvent.press(screen.getByLabelText('難易度 中級'));
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'ローズ 32のエチュード',
      publisher: '全音楽譜出版社',
      difficulty: '中級',
    });
  });

  it('onDelete が渡されると削除ボタンが表示され、タップで呼ばれる', () => {
    const onDelete = jest.fn();
    renderWithProviders(<TextbookForm onDelete={onDelete} />);
    expect(screen.getByText('この教本を削除')).toBeTruthy();
    fireEvent.press(screen.getByText('この教本を削除'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('onDelete が渡されないと削除ボタンが表示されない', () => {
    renderWithProviders(<TextbookForm />);
    expect(screen.queryByText('この教本を削除')).toBeNull();
  });

  it('defaultValues が渡されるとフォームに初期値が表示される', () => {
    renderWithProviders(
      <TextbookForm
        defaultValues={{ title: 'クローゼ 教則本', publisher: '音楽之友社', difficulty: '上級' }}
      />,
    );
    expect(screen.getByLabelText('教本名').props.value).toBe('クローゼ 教則本');
    expect(screen.getByLabelText('出版社').props.value).toBe('音楽之友社');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest __tests__/integration/textbook-form.integration.test.tsx
```

期待: `Cannot find module '@/components/textbook-form'` でエラー

- [ ] **Step 3: フォームコンポーネントを実装する**

`components/textbook-form.tsx` を作成する:

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
    defaultValues: defaultValues ?? { title: '', publisher: '', difficulty: undefined },
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

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest __tests__/integration/textbook-form.integration.test.tsx
```

期待: 5件 PASS

- [ ] **Step 5: コミット**

```bash
git add components/textbook-form.tsx __tests__/integration/textbook-form.integration.test.tsx
git commit -m "feat: TextbookForm コンポーネントと結合テストを追加"
```

---

### Task 5: 教本一覧画面

**Files:**

- Create: `app/textbooks.tsx`

- [ ] **Step 1: 一覧画面を実装する**

`app/textbooks.tsx` を作成する:

```tsx
import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, FlatList, Pressable } from 'react-native';
import { Paragraph, Spinner, Text, XStack, YStack } from 'tamagui';

import { type Textbook, useTextbookCatalogStore } from '@/store/textbook-catalog';

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

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const handleLongPress = (textbook: Textbook) => {
    Alert.alert('教本を削除', `「${textbook.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => remove(textbook.id) },
    ]);
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
            <Pressable
              onPress={() =>
                (require('expo-router').router as typeof import('expo-router').router).push(
                  `/textbook-form?id=${item.id}`,
                )
              }
              onLongPress={() => handleLongPress(item)}
              style={{ marginBottom: 8 }}
            >
              <XStack
                bg="$color2"
                borderWidth={1}
                borderColor="$borderColor"
                borderRadius="$4"
                p="$3"
                items="center"
                justify="space-between"
              >
                <YStack flex={1}>
                  <Paragraph fontWeight="bold">{item.title}</Paragraph>
                  {item.publisher && (
                    <Paragraph size="$2" color="$color10">
                      {item.publisher}
                    </Paragraph>
                  )}
                </YStack>
                {item.difficulty && (
                  <Text
                    fontSize={11}
                    px="$2"
                    py="$1"
                    borderRadius="$2"
                    style={{ backgroundColor: DIFFICULTY_COLORS[item.difficulty] ?? '#ccc' }}
                    color="$color1"
                  >
                    {item.difficulty}
                  </Text>
                )}
              </XStack>
            </Pressable>
          )}
        />
      )}
    </>
  );
}
```

**注意:** `router.push` を `Pressable` の `onPress` 内で使う場合、`import { router } from 'expo-router'` をトップレベルでインポートする方が読みやすい。上記の `require` パターンは使わず、以下のように書き直すこと:

ファイル冒頭の import を以下に変更:

```tsx
import { Link, router, Stack, useFocusEffect } from 'expo-router';
```

`onPress` を以下に変更:

```tsx
onPress={() => router.push(`/textbook-form?id=${item.id}`)}
```

- [ ] **Step 2: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

期待: エラー 0 件

- [ ] **Step 3: コミット**

```bash
git add app/textbooks.tsx
git commit -m "feat: 教本一覧画面を追加"
```

---

### Task 6: 教本追加/編集画面

**Files:**

- Create: `app/textbook-form.tsx`

- [ ] **Step 1: 追加/編集画面を実装する**

`app/textbook-form.tsx` を作成する:

```tsx
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView } from 'react-native';

import { TextbookForm } from '@/components/textbook-form';
import { type TextbookInput } from '@/forms/textbook';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

export default function TextbookFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const textbooks = useTextbookCatalogStore((s) => s.textbooks);
  const add = useTextbookCatalogStore((s) => s.add);
  const update = useTextbookCatalogStore((s) => s.update);
  const remove = useTextbookCatalogStore((s) => s.remove);

  const existing = id ? textbooks.find((t) => t.id === id) : undefined;

  const defaultValues: TextbookInput | undefined = existing
    ? {
        title: existing.title,
        publisher: existing.publisher ?? undefined,
        difficulty: existing.difficulty ?? undefined,
      }
    : undefined;

  const handleSave = async (values: TextbookInput) => {
    if (id) {
      await update(id, values);
    } else {
      await add(values);
    }
    router.back();
  };

  const handleDelete = () => {
    if (!id || !existing) return;
    Alert.alert('教本を削除', `「${existing.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await remove(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: id ? '教本を編集' : '教本を追加',
        }}
      />
      <ScrollView>
        <TextbookForm
          defaultValues={defaultValues}
          onSubmit={handleSave}
          onDelete={id ? handleDelete : undefined}
        />
      </ScrollView>
    </>
  );
}
```

- [ ] **Step 2: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

期待: エラー 0 件

- [ ] **Step 3: コミット**

```bash
git add app/textbook-form.tsx
git commit -m "feat: 教本追加/編集画面を追加"
```

---

### Task 7: 設定タブに導線を追加

**Files:**

- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: 設定画面に「教本管理」メニューを追加する**

`app/(tabs)/settings.tsx` を以下に置き換える:

```tsx
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

export default function Settings() {
  return (
    <YStack flex={1} p="$4" gap="$3">
      <Pressable onPress={() => router.push('/textbooks')}>
        <XStack
          items="center"
          justify="space-between"
          p="$4"
          bg="$color2"
          borderRadius="$4"
          borderWidth={1}
          borderColor="$borderColor"
        >
          <Paragraph>📚 教本管理</Paragraph>
          <Paragraph color="$color10">›</Paragraph>
        </XStack>
      </Pressable>
    </YStack>
  );
}
```

- [ ] **Step 2: TypeScript エラーがないことを確認する**

```bash
npx tsc --noEmit
```

期待: エラー 0 件

- [ ] **Step 3: コミット**

```bash
git add app/(tabs)/settings.tsx
git commit -m "feat: 設定タブに教本管理への導線を追加"
```

---

### Task 8: 品質チェックと最終コミット

- [ ] **Step 1: ESLint を実行する**

```bash
npm run lint
```

期待: エラー 0 件。警告があれば `npm run lint:fix` で修正して再確認。

- [ ] **Step 2: Prettier を確認する**

```bash
npm run format:check
```

期待: 差分 0 件。差分があれば `npm run format` で整形して再確認。

- [ ] **Step 3: TypeScript を確認する**

```bash
npx tsc --noEmit
```

期待: エラー 0 件

- [ ] **Step 4: 全テストを実行する**

```bash
npm test
```

期待: 既存テストを含む全件 PASS

- [ ] **Step 5: 品質チェック通過後にまとめてコミット（修正があった場合のみ）**

lint/format で自動修正が生じた場合のみコミットする:

```bash
git add -A
git commit -m "style: lint・format 自動修正"
```
