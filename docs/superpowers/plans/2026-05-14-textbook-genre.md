# 教本ジャンル紐づけ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 教本に 6 択固定ジャンルを追加し、教本一覧画面をジャンル別セクション表示に変更する。

**Architecture:** DB に CHECK 制約付き `genre` 列を追加。`forms/textbook.ts` の zod スキーマで必須バリデーション、`store/textbook-catalog.ts` でスネーク→キャメル変換、`components/textbook-form.tsx` でトグルボタン選択 UI、`app/textbooks.tsx` で FlatList → SectionList 置換。

**Tech Stack:** zod v4 (`z.enum`), React Hook Form + Controller, Tamagui Button トグル, React Native SectionList, Supabase マイグレーション, Zustand store

---

## ファイル構成

| ファイル                                                             | 変更種別 | 内容                                                            |
| -------------------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| `supabase/migrations/20260514000001_add_genre_to_textbooks.sql`      | CREATE   | `genre` 列追加                                                  |
| `forms/textbook.ts`                                                  | MODIFY   | `GENRE_OPTIONS` / `Genre` 型 / `textbookSchema` に `genre` 追加 |
| `forms/__tests__/textbook.test.ts`                                   | MODIFY   | `genre` テスト追加 + 既存テスト (valid ペイロード) 更新         |
| `store/textbook-catalog.ts`                                          | MODIFY   | `Textbook` 型・CRUD 操作に `genre` 追加                         |
| `store/__tests__/textbook-catalog.test.ts`                           | MODIFY   | モックデータ・`setState` 呼び出しに `genre` 追加                |
| `components/textbook-form.tsx`                                       | MODIFY   | ジャンル選択 UI (`Controller` + ボタントグル) 追加              |
| `app/textbook-form.tsx`                                              | MODIFY   | `defaultValues` の `genre` マッピング追加                       |
| `__tests__/integration/textbook-form.integration.test.tsx`           | MODIFY   | `genre` テスト追加 + 既存テスト (成功パス) 更新                 |
| `__tests__/integration/textbook-progress-modal.integration.test.tsx` | MODIFY   | `setState` 呼び出しに `genre` 追加 (型エラー解消)               |
| `app/textbooks.tsx`                                                  | MODIFY   | `FlatList` → `SectionList` に変更                               |

---

### Task 1: DB マイグレーション

**Files:**

- Create: `supabase/migrations/20260514000001_add_genre_to_textbooks.sql`

- [ ] **Step 1: マイグレーションファイルを作成する**

`supabase/migrations/20260514000001_add_genre_to_textbooks.sql`:

```sql
ALTER TABLE textbooks
  ADD COLUMN genre text NOT NULL DEFAULT 'その他'
    CHECK (genre IN ('スケール', 'エチュード', 'ソナタ', 'コンチェルト', 'アンサンブル', 'その他'));
```

- [ ] **Step 2: コミットする**

```bash
git add supabase/migrations/20260514000001_add_genre_to_textbooks.sql
git commit -m "feat: textbooks テーブルに genre 列を追加するマイグレーション"
```

---

### Task 2: forms/textbook.ts — GENRE_OPTIONS + genre スキーマ追加

**Files:**

- Modify: `forms/textbook.ts`
- Modify: `forms/__tests__/textbook.test.ts`

- [ ] **Step 1: genre の失敗するテストを書く**

`forms/__tests__/textbook.test.ts` の `describe` ブロック末尾に追加:

```ts
it('genre が未指定のとき拒否する', () => {
  const r = textbookSchema.safeParse({ title: 'テスト' });
  expect(r.success).toBe(false);
  if (!r.success) expect(r.error.issues[0].message).toBe('ジャンルを選択してください');
});

it('genre に有効な値を渡すと pass', () => {
  for (const g of [
    'スケール',
    'エチュード',
    'ソナタ',
    'コンチェルト',
    'アンサンブル',
    'その他',
  ] as const) {
    expect(textbookSchema.safeParse({ title: 'テスト', genre: g }).success).toBe(true);
  }
});

it('genre に無効な文字列を渡すと拒否する', () => {
  const r = textbookSchema.safeParse({ title: 'テスト', genre: 'jazz' });
  expect(r.success).toBe(false);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
npx jest forms/__tests__/textbook.test.ts
```

