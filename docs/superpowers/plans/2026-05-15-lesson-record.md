# レッスン記録機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** クラリネットレッスンの日時・アドバイス・気づきを記録する専用タブと CRUD 機能を追加する。

**Architecture:** `lesson_records` テーブル（Supabase）＋ Zustand ストア＋ RHF/zod フォーム＋ expo-router タブ。練習記録とは完全に独立したエンティティとして実装する。zod スキーマとヘルパーは `forms/lesson-record.ts` に集約し、UI 非依存・単体テスト可能な形にする。

**Tech Stack:** Supabase (timestamptz + RLS), Zustand v5, React Hook Form, zod, Tamagui, expo-router v6, `@react-native-community/datetimepicker`

---

## ファイル構成

| ファイル                                                        | 新規/変更 | 役割                             |
| --------------------------------------------------------------- | --------- | -------------------------------- |
| `supabase/migrations/20260515000000_add_lesson_records.sql`     | 新規      | テーブル作成＋RLS                |
| `forms/lesson-record.ts`                                        | 新規      | zod スキーマ・日付ヘルパー       |
| `forms/__tests__/lesson-record.test.ts`                         | 新規      | フォームの単体テスト             |
| `store/lesson-record.ts`                                        | 新規      | Zustand ストア (CRUD + Supabase) |
| `store/__tests__/lesson-record.test.ts`                         | 新規      | ストアの単体テスト               |
| `components/lesson-record-form.tsx`                             | 新規      | RHF + Tamagui フォーム UI        |
| `__tests__/integration/lesson-record-form.integration.test.tsx` | 新規      | フォーム結合テスト               |
| `app/(tabs)/lesson.tsx`                                         | 新規      | レッスン一覧画面                 |
| `__tests__/integration/lesson-screen.integration.test.tsx`      | 新規      | 一覧画面結合テスト               |
| `app/lesson-record-form.tsx`                                    | 新規      | 追加・編集ルート画面             |
| `app/(tabs)/_layout.tsx`                                        | 変更      | タブバーに「レッスン」追加       |

---

### Task 1: Supabase マイグレーション

**Files:**

- Create: `supabase/migrations/20260515000000_add_lesson_records.sql`

- [ ] **Step 1: マイグレーションファイルを作成する**

```sql
create table lesson_records (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  held_at    timestamptz not null,
  advice     text,
  notes      text,
  created_at timestamptz default now()
);

alter table lesson_records enable row level security;

create policy "ユーザーは自分のレッスン記録を参照できる"
  on lesson_records for select
  using (auth.uid() = user_id);

create policy "ユーザーは自分のレッスン記録を追加できる"
  on lesson_records for insert
  with check (auth.uid() = user_id);

create policy "ユーザーは自分のレッスン記録を更新できる"
  on lesson_records for update
  using (auth.uid() = user_id);

create policy "ユーザーは自分のレッスン記録を削除できる"
  on lesson_records for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 2: MCP ツールでリモート DB にマイグレーションを適用する**

`mcp__supabase__apply_migration` を呼び出す:

- name: `add_lesson_records`
- SQL: Step 1 の内容全体

- [ ] **Step 3: `mcp__supabase__list_tables` で `lesson_records` テーブルが存在することを確認する**

- [ ] **Step 4: コミットする**

```bash
git add supabase/migrations/20260515000000_add_lesson_records.sql
git commit -m "feat: lesson_records テーブルを追加"
```

---

### Task 2: forms/lesson-record.ts — zod スキーマとヘルパー

**Files:**

- Create: `forms/lesson-record.ts`
- Create: `forms/__tests__/lesson-record.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`forms/__tests__/lesson-record.test.ts`:

```ts
import {
  combineDateTime,
  formatDate,
  formatHeldAt,
  formatTime,
  lessonRecordSchema,
  splitHeldAt,
} from '@/forms/lesson-record';

describe('lessonRecordSchema', () => {
  it('date と time が揃っていれば有効', () => {
    expect(lessonRecordSchema.safeParse({ date: '2026-05-15', time: '14:00' }).success).toBe(true);
  });

  it('advice と notes を含む場合も有効', () => {
    expect(
      lessonRecordSchema.safeParse({
        date: '2026-05-15',
        time: '14:00',
        advice: 'タンギングを軽く',
        notes: '息のスピードが足りない',
      }).success,
    ).toBe(true);
  });

  it('date が空のとき拒否する', () => {
    const r = lessonRecordSchema.safeParse({ date: '', time: '14:00' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['date']);
  });

  it('date の形式が不正のとき拒否する', () => {
    expect(lessonRecordSchema.safeParse({ date: '2026/05/15', time: '14:00' }).success).toBe(false);
  });

  it('time が空のとき拒否する', () => {
    const r = lessonRecordSchema.safeParse({ date: '2026-05-15', time: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['time']);
  });

  it('time の形式が不正のとき拒否する', () => {
    expect(lessonRecordSchema.safeParse({ date: '2026-05-15', time: '14:00:00' }).success).toBe(
      false,
    );
  });

  it('advice と notes は省略可能', () => {
    expect(lessonRecordSchema.safeParse({ date: '2026-05-15', time: '14:00' }).success).toBe(true);
  });
});

describe('combineDateTime', () => {
  it('日付と時刻を JST オフセット付き文字列に結合する', () => {
    expect(combineDateTime('2026-05-15', '14:00')).toBe('2026-05-15T14:00:00+09:00');
  });
});

describe('formatDate', () => {
  it('Date を YYYY-MM-DD 文字列にフォーマットする', () => {
    expect(formatDate(new Date(2026, 4, 15))).toBe('2026-05-15');
  });
});

describe('formatTime', () => {
  it('Date を HH:MM 文字列にフォーマットする', () => {
    expect(formatTime(new Date(2026, 4, 15, 14, 30))).toBe('14:30');
  });
});

describe('splitHeldAt', () => {
  it('ISO 文字列を YYYY-MM-DD と HH:MM に分割する', () => {
    const { date, time } = splitHeldAt('2026-05-15T05:00:00.000Z');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(time).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('formatHeldAt', () => {
  it('ISO 文字列を YYYY-MM-DD HH:MM 形式に変換する', () => {
    const result = formatHeldAt('2026-05-15T05:00:00.000Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

```bash
npx jest forms/__tests__/lesson-record.test.ts -v
```

Expected: FAIL (モジュールが存在しない)

- [ ] **Step 3: 実装する**

`forms/lesson-record.ts`:

```ts
import { z } from 'zod';

export const lessonRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください'),
  time: z.string().regex(/^\d{2}:\d{2}$/, '時刻を入力してください'),
  advice: z.string().optional(),
  notes: z.string().optional(),
});

export type LessonRecordInput = z.infer<typeof lessonRecordSchema>;