期待: `genre が未指定のとき拒否する` が FAIL (`success` が `true` を返す — genre フィールドはまだ存在しないため)

- [ ] **Step 3: forms/textbook.ts を更新する**

```ts
import { z } from 'zod';

export const DIFFICULTY_OPTIONS = ['初心者', '初中級', '中級', '上級'] as const;
export type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];

export const GENRE_OPTIONS = [
  'スケール',
  'エチュード',
  'ソナタ',
  'コンチェルト',
  'アンサンブル',
  'その他',
] as const;
export type Genre = (typeof GENRE_OPTIONS)[number];

export const textbookSchema = z.object({
  title: z.string().min(1, '教本名を入力してください'),
  publisher: z.string().optional(),
  genre: z.enum(GENRE_OPTIONS, { error: 'ジャンルを選択してください' }),
  difficulty: z.enum(DIFFICULTY_OPTIONS).optional(),
  totalPages: z.number().int().min(1, '1以上の整数を入力してください').optional(),
});

export type TextbookInput = z.infer<typeof textbookSchema>;
```

- [ ] **Step 4: 既存テストのペイロードに genre を追加してファイルを丸ごと差し替える**

`genre` を必須にしたことで `{ title: 'xxx' }` のみのペイロードは `success: false` になる。`success: true` を期待するテストと path チェックのあるテストに `genre: 'エチュード'` を追加する。

`forms/__tests__/textbook.test.ts` 全体を以下に置換する:

```ts
import { textbookSchema } from '@/forms/textbook';

describe('textbookSchema', () => {
  it('title と genre で有効', () => {
    expect(textbookSchema.safeParse({ title: 'ローズ', genre: 'エチュード' }).success).toBe(true);
  });

  it('全フィールドが揃っていれば有効', () => {
    expect(
      textbookSchema.safeParse({
        title: 'ローズ 32のエチュード',
        publisher: '全音楽譜出版社',
        genre: 'エチュード',
        difficulty: '中級',
      }).success,
    ).toBe(true);
  });

  it('title が空文字のとき拒否する', () => {
    const r = textbookSchema.safeParse({ title: '', genre: 'エチュード' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['title']);
  });

  it('difficulty が無効な値のとき拒否する', () => {
    const r = textbookSchema.safeParse({
      title: 'テスト',
      genre: 'エチュード',
      difficulty: '超上級',
    });
    expect(r.success).toBe(false);
  });

  it('difficulty が省略可能', () => {
    expect(textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード' }).success).toBe(true);
  });

  it('publisher が省略可能', () => {
    expect(textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード' }).success).toBe(true);
  });

  it('totalPages が省略可能', () => {
    expect(textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード' }).success).toBe(true);
  });

  it('totalPages に正整数を渡すと有効', () => {
    expect(
      textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード', totalPages: 100 }).success,
    ).toBe(true);
  });

  it('totalPages に 0 を渡すと拒否する', () => {
    const r = textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード', totalPages: 0 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['totalPages']);
  });

  it('totalPages に負数を渡すと拒否する', () => {
    const r = textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード', totalPages: -1 });
    expect(r.success).toBe(false);
  });

  it('totalPages に小数を渡すと拒否する', () => {
    const r = textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード', totalPages: 1.5 });
    expect(r.success).toBe(false);
  });

  it('genre が未指定のとき拒否する', () => {
    const r = textbookSchema.safeParse({ title: 'テスト' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('ジャンルを選択してください');
  });

  it('genre に有効な値を渡すと pass', () => {
    for (const g of [
      'スケール',
      'エチュード',
      'ソナタ',
      'コンチェルト',
      'アンサンブル',
      'その他',
    ] as const) {
      expect(textbookSchema.safeParse({ title: 'テスト', genre: g }).success).toBe(true);
    }
  });

  it('genre に無効な文字列を渡すと拒否する', () => {
    const r = textbookSchema.safeParse({ title: 'テスト', genre: 'jazz' });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 5: テストを実行してパスを確認する**

```bash
npx jest forms/__tests__/textbook.test.ts
```

期待: 全テスト PASS

- [ ] **Step 6: コミットする**

```bash
git add forms/textbook.ts forms/__tests__/textbook.test.ts
git commit -m "feat: textbookSchema に genre フィールドを追加"
```

---

### Task 3: store/textbook-catalog.ts — Textbook 型と CRUD に genre 追加

**Files:**

- Modify: `store/textbook-catalog.ts`
- Modify: `store/__tests__/textbook-catalog.test.ts`

- [ ] **Step 1: store テストを更新する (genre 含むモックデータへ差し替え)**

`store/__tests__/textbook-catalog.test.ts` 全体を以下に置換する:

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
    genre: 'エチュード',
    difficulty: '中級',
    total_pages: 32,
  },
  {
    id: 'tb-2',
    title: 'クローゼ 教則本',
    publisher: null,
    genre: 'エチュード',
    difficulty: '上級',
    total_pages: null,
  },
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
      genre: 'エチュード',
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
        genre: r.genre as 'エチュード',
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
              genre: 'スケール',
              difficulty: null,
              total_pages: 80,
            },
            error: null,
          }),
        }),
      }),
    });
    await useTextbookCatalogStore.getState().add({
      title: '新しい教本',
      genre: 'スケール',
      totalPages: 80,
    });
    const { textbooks } = useTextbookCatalogStore.getState();
    const added = textbooks.find((t) => t.title === '新しい教本');
    expect(added).toBeDefined();
    expect(added?.totalPages).toBe(80);
    expect(added?.genre).toBe('スケール');
  });

  it('update で該当教本の title / genre / totalPages が更新される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: [
        {
          id: 'tb-1',
          title: '旧タイトル',
          publisher: null,
          genre: 'その他',
          difficulty: null,
          totalPages: null,
        },
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
      .update('tb-1', { title: '新タイトル', genre: 'ソナタ', totalPages: 60 });
    const t = useTextbookCatalogStore.getState().textbooks.find((x) => x.id === 'tb-1');
    expect(t?.title).toBe('新タイトル');
    expect(t?.totalPages).toBe(60);
    expect(t?.genre).toBe('ソナタ');
  });

  it('remove で該当教本が削除される', async () => {
    useTextbookCatalogStore.setState({
      textbooks: [
        {
          id: 'tb-1',
          title: 'ローズ',
          publisher: null,
          genre: 'エチュード',
          difficulty: null,
          totalPages: null,
        },
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

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
npx jest store/__tests__/textbook-catalog.test.ts
```

期待: `fetchAll で textbooks がセットされる` が FAIL (`genre` プロパティが実際のオブジェクトにまだない)

- [ ] **Step 3: store/textbook-catalog.ts を更新する**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type Difficulty, type Genre, type TextbookInput } from '@/forms/textbook';
import { supabase } from '@/lib/supabase';

export type Textbook = {
  id: string;
  title: string;
  publisher: string | null;
  genre: Genre;
  difficulty: Difficulty | null;
  totalPages: number | null;
};