export function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function currentTime(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

export function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

export function combineDateTime(date: string, time: string): string {
  return `${date}T${time}:00+09:00`;
}

export function splitHeldAt(heldAt: string): { date: string; time: string } {
  const d = new Date(heldAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

export function formatHeldAt(heldAt: string): string {
  const { date, time } = splitHeldAt(heldAt);
  return `${date} ${time}`;
}
```

- [ ] **Step 4: テストを実行してパスすることを確認する**

```bash
npx jest forms/__tests__/lesson-record.test.ts -v
```

Expected: PASS (全件)

- [ ] **Step 5: コミットする**

```bash
git add forms/lesson-record.ts forms/__tests__/lesson-record.test.ts
git commit -m "feat: forms/lesson-record.ts — zod スキーマとヘルパーを追加"
```

---

### Task 3: store/lesson-record.ts — Zustand ストア

**Files:**

- Create: `store/lesson-record.ts`
- Create: `store/__tests__/lesson-record.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`store/__tests__/lesson-record.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useLessonRecordStore } from '@/store/lesson-record';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const mockFrom = () => jest.requireMock('@/lib/supabase').supabase.from as jest.Mock;
const mockGetUser = () => jest.requireMock('@/lib/supabase').supabase.auth.getUser as jest.Mock;

describe('useLessonRecordStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLessonRecordStore.setState({ records: [], loading: false });
    mockGetUser().mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('初期状態: records は空配列', () => {
    expect(useLessonRecordStore.getState().records).toEqual([]);
  });

  it('fetchAll で records がセットされる', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'lr-1',
              held_at: '2026-05-15T05:00:00.000Z',
              advice: 'タンギングを軽く',
              notes: null,
            },
            {
              id: 'lr-2',
              held_at: '2026-04-20T06:00:00.000Z',
              advice: null,
              notes: '息のスピードが足りない',
            },
          ],
          error: null,
        }),
      }),
    });
    await useLessonRecordStore.getState().fetchAll();
    const { records } = useLessonRecordStore.getState();
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      id: 'lr-1',
      heldAt: '2026-05-15T05:00:00.000Z',
      advice: 'タンギングを軽く',
      notes: null,
    });
    expect(records[1].notes).toBe('息のスピードが足りない');
  });

  it('fetchAll がエラーを返しても既存の records が維持される', async () => {
    useLessonRecordStore.setState({
      records: [{ id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: null, notes: null }],
    });
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: null, error: new Error('network') }),
      }),
    });
    await useLessonRecordStore.getState().fetchAll();
    expect(useLessonRecordStore.getState().records).toHaveLength(1);
  });

  it('add で records の先頭に追加される', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'lr-new',
              held_at: '2026-05-15T05:00:00.000Z',
              advice: 'アドバイス',
              notes: null,
            },
            error: null,
          }),
        }),
      }),
    });
    await useLessonRecordStore
      .getState()
      .add({ date: '2026-05-15', time: '14:00', advice: 'アドバイス', notes: '' });
    const { records } = useLessonRecordStore.getState();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('lr-new');
    expect(records[0].advice).toBe('アドバイス');
    expect(records[0].notes).toBeNull();
  });

  it('add がエラーを返すと records は変わらない', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: new Error('insert error') }),
        }),
      }),
    });
    await useLessonRecordStore
      .getState()
      .add({ date: '2026-05-15', time: '14:00', advice: '', notes: '' });
    expect(useLessonRecordStore.getState().records).toHaveLength(0);
  });

  it('update で対象 record の内容が更新される', async () => {
    useLessonRecordStore.setState({
      records: [
        { id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: '古いアドバイス', notes: null },
      ],
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore.getState().update('lr-1', {
      date: '2026-05-20',
      time: '10:00',
      advice: '新しいアドバイス',
      notes: 'メモ',
    });
    const { records } = useLessonRecordStore.getState();
    expect(records[0].advice).toBe('新しいアドバイス');
    expect(records[0].notes).toBe('メモ');
    expect(records[0].heldAt).toBe('2026-05-20T10:00:00+09:00');
  });

  it('update がエラーを返すと records は変わらない', async () => {
    useLessonRecordStore.setState({
      records: [{ id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: '元', notes: null }],
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: new Error('update error') }),
      }),
    });
    await useLessonRecordStore.getState().update('lr-1', {
      date: '2026-05-20',
      time: '10:00',
      advice: '変更後',
      notes: '',
    });
    expect(useLessonRecordStore.getState().records[0].advice).toBe('元');
  });

  it('remove で対象 record が削除される', async () => {
    useLessonRecordStore.setState({
      records: [
        { id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: null, notes: null },
        { id: 'lr-2', heldAt: '2026-04-20T06:00:00.000Z', advice: null, notes: null },
      ],
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore.getState().remove('lr-1');
    const { records } = useLessonRecordStore.getState();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('lr-2');
  });

  it('remove がエラーを返すと records は変わらない', async () => {
    useLessonRecordStore.setState({
      records: [{ id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: null, notes: null }],
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: new Error('delete error') }),
      }),
    });
    await useLessonRecordStore.getState().remove('lr-1');
    expect(useLessonRecordStore.getState().records).toHaveLength(1);
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

```bash
npx jest store/__tests__/lesson-record.test.ts -v
```

Expected: FAIL (モジュールが存在しない)

- [ ] **Step 3: 実装する**

`store/lesson-record.ts`:

```ts
import { create } from 'zustand';

import { type LessonRecordInput, combineDateTime } from '@/forms/lesson-record';
import { supabase } from '@/lib/supabase';

export type LessonRecord = {
  id: string;
  heldAt: string;
  advice: string | null;
  notes: string | null;
};

type LessonRecordRow = {
  id: string;
  held_at: string;
  advice: string | null;
  notes: string | null;
};

type LessonRecordState = {
  records: LessonRecord[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: LessonRecordInput) => Promise<void>;
  update: (id: string, input: LessonRecordInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useLessonRecordStore = create<LessonRecordState>()((set, get) => ({
  records: [],
  loading: false,

  fetchAll: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    set({ loading: true });
    const { data, error } = await supabase
      .from('lesson_records')
      .select('id, held_at, advice, notes')
      .order('held_at', { ascending: false });
    set({ loading: false });

    if (error || !data) return;

    const rows = data as LessonRecordRow[];
    set({
      records: rows.map((row) => ({
        id: row.id,
        heldAt: row.held_at,
        advice: row.advice,
        notes: row.notes,
      })),
    });
  },

  add: async (input: LessonRecordInput) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data, error } = await supabase
      .from('lesson_records')
      .insert({
        user_id: userData.user.id,
        held_at: combineDateTime(input.date, input.time),
        advice: input.advice || null,
        notes: input.notes || null,
      })
      .select('id, held_at, advice, notes')
      .single();
    if (error || !data) return;

    const row = data as LessonRecordRow;
    set({
      records: [
        { id: row.id, heldAt: row.held_at, advice: row.advice, notes: row.notes },
        ...get().records,
      ],
    });
  },

  update: async (id: string, input: LessonRecordInput) => {
    const { error } = await supabase
      .from('lesson_records')
      .update({
        held_at: combineDateTime(input.date, input.time),
        advice: input.advice || null,
        notes: input.notes || null,
      })
      .eq('id', id);
    if (error) return;

    set({
      records: get().records.map((r) =>
        r.id === id
          ? {
              ...r,
              heldAt: combineDateTime(input.date, input.time),
              advice: input.advice || null,
              notes: input.notes || null,
            }
          : r,
      ),
    });
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('lesson_records').delete().eq('id', id);
    if (error) return;
    set({ records: get().records.filter((r) => r.id !== id) });
  },
}));
```

- [ ] **Step 4: テストを実行してパスすることを確認する**

```bash
npx jest store/__tests__/lesson-record.test.ts -v
```

Expected: PASS (全件)

- [ ] **Step 5: コミットする**

```bash
git add store/lesson-record.ts store/__tests__/lesson-record.test.ts
git commit -m "feat: store/lesson-record.ts — Zustand ストアを追加"
```

---

### Task 4: components/lesson-record-form.tsx — フォーム UI

**Files:**

- Create: `components/lesson-record-form.tsx`
- Create: `__tests__/integration/lesson-record-form.integration.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`__tests__/integration/lesson-record-form.integration.test.tsx`:

```tsx
import { fireEvent, waitFor } from '@testing-library/react-native';

import { LessonRecordForm } from '@/components/lesson-record-form';
import { renderWithProviders, screen } from '@/test-utils/render';

describe('LessonRecordForm (integration)', () => {
  it('日付が空のまま保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(
      <LessonRecordForm
        onSubmit={onSubmit}
        defaultValues={{ date: '', time: '14:00', advice: '', notes: '' }}
      />,
    );
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('日付を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('時刻が空のまま保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(
      <LessonRecordForm
        onSubmit={onSubmit}
        defaultValues={{ date: '2026-05-15', time: '', advice: '', notes: '' }}
      />,
    );
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('時刻を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('日付・時刻を入力して保存すると onSubmit が呼ばれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(
      <LessonRecordForm
        onSubmit={onSubmit}
        defaultValues={{ date: '2026-05-15', time: '14:00', advice: '', notes: '' }}
      />,
    );
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ date: '2026-05-15', time: '14:00' });
  });

  it('アドバイスと気づきを入力して保存すると onSubmit に値が渡される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(
      <LessonRecordForm
        onSubmit={onSubmit}
        defaultValues={{ date: '2026-05-15', time: '14:00', advice: '', notes: '' }}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('アドバイス'), 'タンギングを軽く');
    fireEvent.changeText(screen.getByLabelText('気づいたこと'), '息のスピードが足りない');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      advice: 'タンギングを軽く',
      notes: '息のスピードが足りない',
    });
  });

  it('defaultValues が渡されるとフォームに初期値が表示される', () => {
    renderWithProviders(
      <LessonRecordForm
        defaultValues={{
          date: '2026-05-15',
          time: '14:00',
          advice: 'アドバイスあり',
          notes: 'メモあり',
        }}
      />,
    );
    expect(screen.getByLabelText('日付').props.value).toBe('2026-05-15');
    expect(screen.getByLabelText('時刻').props.value).toBe('14:00');
    expect(screen.getByLabelText('アドバイス').props.value).toBe('アドバイスあり');
    expect(screen.getByLabelText('気づいたこと').props.value).toBe('メモあり');
  });

  it('onDelete が渡されると削除ボタンが表示されタップで呼ばれる', () => {
    const onDelete = jest.fn();
    renderWithProviders(<LessonRecordForm onDelete={onDelete} />);
    expect(screen.getByText('このレッスン記録を削除')).toBeTruthy();
    fireEvent.press(screen.getByText('このレッスン記録を削除'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('onDelete が渡されないと削除ボタンが表示されない', () => {
    renderWithProviders(<LessonRecordForm />);
    expect(screen.queryByText('このレッスン記録を削除')).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

```bash
npx jest __tests__/integration/lesson-record-form.integration.test.tsx -v
```

Expected: FAIL (モジュールが存在しない)

- [ ] **Step 3: 実装する**

`components/lesson-record-form.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { Button, Input, Paragraph, TextArea, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import {
  currentTime,
  formatDate,
  formatTime,
  type LessonRecordInput,
  lessonRecordSchema,
  today,
} from '@/forms/lesson-record';

const defaultOnSubmit = (_values: LessonRecordInput) => {
  Alert.alert('保存しました');
};

type Props = {
  defaultValues?: LessonRecordInput;
  onSubmit?: (values: LessonRecordInput) => void | Promise<void>;
  onDelete?: () => void;
};

export function LessonRecordForm({ defaultValues, onSubmit = defaultOnSubmit, onDelete }: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LessonRecordInput>({
    resolver: zodResolver(lessonRecordSchema),
    mode: 'onTouched',
    defaultValues: defaultValues ?? {
      date: today(),
      time: currentTime(),
      advice: '',
      notes: '',
    },
  });

  return (
    <YStack gap="$4" p="$4">
      <Controller
        control={control}
        name="date"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">日付 *</Paragraph>
            <Input
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="YYYY-MM-DD"
              aria-label="日付"
            />
            {Platform.OS !== 'web' && (
              <Button size="$2" onPress={() => setShowDatePicker(true)}>
                カレンダーで選択
              </Button>
            )}
            {showDatePicker && Platform.OS !== 'web' && (
              <DateTimePicker
                mode="date"
                value={new Date()}
                onChange={(_, d) => {
                  setShowDatePicker(false);
                  if (d) onChange(formatDate(d));
                }}
              />
            )}
            <FieldError message={errors.date?.message} />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="time"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">時刻 *</Paragraph>
            <Input
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="HH:MM"
              aria-label="時刻"
            />
            {Platform.OS !== 'web' && (
              <Button size="$2" onPress={() => setShowTimePicker(true)}>
                時刻を選択
              </Button>
            )}
            {showTimePicker && Platform.OS !== 'web' && (
              <DateTimePicker
                mode="time"
                value={new Date()}
                onChange={(_, d) => {
                  setShowTimePicker(false);
                  if (d) onChange(formatTime(d));
                }}
              />
            )}
            <FieldError message={errors.time?.message} />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="advice"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">アドバイス</Paragraph>
            <TextArea
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="先生からのアドバイスを入力"
              aria-label="アドバイス"
              numberOfLines={4}
            />
          </YStack>
        )}
      />

      <Controller
        control={control}
        name="notes"
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph color="$color12">気づいたこと</Paragraph>
            <TextArea
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="気づいたことを入力"
              aria-label="気づいたこと"
              numberOfLines={4}
            />
          </YStack>
        )}
      />

      <Button theme="blue" onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
        保存
      </Button>

      {onDelete && (
        <Button theme="red" variant="outlined" onPress={onDelete} mt="$4">
          このレッスン記録を削除
        </Button>
      )}
    </YStack>
  );
}
```

- [ ] **Step 4: テストを実行してパスすることを確認する**

```bash
npx jest __tests__/integration/lesson-record-form.integration.test.tsx -v
```

Expected: PASS (全件)

- [ ] **Step 5: コミットする**

```bash
git add components/lesson-record-form.tsx __tests__/integration/lesson-record-form.integration.test.tsx
git commit -m "feat: LessonRecordForm コンポーネントを追加"
```

---

### Task 5: app/(tabs)/lesson.tsx — レッスン一覧画面

**Files:**

- Create: `app/(tabs)/lesson.tsx`
- Create: `__tests__/integration/lesson-screen.integration.test.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`__tests__/integration/lesson-screen.integration.test.tsx`:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent } from '@testing-library/react-native';

import LessonScreen from '@/app/(tabs)/lesson';
import { useLessonRecordStore } from '@/store/lesson-record';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
  useFocusEffect: () => {},
}));

describe('LessonScreen (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: 'タンギングを軽く',
          notes: null,
        },
      ],
      loading: false,
    });
    jest.clearAllMocks();
  });

  it('記録がある場合にアドバイスのテキストがカードに表示される', () => {
    renderWithProviders(<LessonScreen />);
    expect(screen.getByText('タンギングを軽く')).toBeTruthy();
  });

  it('空状態では「記録がまだありません」が表示される', () => {
    useLessonRecordStore.setState({ records: [], loading: false });
    renderWithProviders(<LessonScreen />);
    expect(screen.getByText('記録がまだありません')).toBeTruthy();
  });

  it('カードをタップすると編集フォームへ遷移する', () => {
    renderWithProviders(<LessonScreen />);
    fireEvent.press(screen.getByLabelText(/のレッスン記録を編集/));
    const { router } = jest.requireMock('expo-router');
    expect(router.push).toHaveBeenCalledWith('/lesson-record-form?id=lr-1');
  });

  it('「＋ 追加」を押すと新規フォームへ遷移する', () => {
    renderWithProviders(<LessonScreen />);
    fireEvent.press(screen.getByText('＋ 追加'));
    const { router } = jest.requireMock('expo-router');
    expect(router.push).toHaveBeenCalledWith('/lesson-record-form');
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

```bash
npx jest __tests__/integration/lesson-screen.integration.test.tsx -v
```

Expected: FAIL (モジュールが存在しない)

- [ ] **Step 3: app/(tabs)/lesson.tsx を実装する**

```tsx
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { formatHeldAt } from '@/forms/lesson-record';
import { useLessonRecordStore } from '@/store/lesson-record';

export default function LessonScreen() {
  const records = useLessonRecordStore((s) => s.records);
  const loading = useLessonRecordStore((s) => s.loading);
  const fetchAll = useLessonRecordStore((s) => s.fetchAll);
  const remove = useLessonRecordStore((s) => s.remove);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const handleLongPress = (id: string) => {
    Alert.alert('レッスン記録を削除', 'この記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'レッスン' }} />
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <XStack justify="space-between" items="center" p="$3">
            <Paragraph fontSize="$2" color="$color10">
              {`${records.length}件`}
            </Paragraph>
            <Pressable onPress={() => router.push('/lesson-record-form')}>
              <Paragraph color="$blue9" fontSize="$2">
                ＋ 追加
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
          <Pressable
            onPress={() => router.push(`/lesson-record-form?id=${item.id}`)}
            onLongPress={() => handleLongPress(item.id)}
            accessibilityLabel={`${formatHeldAt(item.heldAt)}のレッスン記録を編集`}
          >
            <YStack
              mx="$3"
              mb="$2"
              p="$3"
              bg="$color1"
              rounded="$3"
              borderWidth={1}
              borderColor="$borderColor"
            >
              <Paragraph fontWeight="bold">{formatHeldAt(item.heldAt)}</Paragraph>
              {item.advice ? (
                <Paragraph fontSize="$2" color="$color11" numberOfLines={2} mt="$1">
                  {item.advice}
                </Paragraph>
              ) : null}
              {item.notes ? (
                <Paragraph fontSize="$2" color="$color10" numberOfLines={2} mt="$1">
                  {item.notes}
                </Paragraph>
              ) : null}
            </YStack>
          </Pressable>
        )}
      />
    </>
  );
}
```

- [ ] **Step 4: app/(tabs)/\_layout.tsx に「レッスン」タブを追加する**

現在の `_layout.tsx` の `index` の Tabs.Screen の直後に追加する:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: '練習記録',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="musical-notes-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="lesson"
        options={{
          title: 'レッスン',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="school-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="equipment"
        options={{
          title: '楽器情報',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="musical-note-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="purchase-plan"
        options={{
          title: '購入計画',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 5: テストを実行してパスすることを確認する**

```bash
npx jest __tests__/integration/lesson-screen.integration.test.tsx -v
```

Expected: PASS (全件)

- [ ] **Step 6: コミットする**

```bash
git add app/(tabs)/lesson.tsx app/(tabs)/_layout.tsx __tests__/integration/lesson-screen.integration.test.tsx
git commit -m "feat: レッスン一覧画面とタブを追加"
```

---

### Task 6: app/lesson-record-form.tsx — 追加・編集ルート画面

**Files:**

- Create: `app/lesson-record-form.tsx`

このルートはストアと `LessonRecordForm` を接続するだけで、独自ロジックは持たない。テストは Task 4 の結合テストで既にカバー済みなので、ここでは品質チェック通過を確認するだけでよい。

- [ ] **Step 1: 実装する**

`app/lesson-record-form.tsx`:

```tsx
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView } from 'react-native';

import { LessonRecordForm } from '@/components/lesson-record-form';
import { splitHeldAt, type LessonRecordInput } from '@/forms/lesson-record';
import { useLessonRecordStore } from '@/store/lesson-record';

export default function LessonRecordFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const records = useLessonRecordStore((s) => s.records);
  const add = useLessonRecordStore((s) => s.add);
  const update = useLessonRecordStore((s) => s.update);
  const remove = useLessonRecordStore((s) => s.remove);

  const existing = id ? records.find((r) => r.id === id) : undefined;

  let defaultValues: LessonRecordInput | undefined;
  if (existing) {
    const { date, time } = splitHeldAt(existing.heldAt);
    defaultValues = {
      date,
      time,
      advice: existing.advice ?? '',
      notes: existing.notes ?? '',
    };
  }

  const handleSave = async (values: LessonRecordInput) => {
    if (id) {
      await update(id, values);
    } else {
      await add(values);
    }
    router.back();
  };

  const handleDelete = () => {
    if (!id || !existing) return;
    Alert.alert('レッスン記録を削除', 'この記録を削除しますか？', [
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
          title: id ? 'レッスン記録を編集' : 'レッスン記録を追加',
        }}
      />
      <ScrollView>
        <LessonRecordForm
          defaultValues={defaultValues}
          onSubmit={handleSave}
          onDelete={id ? handleDelete : undefined}
        />
      </ScrollView>
    </>
  );
}
```

- [ ] **Step 2: 品質チェック 4 ステップをすべて通す**

```bash
npm run lint
npm run format:check
npx tsc --noEmit
npm test
```

差分があれば `npm run lint:fix` / `npm run format` で修正して再実行する。全件 PASS を確認すること。

- [ ] **Step 3: コミットする**

```bash
git add app/lesson-record-form.tsx
git commit -m "feat: レッスン記録の追加・編集ルート画面を追加"
```

---

## 完成後の確認

全タスク完了後:

1. `npm test` で全テストがパスすること
2. `npm start` でアプリを起動し、タブバーに「レッスン」が表示されること
3. ＋ 追加 → フォーム入力 → 保存 → 一覧に表示されること
4. カードタップ → 編集フォームに値が復元されること
5. 編集フォームの削除ボタン → Alert → 削除されること
6. カード長押し → Alert → 削除されること