type TextbookCatalogState = {
  textbooks: Textbook[];
  /** fetchAll ローディング専用。ミューテーション (add/update/remove) はローディング管理しない */
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
            genre: row.genre as Genre,
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
            genre: input.genre,
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
              genre: data.genre as Genre,
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
            genre: input.genre,
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
                  genre: input.genre,
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

- [ ] **Step 4: テストを実行してパスを確認する**

```bash
npx jest store/__tests__/textbook-catalog.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミットする**

```bash
git add store/textbook-catalog.ts store/__tests__/textbook-catalog.test.ts
git commit -m "feat: Textbook 型と CRUD 操作に genre を追加"
```

---

### Task 4: components/textbook-form.tsx — ジャンル選択 UI 追加

**Files:**

- Modify: `components/textbook-form.tsx`
- Modify: `app/textbook-form.tsx`
- Modify: `__tests__/integration/textbook-form.integration.test.tsx`
- Modify: `__tests__/integration/textbook-progress-modal.integration.test.tsx`

- [ ] **Step 1: 失敗する integration テストを書く**

`__tests__/integration/textbook-form.integration.test.tsx` の既存 `describe` ブロック末尾に追加:

```ts
  it('ジャンルを未選択で保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('教本名'), 'ローズ 32のエチュード');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('ジャンルを選択してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ジャンルボタンをタップすると選択状態になり保存が通る', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('教本名'), 'ローズ 32のエチュード');
    fireEvent.press(screen.getByLabelText('ジャンル エチュード'));
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ genre: 'エチュード' });
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
npx jest __tests__/integration/textbook-form.integration.test.tsx
```

期待: 新しい 2 テストが FAIL (ジャンル UI がまだない)。既存テストも genre 未選択で `onSubmit` が呼ばれず失敗するものがある。

- [ ] **Step 3: components/textbook-form.tsx を更新する**

ジャンル `Controller` を「教本名」と「出版社」の間に追加する。ジャンルは必須のため、選択済みボタンを再タップしても解除しない (`onChange(opt)` のみ、トグル解除なし)。

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Input, Paragraph, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import {
  DIFFICULTY_OPTIONS,
  GENRE_OPTIONS,
  type TextbookInput,
  textbookSchema,
} from '@/forms/textbook';

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
      genre: undefined,
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
        name="genre"
        render={({ field: { onChange, value } }) => (
          <YStack gap="$2">
            <Paragraph color="$color12">ジャンル *</Paragraph>
            <XStack flexWrap="wrap" gap="$2">
              {GENRE_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  size="$2"
                  theme={value === opt ? 'blue' : undefined}
                  variant={value === opt ? undefined : 'outlined'}
                  onPress={() => onChange(opt)}
                  aria-label={`ジャンル ${opt}`}
                >
                  {opt}
                </Button>
              ))}
            </XStack>
            <FieldError message={errors.genre?.message} />
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

- [ ] **Step 4: app/textbook-form.tsx の defaultValues に genre を追加する**

`app/textbook-form.tsx` の `defaultValues` 変数のみ変更する (他の部分は変更不要):

```ts
const defaultValues: TextbookInput | undefined = existing
  ? {
      title: existing.title,
      publisher: existing.publisher ?? undefined,
      genre: existing.genre,
      difficulty: existing.difficulty ?? undefined,
      totalPages: existing.totalPages ?? undefined,
    }
  : undefined;
```

- [ ] **Step 5: 既存 integration テストを更新する**

`__tests__/integration/textbook-form.integration.test.tsx` 全体を以下に置換する。変更ポイント: (a) `onSubmit` を呼ぶ成功パスのテストに `fireEvent.press(screen.getByLabelText('ジャンル エチュード'))` を追加、(b) `defaultValues` テストに `genre` を追加。

```ts
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

  it('教本名・ジャンル・難易度を入力して保存すると onSubmit が正しい値で呼ばれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('教本名'), 'ローズ 32のエチュード');
    fireEvent.changeText(screen.getByLabelText('出版社'), '全音楽譜出版社');
    fireEvent.press(screen.getByLabelText('ジャンル エチュード'));
    fireEvent.press(screen.getByLabelText('難易度 中級'));
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'ローズ 32のエチュード',
      publisher: '全音楽譜出版社',
      genre: 'エチュード',
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
        defaultValues={{
          title: 'クローゼ 教則本',
          publisher: '音楽之友社',
          genre: 'エチュード',
          difficulty: '上級',
        }}
      />,
    );
    expect(screen.getByLabelText('教本名').props.value).toBe('クローゼ 教則本');
    expect(screen.getByLabelText('出版社').props.value).toBe('音楽之友社');
  });

  it('totalPages を入力して保存すると onSubmit に数値が渡される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('教本名'), 'ローズ 32のエチュード');
    fireEvent.press(screen.getByLabelText('ジャンル エチュード'));
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
    fireEvent.press(screen.getByLabelText('ジャンル エチュード'));
    fireEvent.changeText(screen.getByLabelText('総ページ数'), '0');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('1以上の整数を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('defaultValues に totalPages が含まれるとフォームに表示される', () => {
    renderWithProviders(
      <TextbookForm defaultValues={{ title: 'テスト', genre: 'スケール', totalPages: 80 }} />,
    );
    expect(screen.getByLabelText('総ページ数').props.value).toBe('80');
  });

  it('ジャンルを未選択で保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('教本名'), 'ローズ 32のエチュード');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('ジャンルを選択してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ジャンルボタンをタップすると選択状態になり保存が通る', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<TextbookForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('教本名'), 'ローズ 32のエチュード');
    fireEvent.press(screen.getByLabelText('ジャンル エチュード'));
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ genre: 'エチュード' });
  });
});
```

- [ ] **Step 6: textbook-progress-modal.integration.test.tsx の setState に genre を追加する**

`beforeEach` ブロックと「totalPages が未設定」テスト内の `setState` 呼び出し、それぞれの `textbooks` 配列要素に `genre` を追加する。変更箇所のみ示す:

```ts
// beforeEach 内
useTextbookCatalogStore.setState({
  textbooks: [
    {
      id: 'tb-1',
      title: 'ローズ 32のエチュード',
      publisher: null,
      genre: 'エチュード',
      difficulty: null,
      totalPages: 32,
    },
  ],
  loading: false,
});

// 「totalPages が未設定の教本をタップすると Alert が表示される」テスト内
useTextbookCatalogStore.setState({
  textbooks: [
    {
      id: 'tb-2',
      title: 'ページなし教本',
      publisher: null,
      genre: 'その他',
      difficulty: null,
      totalPages: null,
    },
  ],
  loading: false,
});
```

- [ ] **Step 7: integration テストを実行してパスを確認する**

```bash
npx jest __tests__/integration/textbook-form.integration.test.tsx __tests__/integration/textbook-progress-modal.integration.test.tsx
```

期待: 全テスト PASS

- [ ] **Step 8: コミットする**

```bash
git add components/textbook-form.tsx app/textbook-form.tsx __tests__/integration/textbook-form.integration.test.tsx __tests__/integration/textbook-progress-modal.integration.test.tsx
git commit -m "feat: TextbookForm にジャンル選択 UI を追加"
```

---

### Task 5: app/textbooks.tsx — FlatList → SectionList

**Files:**

- Modify: `app/textbooks.tsx`

- [ ] **Step 1: app/textbooks.tsx を SectionList に書き換える**

`FlatList` → `SectionList`、`GENRE_OPTIONS` を使って `sections` を計算、`renderSectionHeader` を追加する。

```tsx
import { Link, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, SectionList, View } from 'react-native';
import { Button, Input, Paragraph, Spinner, Text, XStack, YStack } from 'tamagui';

import { GENRE_OPTIONS } from '@/forms/textbook';
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

  const sections = GENRE_OPTIONS.map((genre) => ({
    title: genre,
    data: textbooks.filter((t) => t.genre === genre),
  })).filter((s) => s.data.length > 0);

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
    if (
      isNaN(page) ||
      !Number.isInteger(page) ||
      page < 0 ||
      (modalTextbook.totalPages !== null && page > modalTextbook.totalPages)
    )
      return;
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
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <YStack items="center" justify="center" mt="$8">
              <Paragraph color="$color10">教本が登録されていません</Paragraph>
            </YStack>
          }
          renderSectionHeader={({ section: { title } }) => (
            <Paragraph fontWeight="bold" color="$color10" mb="$1" mt="$2">
              {title}
            </Paragraph>
          )}
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

- [ ] **Step 2: 品質チェック 4 ステップを実行する**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

期待: ESLint エラー 0 件、Prettier 差分 0 件、TypeScript エラー 0 件、全テスト PASS

- [ ] **Step 3: コミットする**

```bash
git add app/textbooks.tsx
git commit -m "feat: 教本一覧を FlatList から SectionList (ジャンル別セクション) に変更"
```
