# レッスン記録教本追加・消耗品管理・使用リード番号・録音バグ修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 録音バグ修正 + レッスン記録への教本追加 + 設定画面からの消耗品管理 + 練習記録への使用リード番号追加の4点を実装する。

**Architecture:** Bug fix は `lib/recording.ts` の1行順序変更。DB は2つのマイグレーション（`lesson_record_textbooks` 新規テーブル・`practice_sessions.reed_number` カラム追加）。各機能は schema → store → component の順で TDD で積み上げる。

**Tech Stack:** Expo Router v6, Zustand v5, React Hook Form + zod, Tamagui, Supabase (PostgreSQL + RLS), expo-av, expo-file-system/legacy

---

## ファイル一覧

| 操作 | ファイル                                                                   |
| ---- | -------------------------------------------------------------------------- |
| 変更 | `lib/recording.ts`                                                         |
| 変更 | `lib/__tests__/recording.test.ts`                                          |
| 新規 | `supabase/migrations/20260521000001_add_lesson_record_textbooks.sql`       |
| 新規 | `supabase/migrations/20260521000002_add_practice_sessions_reed_number.sql` |
| 変更 | `forms/lesson-record.ts`                                                   |
| 変更 | `forms/__tests__/lesson-record.test.ts`                                    |
| 変更 | `store/lesson-record.ts`                                                   |
| 変更 | `store/__tests__/lesson-record.test.ts`                                    |
| 変更 | `components/lesson-record-form.tsx`                                        |
| 変更 | `__tests__/integration/lesson-record-form.integration.test.tsx`            |
| 変更 | `app/lesson-record-form.tsx`                                               |
| 新規 | `components/accessories-form.tsx`                                          |
| 新規 | `app/accessories.tsx`                                                      |
| 変更 | `app/(tabs)/settings.tsx`                                                  |
| 変更 | `forms/practice-log.ts`                                                    |
| 変更 | `forms/__tests__/practice-log.test.ts`                                     |
| 変更 | `store/practice-log.ts`                                                    |
| 変更 | `store/__tests__/practice-log.test.ts`                                     |
| 変更 | `components/practice-log-form.tsx`                                         |
| 変更 | `__tests__/integration/practice-log-form.integration.test.tsx`             |

---

## Task 1: 録音バグ修正 — `lib/recording.ts`

**Files:**

- Modify: `lib/recording.ts:24-30`
- Modify: `lib/__tests__/recording.test.ts:77-103`

### 問題

`stopRecording` が `stopAndUnloadAsync()` を呼んだ後に `getURI()` を呼んでいる。expo-av は unload 後に URI を返さない可能性があり、`null` になると `finalizeRecording` が実行されない。

- [ ] **Step 1: テストに getURI が unload 前に呼ばれることを検証するケースを追加する**

`lib/__tests__/recording.test.ts` の `describe('stopRecording')` ブロック内に以下を追加（既存テストはそのまま保持）:

```ts
it('getURI は stopAndUnloadAsync より前に呼ばれる', async () => {
  const callOrder: string[] = [];
  const mockRecording = {
    stopAndUnloadAsync: jest.fn().mockImplementation(async () => {
      callOrder.push('stopAndUnloadAsync');
    }),
    getURI: jest.fn().mockImplementation(() => {
      callOrder.push('getURI');
      return 'file:///tmp/some.caf';
    }),
  };

  await stopRecording(mockRecording as never);

  expect(callOrder.indexOf('getURI')).toBeLessThan(callOrder.indexOf('stopAndUnloadAsync'));
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest recording.test.ts -t 'getURI は stopAndUnloadAsync より前' --no-coverage
```

Expected: FAIL（現在の実装では `getURI` が `stopAndUnloadAsync` 後に呼ばれるため）

- [ ] **Step 3: `lib/recording.ts` の `stopRecording` を修正する**

`lib/recording.ts` の `stopRecording` 関数を以下に書き換える:

```ts
export async function stopRecording(recording: Audio.Recording): Promise<string> {
  const uri = recording.getURI();
  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  if (!uri) throw new Error('録音ファイルURIが取得できませんでした');
  await FileSystem.moveAsync({ from: uri, to: TMP_PATH });
  return TMP_PATH;
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest recording.test.ts --no-coverage
```

Expected: PASS (全テスト)

- [ ] **Step 5: コミット**

```bash
git add lib/recording.ts lib/__tests__/recording.test.ts
git commit -m "fix: stopRecording で getURI を stopAndUnloadAsync より前に呼ぶよう修正"
```

---

## Task 2: DB マイグレーション

**Files:**

- Create: `supabase/migrations/20260521000001_add_lesson_record_textbooks.sql`
- Create: `supabase/migrations/20260521000002_add_practice_sessions_reed_number.sql`

- [ ] **Step 1: lesson_record_textbooks マイグレーションファイルを作成する**

`supabase/migrations/20260521000001_add_lesson_record_textbooks.sql`:

```sql
create table lesson_record_textbooks (
  lesson_record_id  uuid    not null references lesson_records(id) on delete cascade,
  textbook_id       uuid    not null references textbooks(id) on delete cascade,
  current_page      integer not null,
  duration_minutes  integer,
  tempo_bpm         integer,
  primary key (lesson_record_id, textbook_id)
);

alter table lesson_record_textbooks enable row level security;

create policy "ユーザーは自分のレッスン記録の教本を参照できる"
  on lesson_record_textbooks for select
  using (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_record_textbooks.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );

create policy "ユーザーは自分のレッスン記録に教本を追加できる"
  on lesson_record_textbooks for insert
  with check (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_record_textbooks.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );

create policy "ユーザーは自分のレッスン記録の教本を削除できる"
  on lesson_record_textbooks for delete
  using (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_record_textbooks.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: practice_sessions reed_number マイグレーションファイルを作成する**

`supabase/migrations/20260521000002_add_practice_sessions_reed_number.sql`:

```sql
alter table practice_sessions add column reed_number text;
```

- [ ] **Step 3: マイグレーションを Supabase に適用する**

Supabase MCP ツール `mcp__supabase__apply_migration` を使い、それぞれのファイル内容を適用する。

ローカル CLI でも可:

```bash
supabase db push
```

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260521000001_add_lesson_record_textbooks.sql
git add supabase/migrations/20260521000002_add_practice_sessions_reed_number.sql
git commit -m "feat: lesson_record_textbooks テーブルと practice_sessions.reed_number カラムを追加"
```

---

## Task 3: `forms/lesson-record.ts` — textbookEntries スキーマ追加

**Files:**

- Modify: `forms/lesson-record.ts`
- Modify: `forms/__tests__/lesson-record.test.ts`

- [ ] **Step 1: 新しいスキーマに対するテストを追加する**

`forms/__tests__/lesson-record.test.ts` に以下のブロックを追記する（既存テストはすべて保持）:

```ts
describe('textbookEntrySchema', () => {
  it('textbookId と currentPage があれば有効', () => {
    const r = lessonRecordSchema.safeParse({
      date: '2026-05-15',
      time: '14:00',
      textbookEntries: [{ textbookId: '00000000-0000-0000-0000-000000000001', currentPage: 10 }],
    });
    expect(r.success).toBe(true);
  });

  it('textbookId が UUID でなければ拒否する', () => {
    const r = lessonRecordSchema.safeParse({
      date: '2026-05-15',
      time: '14:00',
      textbookEntries: [{ textbookId: 'not-a-uuid', currentPage: 10 }],
    });
    expect(r.success).toBe(false);
  });

  it('currentPage が 0 は有効', () => {
    const r = lessonRecordSchema.safeParse({
      date: '2026-05-15',
      time: '14:00',
      textbookEntries: [{ textbookId: '00000000-0000-0000-0000-000000000001', currentPage: 0 }],
    });
    expect(r.success).toBe(true);
  });

  it('currentPage が負数のとき拒否する', () => {
    const r = lessonRecordSchema.safeParse({
      date: '2026-05-15',
      time: '14:00',
      textbookEntries: [{ textbookId: '00000000-0000-0000-0000-000000000001', currentPage: -1 }],
    });
    expect(r.success).toBe(false);
  });

  it('durationMinutes は省略可能', () => {
    const r = lessonRecordSchema.safeParse({
      date: '2026-05-15',
      time: '14:00',
      textbookEntries: [{ textbookId: '00000000-0000-0000-0000-000000000001', currentPage: 5 }],
    });
    expect(r.success).toBe(true);
  });

  it('durationMinutes が 0 のとき拒否する', () => {
    const r = lessonRecordSchema.safeParse({
      date: '2026-05-15',
      time: '14:00',
      textbookEntries: [
        { textbookId: '00000000-0000-0000-0000-000000000001', currentPage: 5, durationMinutes: 0 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('tempoBpm が 40–240 の範囲内なら有効', () => {
    const r = lessonRecordSchema.safeParse({
      date: '2026-05-15',
      time: '14:00',
      textbookEntries: [
        {
          textbookId: '00000000-0000-0000-0000-000000000001',
          currentPage: 5,
          tempoBpm: 120,
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('tempoBpm が 39 のとき拒否する', () => {
    const r = lessonRecordSchema.safeParse({
      date: '2026-05-15',
      time: '14:00',
      textbookEntries: [
        { textbookId: '00000000-0000-0000-0000-000000000001', currentPage: 5, tempoBpm: 39 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('textbookEntries を省略すると空配列がデフォルトになる', () => {
    const r = lessonRecordSchema.safeParse({ date: '2026-05-15', time: '14:00' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.textbookEntries).toEqual([]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest forms/__tests__/lesson-record.test.ts --no-coverage
```

Expected: FAIL（`textbookEntries` 関連テストがエラー）

- [ ] **Step 3: `forms/lesson-record.ts` を更新する**

`forms/lesson-record.ts` の `import { z } from 'zod';` の直後に `textbookEntrySchema` を追加し、`lessonRecordSchema` を更新する。また `textbookEntrySchema` を export する（コンポーネントで import するため）:

```ts
import { z } from 'zod';

export const textbookEntrySchema = z.object({
  textbookId: z.string().uuid('教本を選択してください'),
  currentPage: z.number().int().min(0, '0以上の整数を入力してください'),
  durationMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tempoBpm: z
    .number()
    .int()
    .min(40, '40以上の整数を入力してください')
    .max(240, '240以下の整数を入力してください')
    .optional(),
});

export type TextbookEntryInput = z.infer<typeof textbookEntrySchema>;

export const lessonRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください'),
  time: z.string().regex(/^\d{2}:\d{2}$/, '時刻を入力してください'),
  advice: z.string().optional(),
  notes: z.string().optional(),
  textbookEntries: z.array(textbookEntrySchema).default([]),
});

export type LessonRecordInput = z.infer<typeof lessonRecordSchema>;
```

残りの関数（`today`, `currentTime`, `formatDate`, `formatTime`, `combineDateTime`, `splitHeldAt`, `formatHeldAt`）はそのまま保持する。

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest forms/__tests__/lesson-record.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add forms/lesson-record.ts forms/__tests__/lesson-record.test.ts
git commit -m "feat: forms/lesson-record に textbookEntries スキーマを追加"
```

---

## Task 4: `store/lesson-record.ts` — textbook entries 対応

**Files:**

- Modify: `store/lesson-record.ts`
- Modify: `store/__tests__/lesson-record.test.ts`

- [ ] **Step 1: 更新後の store に対するテストを書く**

`store/__tests__/lesson-record.test.ts` を以下の内容に**丸ごと置き換える**:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useLessonRecordStore } from '@/store/lesson-record';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('@/lib/recording', () => ({
  finalizeRecording: jest.fn().mockResolvedValue(undefined),
  deleteRecording: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/store/textbook-catalog', () => ({
  useTextbookCatalogStore: {
    getState: jest.fn().mockReturnValue({ textbooks: [] }),
  },
}));

jest.mock('@/store/textbook-progress', () => ({
  useTextbookProgressStore: {
    getState: jest.fn().mockReturnValue({ upsert: jest.fn().mockResolvedValue(undefined) }),
  },
}));

const mockFrom = () => jest.requireMock('@/lib/supabase').supabase.from as jest.Mock;
const mockGetUser = () => jest.requireMock('@/lib/supabase').supabase.auth.getUser as jest.Mock;
const mockRecording = () => jest.requireMock('@/lib/recording');
const mockCatalog = () => jest.requireMock('@/store/textbook-catalog').useTextbookCatalogStore;
const mockProgress = () => jest.requireMock('@/store/textbook-progress').useTextbookProgressStore;

describe('useLessonRecordStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLessonRecordStore.setState({ records: [], loading: false });
    jest.clearAllMocks();
    mockGetUser().mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockCatalog().getState.mockReturnValue({ textbooks: [] });
    mockProgress().getState.mockReturnValue({ upsert: jest.fn().mockResolvedValue(undefined) });
  });

  it('初期状態: records は空配列', () => {
    expect(useLessonRecordStore.getState().records).toEqual([]);
  });

  it('fetchAll で records がセットされる（textbookEntries を含む）', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'lr-1',
              held_at: '2026-05-15T05:00:00.000Z',
              advice: 'タンギングを軽く',
              notes: null,
              lesson_record_textbooks: [
                {
                  textbook_id: 'tb-1',
                  current_page: 12,
                  duration_minutes: 20,
                  tempo_bpm: 100,
                  textbooks: { title: 'ローズ 32のエチュード' },
                },
              ],
            },
          ],
          error: null,
        }),
      }),
    });
    await useLessonRecordStore.getState().fetchAll();
    const { records } = useLessonRecordStore.getState();
    expect(records).toHaveLength(1);
    expect(records[0].advice).toBe('タンギングを軽く');
    expect(records[0].textbookEntries).toHaveLength(1);
    expect(records[0].textbookEntries[0]).toMatchObject({
      textbookId: 'tb-1',
      textbookTitle: 'ローズ 32のエチュード',
      currentPage: 12,
      durationMinutes: 20,
      tempoBpm: 100,
    });
  });

  it('fetchAll で textbookEntries がない場合は空配列', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'lr-1',
              held_at: '2026-05-15T05:00:00.000Z',
              advice: null,
              notes: null,
              lesson_record_textbooks: [],
            },
          ],
          error: null,
        }),
      }),
    });
    await useLessonRecordStore.getState().fetchAll();
    expect(useLessonRecordStore.getState().records[0].textbookEntries).toEqual([]);
  });

  it('fetchAll がエラーを返しても既存の records が維持される', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: null,
          notes: null,
          textbookEntries: [],
        },
      ],
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
              held_at: '2026-05-15T14:00:00+09:00',
              advice: 'アドバイス',
              notes: null,
            },
            error: null,
          }),
        }),
      }),
    });
    await useLessonRecordStore.getState().add({
      date: '2026-05-15',
      time: '14:00',
      advice: 'アドバイス',
      notes: '',
      textbookEntries: [],
    });
    const { records } = useLessonRecordStore.getState();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('lr-new');
    expect(records[0].advice).toBe('アドバイス');
    expect(records[0].textbookEntries).toEqual([]);
  });

  it('add: textbookEntries あり → lesson_record_textbooks に INSERT される', async () => {
    mockCatalog().getState.mockReturnValue({
      textbooks: [{ id: 'tb-1', title: 'ローズ 32のエチュード' }],
    });
    // 1st from(): lesson_records insert
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'lr-new', held_at: '2026-05-15T14:00:00+09:00', advice: null, notes: null },
            error: null,
          }),
        }),
      }),
    });
    // 2nd from(): lesson_record_textbooks insert
    const mockTextbookInsert = jest.fn().mockResolvedValue({ error: null });
    mockFrom().mockReturnValueOnce({ insert: mockTextbookInsert });

    await useLessonRecordStore.getState().add({
      date: '2026-05-15',
      time: '14:00',
      advice: '',
      notes: '',
      textbookEntries: [
        { textbookId: 'tb-1', currentPage: 10, durationMinutes: 15, tempoBpm: 100 },
      ],
    });

    expect(mockTextbookInsert).toHaveBeenCalledWith([
      {
        lesson_record_id: 'lr-new',
        textbook_id: 'tb-1',
        current_page: 10,
        duration_minutes: 15,
        tempo_bpm: 100,
      },
    ]);
    const { records } = useLessonRecordStore.getState();
    expect(records[0].textbookEntries[0]).toMatchObject({
      textbookId: 'tb-1',
      textbookTitle: 'ローズ 32のエチュード',
      currentPage: 10,
    });
  });

  it('add: textbookEntries あり → useTextbookProgressStore.upsert が呼ばれる', async () => {
    const mockUpsert = jest.fn().mockResolvedValue(undefined);
    mockProgress().getState.mockReturnValue({ upsert: mockUpsert });
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'lr-new', held_at: '2026-05-15T14:00:00+09:00', advice: null, notes: null },
            error: null,
          }),
        }),
      }),
    });
    mockFrom().mockReturnValueOnce({ insert: jest.fn().mockResolvedValue({ error: null }) });

    await useLessonRecordStore.getState().add({
      date: '2026-05-15',
      time: '14:00',
      advice: '',
      notes: '',
      textbookEntries: [{ textbookId: 'tb-1', currentPage: 10 }],
    });

    expect(mockUpsert).toHaveBeenCalledWith('tb-1', 10);
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
      .add({ date: '2026-05-15', time: '14:00', advice: '', notes: '', textbookEntries: [] });
    expect(useLessonRecordStore.getState().records).toHaveLength(0);
  });

  it('update で対象 record の内容が更新される', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: '古いアドバイス',
          notes: null,
          textbookEntries: [],
        },
      ],
    });
    // 1st from(): lesson_records update
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    // 2nd from(): lesson_record_textbooks delete
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore.getState().update('lr-1', {
      date: '2026-05-20',
      time: '10:00',
      advice: '新しいアドバイス',
      notes: 'メモ',
      textbookEntries: [],
    });
    const { records } = useLessonRecordStore.getState();
    expect(records[0].advice).toBe('新しいアドバイス');
    expect(records[0].notes).toBe('メモ');
  });

  it('update: textbookEntries あり → delete 後に INSERT される', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: null,
          notes: null,
          textbookEntries: [],
        },
      ],
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    const mockTextbookInsert = jest.fn().mockResolvedValue({ error: null });
    mockFrom().mockReturnValueOnce({ insert: mockTextbookInsert });

    await useLessonRecordStore.getState().update('lr-1', {
      date: '2026-05-20',
      time: '10:00',
      advice: '',
      notes: '',
      textbookEntries: [{ textbookId: 'tb-2', currentPage: 5 }],
    });

    expect(mockTextbookInsert).toHaveBeenCalledWith([
      {
        lesson_record_id: 'lr-1',
        textbook_id: 'tb-2',
        current_page: 5,
        duration_minutes: null,
        tempo_bpm: null,
      },
    ]);
  });

  it('update がエラーを返すと records は変わらない', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: '元',
          notes: null,
          textbookEntries: [],
        },
      ],
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
      textbookEntries: [],
    });
    expect(useLessonRecordStore.getState().records[0].advice).toBe('元');
  });

  it('remove で対象 record が削除される', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: null,
          notes: null,
          textbookEntries: [],
        },
        {
          id: 'lr-2',
          heldAt: '2026-04-20T06:00:00.000Z',
          advice: null,
          notes: null,
          textbookEntries: [],
        },
      ],
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore.getState().remove('lr-1');
    expect(useLessonRecordStore.getState().records).toHaveLength(1);
    expect(useLessonRecordStore.getState().records[0].id).toBe('lr-2');
  });

  it('add: tempRecordingUri あり → finalizeRecording がレコードIDで呼ばれる', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'lr-new', held_at: '2026-05-15T14:00:00+09:00', advice: null, notes: null },
            error: null,
          }),
        }),
      }),
    });
    await useLessonRecordStore
      .getState()
      .add(
        { date: '2026-05-15', time: '14:00', advice: '', notes: '', textbookEntries: [] },
        'file:///data/recordings/tmp.m4a',
      );
    expect(mockRecording().finalizeRecording).toHaveBeenCalledWith('lr-new');
  });

  it('add: finalizeRecording が失敗しても record は保存される', async () => {
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'lr-new', held_at: '2026-05-15T14:00:00+09:00', advice: null, notes: null },
            error: null,
          }),
        }),
      }),
    });
    mockRecording().finalizeRecording.mockRejectedValueOnce(new Error('disk full'));
    await useLessonRecordStore
      .getState()
      .add(
        { date: '2026-05-15', time: '14:00', advice: '', notes: '', textbookEntries: [] },
        'file:///data/recordings/tmp.m4a',
      );
    expect(useLessonRecordStore.getState().records).toHaveLength(1);
  });

  it('remove: deleteRecording がレコードIDで呼ばれる', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-05-15T05:00:00.000Z',
          advice: null,
          notes: null,
          textbookEntries: [],
        },
      ],
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useLessonRecordStore.getState().remove('lr-1');
    expect(mockRecording().deleteRecording).toHaveBeenCalledWith('lr-1');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest store/__tests__/lesson-record.test.ts --no-coverage
```

Expected: FAIL（型エラーおよび `textbookEntries` 非対応のため）

- [ ] **Step 3: `store/lesson-record.ts` を更新する**

`store/lesson-record.ts` を以下に丸ごと置き換える:

```ts
import { create } from 'zustand';

import { combineDateTime, type LessonRecordInput } from '@/forms/lesson-record';
import { deleteRecording, finalizeRecording } from '@/lib/recording';
import { supabase } from '@/lib/supabase';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTextbookProgressStore } from '@/store/textbook-progress';

type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  durationMinutes: number | null;
  tempoBpm: number | null;
};

export type LessonRecord = {
  id: string;
  heldAt: string;
  advice: string | null;
  notes: string | null;
  textbookEntries: TextbookEntry[];
};

type LessonRecordTextbookRow = {
  textbook_id: string;
  current_page: number;
  duration_minutes: number | null;
  tempo_bpm: number | null;
  textbooks: { title: string } | null;
};

type LessonRecordRow = {
  id: string;
  held_at: string;
  advice: string | null;
  notes: string | null;
  lesson_record_textbooks: LessonRecordTextbookRow[];
};

type LessonRecordState = {
  records: LessonRecord[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: LessonRecordInput, tempRecordingUri?: string | null) => Promise<void>;
  update: (id: string, input: LessonRecordInput, tempRecordingUri?: string | null) => Promise<void>;
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
      .select(
        'id, held_at, advice, notes, ' +
          'lesson_record_textbooks ( textbook_id, current_page, duration_minutes, tempo_bpm, textbooks ( title ) )',
      )
      .order('held_at', { ascending: false });
    set({ loading: false });

    if (error || !data) return;

    const rows = data as unknown as LessonRecordRow[];
    set({
      records: rows.map((row) => ({
        id: row.id,
        heldAt: row.held_at,
        advice: row.advice,
        notes: row.notes,
        textbookEntries: (row.lesson_record_textbooks ?? []).map((entry) => ({
          textbookId: entry.textbook_id,
          textbookTitle: entry.textbooks?.title ?? '',
          currentPage: entry.current_page,
          durationMinutes: entry.duration_minutes ?? null,
          tempoBpm: entry.tempo_bpm ?? null,
        })),
      })),
    });
  },

  add: async (input: LessonRecordInput, tempRecordingUri?: string | null) => {
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

    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;

    if (input.textbookEntries.length > 0) {
      const { error: entriesError } = await supabase.from('lesson_record_textbooks').insert(
        input.textbookEntries.map((entry) => ({
          lesson_record_id: row.id,
          textbook_id: entry.textbookId,
          current_page: entry.currentPage,
          duration_minutes: entry.durationMinutes ?? null,
          tempo_bpm: entry.tempoBpm ?? null,
        })),
      );
      if (entriesError) {
        await supabase.from('lesson_records').delete().eq('id', row.id);
        return;
      }
      for (const entry of input.textbookEntries) {
        await useTextbookProgressStore.getState().upsert(entry.textbookId, entry.currentPage);
      }
    }

    if (tempRecordingUri) {
      try {
        await finalizeRecording(row.id);
      } catch {
        // 録音失敗でも記録は保存
      }
    }
    set({
      records: [
        {
          id: row.id,
          heldAt: row.held_at,
          advice: row.advice,
          notes: row.notes,
          textbookEntries: input.textbookEntries.map((entry) => {
            const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
            return {
              textbookId: entry.textbookId,
              textbookTitle: tb?.title ?? '',
              currentPage: entry.currentPage,
              durationMinutes: entry.durationMinutes ?? null,
              tempoBpm: entry.tempoBpm ?? null,
            };
          }),
        },
        ...get().records,
      ],
    });
  },

  update: async (id: string, input: LessonRecordInput, tempRecordingUri?: string | null) => {
    const { error } = await supabase
      .from('lesson_records')
      .update({
        held_at: combineDateTime(input.date, input.time),
        advice: input.advice || null,
        notes: input.notes || null,
      })
      .eq('id', id);
    if (error) return;

    await supabase.from('lesson_record_textbooks').delete().eq('lesson_record_id', id);

    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;

    if (input.textbookEntries.length > 0) {
      await supabase.from('lesson_record_textbooks').insert(
        input.textbookEntries.map((entry) => ({
          lesson_record_id: id,
          textbook_id: entry.textbookId,
          current_page: entry.currentPage,
          duration_minutes: entry.durationMinutes ?? null,
          tempo_bpm: entry.tempoBpm ?? null,
        })),
      );
      for (const entry of input.textbookEntries) {
        await useTextbookProgressStore.getState().upsert(entry.textbookId, entry.currentPage);
      }
    }

    if (tempRecordingUri) {
      try {
        await finalizeRecording(id);
      } catch {
        // 録音失敗でも記録は保存
      }
    }
    set({
      records: get().records.map((r) =>
        r.id === id
          ? {
              ...r,
              heldAt: combineDateTime(input.date, input.time),
              advice: input.advice || null,
              notes: input.notes || null,
              textbookEntries: input.textbookEntries.map((entry) => {
                const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
                return {
                  textbookId: entry.textbookId,
                  textbookTitle: tb?.title ?? '',
                  currentPage: entry.currentPage,
                  durationMinutes: entry.durationMinutes ?? null,
                  tempoBpm: entry.tempoBpm ?? null,
                };
              }),
            }
          : r,
      ),
    });
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('lesson_records').delete().eq('id', id);
    if (error) return;
    await deleteRecording(id);
    set({ records: get().records.filter((r) => r.id !== id) });
  },
}));
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest store/__tests__/lesson-record.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add store/lesson-record.ts store/__tests__/lesson-record.test.ts
git commit -m "feat: store/lesson-record に textbook entries 対応を追加"
```

---

## Task 5: `components/lesson-record-form.tsx` — 教本エントリセクション追加

**Files:**

- Modify: `components/lesson-record-form.tsx`
- Modify: `__tests__/integration/lesson-record-form.integration.test.tsx`

- [ ] **Step 1: 既存の統合テストを更新し、新しい教本追加テストを追加する**

`__tests__/integration/lesson-record-form.integration.test.tsx` を以下に丸ごと置き換える:

```tsx
import { fireEvent, waitFor } from '@testing-library/react-native';

import { LessonRecordForm } from '@/components/lesson-record-form';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('@/lib/recording', () => ({
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  createSound: jest.fn(),
}));

jest.mock('@/store/textbook-catalog', () => ({
  useTextbookCatalogStore: jest.fn((selector) =>
    selector({
      textbooks: [
        { id: 'tb-1', title: 'ローズ 32のエチュード', genre: 'エチュード', totalPages: 32 },
      ],
    }),
  ),
}));

const defaultValues = {
  date: '2026-05-15',
  time: '14:00',
  advice: '',
  notes: '',
  textbookEntries: [],
};

describe('LessonRecordForm (integration)', () => {
  it('日付が空のまま保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(
      <LessonRecordForm onSubmit={onSubmit} defaultValues={{ ...defaultValues, date: '' }} />,
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
      <LessonRecordForm onSubmit={onSubmit} defaultValues={{ ...defaultValues, time: '' }} />,
    );
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(screen.getByText('時刻を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('日付・時刻を入力して保存すると onSubmit が呼ばれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<LessonRecordForm onSubmit={onSubmit} defaultValues={defaultValues} />);
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      date: '2026-05-15',
      time: '14:00',
      textbookEntries: [],
    });
    expect(onSubmit.mock.calls[0][1]).toBeNull();
    expect(onSubmit.mock.calls[0][2]).toBe(false);
  });

  it('アドバイスと気づきを入力して保存すると onSubmit に値が渡される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<LessonRecordForm onSubmit={onSubmit} defaultValues={defaultValues} />);
    fireEvent.changeText(screen.getByLabelText('アドバイス'), 'タンギングを軽く');
    fireEvent.changeText(screen.getByLabelText('気づいたこと'), '息が足りない');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      advice: 'タンギングを軽く',
      notes: '息が足りない',
    });
  });

  it('教本を追加ボタンを押すとエントリが1件増える', async () => {
    renderWithProviders(<LessonRecordForm onSubmit={jest.fn()} defaultValues={defaultValues} />);
    fireEvent.press(screen.getByLabelText('教本を追加'));
    await waitFor(() => {
      expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest lesson-record-form.integration.test.tsx --no-coverage
```

Expected: FAIL（`defaultValues` 型エラーおよびコンポーネント未対応）

- [ ] **Step 3: `components/lesson-record-form.tsx` を更新する**

`components/lesson-record-form.tsx` を以下に丸ごと置き換える:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
  useFieldArray,
  useForm,
  watch as rhfWatch,
} from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { Button, Input, Paragraph, Select, TextArea, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { RecordingSection } from '@/components/form/recording-section';
import {
  currentTime,
  formatDate,
  formatTime,
  type LessonRecordInput,
  lessonRecordSchema,
  today,
} from '@/forms/lesson-record';
import { type Textbook, useTextbookCatalogStore } from '@/store/textbook-catalog';

type TextbookEntryRowProps = {
  index: number;
  control: Control<LessonRecordInput>;
  errors: FieldErrors<LessonRecordInput>;
  textbooks: Textbook[];
  watchedEntries: LessonRecordInput['textbookEntries'];
  onRemove: () => void;
};

function TextbookEntryRow({
  index,
  control,
  errors,
  textbooks,
  watchedEntries,
  onRemove,
}: TextbookEntryRowProps) {
  const otherSelectedIds = new Set(
    watchedEntries
      .filter((_, i) => i !== index)
      .map((e) => e.textbookId)
      .filter(Boolean),
  );

  return (
    <YStack gap="$2" p="$3" bg="$color2" rounded="$3">
      <XStack gap="$2" items="center">
        <Controller
          control={control}
          name={`textbookEntries.${index}.textbookId`}
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack flex={1} gap="$1">
              <Select value={value} onValueChange={onChange}>
                <Select.Trigger flex={1} onBlur={onBlur} aria-label={`教本を選択 ${index + 1}`}>
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
            )}
          />
        </XStack>
        <FieldError message={errors.textbookEntries?.[index]?.currentPage?.message} />
      </YStack>

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

      <Controller
        control={control}
        name={`textbookEntries.${index}.tempoBpm`}
        render={({ field: { onChange, onBlur, value } }) => (
          <YStack gap="$1">
            <Paragraph fontSize="$2" color="$color10">
              テンポ BPM（任意）
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
              aria-label={`テンポ ${index + 1}`}
            />
          </YStack>
        )}
      />
      <FieldError message={errors.textbookEntries?.[index]?.tempoBpm?.message} />
    </YStack>
  );
}

const defaultOnSubmit = (
  _values: LessonRecordInput,
  _tempUri: string | null,
  _shouldDelete: boolean,
) => {
  Alert.alert('保存しました');
};

type Props = {
  defaultValues?: LessonRecordInput;
  existingRecordingUri?: string | null;
  onSubmit?: (
    values: LessonRecordInput,
    tempUri: string | null,
    shouldDeleteExisting: boolean,
  ) => void | Promise<void>;
  onDelete?: () => void;
};

export function LessonRecordForm({
  defaultValues,
  existingRecordingUri,
  onSubmit = defaultOnSubmit,
  onDelete,
}: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [recState, setRecState] = useState({
    tempUri: null as string | null,
    reRecordTriggered: false,
  });

  const textbooks = useTextbookCatalogStore((s) => s.textbooks);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LessonRecordInput>({
    resolver: zodResolver(lessonRecordSchema),
    mode: 'onTouched',
    defaultValues: defaultValues ?? {
      date: today(),
      time: currentTime(),
      advice: '',
      notes: '',
      textbookEntries: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'textbookEntries' });
  const watchedEntries = watch('textbookEntries') ?? [];

  async function handleSave(values: LessonRecordInput) {
    const shouldDelete = recState.reRecordTriggered && recState.tempUri === null;
    await onSubmit(values, recState.tempUri, shouldDelete);
  }

  return (
    <YStack gap="$4" p="$4">
      <RecordingSection
        existingRecordingUri={existingRecordingUri}
        onChange={(s) => setRecState(s)}
      />
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

      {/* 教本の進捗 */}
      <YStack gap="$2">
        <Paragraph color="$color12">教本の進捗</Paragraph>
        {fields.map((field, index) => (
          <TextbookEntryRow
            key={field.id}
            index={index}
            control={control}
            errors={errors}
            textbooks={textbooks}
            watchedEntries={watchedEntries}
            onRemove={() => remove(index)}
          />
        ))}
        <Button onPress={() => append({ textbookId: '', currentPage: 0 })} aria-label="教本を追加">
          ＋ 教本を追加
        </Button>
      </YStack>

      <Button theme="blue" onPress={handleSubmit(handleSave)} disabled={isSubmitting}>
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

注: `watch as rhfWatch` の import は削除し `watch` のみ残す（`useForm` から返される `watch` を使う）。

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest lesson-record-form.integration.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add components/lesson-record-form.tsx __tests__/integration/lesson-record-form.integration.test.tsx
git commit -m "feat: components/lesson-record-form に教本エントリセクションを追加"
```

---

## Task 6: `app/lesson-record-form.tsx` — useFocusEffect 追加・defaultValues 更新

**Files:**

- Modify: `app/lesson-record-form.tsx`

この Task はロジック変更のみで新規テスト不要（screen レベルの統合テストは存在しない）。

- [ ] **Step 1: `app/lesson-record-form.tsx` を更新する**

`app/lesson-record-form.tsx` を以下に丸ごと置き換える:

```tsx
import * as FileSystem from 'expo-file-system/legacy';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { LessonRecordForm } from '@/components/lesson-record-form';
import { type LessonRecordInput, splitHeldAt } from '@/forms/lesson-record';
import { deleteRecording, getRecordingUri } from '@/lib/recording';
import { useLessonRecordStore } from '@/store/lesson-record';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

export default function LessonRecordFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const records = useLessonRecordStore((s) => s.records);
  const add = useLessonRecordStore((s) => s.add);
  const update = useLessonRecordStore((s) => s.update);
  const remove = useLessonRecordStore((s) => s.remove);

  const existing = id ? records.find((r) => r.id === id) : undefined;

  const [existingRecordingUri, setExistingRecordingUri] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      useTextbookCatalogStore.getState().fetchAll();
      useLessonRecordStore.getState().fetchAll();
    }, []),
  );

  useEffect(() => {
    if (!id) return;
    const uri = getRecordingUri(id);
    FileSystem.getInfoAsync(uri).then((info) => {
      if (info.exists) setExistingRecordingUri(uri);
    });
  }, [id]);

  let defaultValues: LessonRecordInput | undefined;
  if (existing) {
    const { date, time } = splitHeldAt(existing.heldAt);
    defaultValues = {
      date,
      time,
      advice: existing.advice ?? '',
      notes: existing.notes ?? '',
      textbookEntries: existing.textbookEntries.map((e) => ({
        textbookId: e.textbookId,
        currentPage: e.currentPage,
        durationMinutes: e.durationMinutes ?? undefined,
        tempoBpm: e.tempoBpm ?? undefined,
      })),
    };
  }

  const handleSave = async (
    values: LessonRecordInput,
    tempUri: string | null,
    shouldDeleteExisting: boolean,
  ) => {
    if (id) {
      await update(id, values, tempUri);
      if (shouldDeleteExisting) await deleteRecording(id);
    } else {
      await add(values, tempUri);
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
          existingRecordingUri={existingRecordingUri}
          onSubmit={handleSave}
          onDelete={id ? handleDelete : undefined}
        />
      </ScrollView>
    </>
  );
}
```

- [ ] **Step 2: TypeScript チェックが通ることを確認する**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: エラーなし（または既存エラーのみ）

- [ ] **Step 3: コミット**

```bash
git add app/lesson-record-form.tsx
git commit -m "feat: app/lesson-record-form に useFocusEffect とテキストブックエントリの defaultValues を追加"
```

---

## Task 7: 消耗品管理 — `components/accessories-form.tsx` + `app/accessories.tsx` + `settings.tsx`

**Files:**

- Create: `components/accessories-form.tsx`
- Create: `app/accessories.tsx`
- Modify: `app/(tabs)/settings.tsx`

新規コンポーネントのため統合テストを1件書いてから実装する。

- [ ] **Step 1: accessories-form の統合テストを書く**

`__tests__/integration/accessories-form.integration.test.tsx` を新規作成:

```tsx
import { fireEvent, waitFor } from '@testing-library/react-native';

import { AccessoriesForm } from '@/components/accessories-form';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('@/store/equipment', () => ({
  useEquipmentStore: jest.fn((selector) =>
    selector({
      equipment: {
        instrument: {
          makerId: 'maker-1',
          makerName: 'Buffet Crampon',
          modelId: 'model-1',
          modelName: 'R13',
          startDate: '2024-01-01',
        },
        reed: { name: 'Vandoren V12', startDate: '2025-01-01' },
        ligature: { name: 'Vandoren M/O', startDate: '2025-01-01' },
        mouthpiece: { name: 'Vandoren B45', startDate: '2025-01-01' },
      },
      loaded: true,
      loading: false,
      fetchEquipment: jest.fn(),
      saveEquipment: jest.fn().mockResolvedValue({ ok: true }),
    }),
  ),
}));

describe('AccessoriesForm (integration)', () => {
  it('リード名が表示される', async () => {
    renderWithProviders(<AccessoriesForm />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Vandoren V12')).toBeTruthy();
    });
  });

  it('リード名を変更して保存すると saveEquipment が呼ばれる', async () => {
    const { useEquipmentStore } = jest.requireMock('@/store/equipment');
    const mockSave = jest.fn().mockResolvedValue({ ok: true });
    useEquipmentStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({
        equipment: {
          instrument: {
            makerId: 'maker-1',
            makerName: 'Buffet Crampon',
            modelId: 'model-1',
            modelName: 'R13',
            startDate: '2024-01-01',
          },
          reed: { name: 'Vandoren V12', startDate: '2025-01-01' },
          ligature: { name: 'Vandoren M/O', startDate: '2025-01-01' },
          mouthpiece: { name: 'Vandoren B45', startDate: '2025-01-01' },
        },
        loaded: true,
        loading: false,
        fetchEquipment: jest.fn(),
        saveEquipment: mockSave,
      }),
    );
    renderWithProviders(<AccessoriesForm />);
    const reedInput = screen.getByLabelText('リード名');
    fireEvent.changeText(reedInput, 'Rico Royal');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
    const callArg = mockSave.mock.calls[0][0];
    expect(callArg.reed.name).toBe('Rico Royal');
    expect(callArg.instrument.makerId).toBe('maker-1');
  });

  it('equipment が null のとき案内メッセージが表示される', async () => {
    const { useEquipmentStore } = jest.requireMock('@/store/equipment');
    useEquipmentStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({
        equipment: null,
        loaded: true,
        loading: false,
        fetchEquipment: jest.fn(),
        saveEquipment: jest.fn(),
      }),
    );
    renderWithProviders(<AccessoriesForm />);
    await waitFor(() => {
      expect(screen.getByText(/楽器情報が未登録/)).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest accessories-form.integration.test.tsx --no-coverage
```

Expected: FAIL（コンポーネント未存在）

- [ ] **Step 3: `components/accessories-form.tsx` を作成する**

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { z } from 'zod';
import { Button, Input, Paragraph, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import {
  calcUsagePeriod,
  equipmentItemSchema,
  formatDate,
  parseYmd,
  type ClarinetEquipment,
} from '@/forms/equipment';
import { useEquipmentStore } from '@/store/equipment';

const accessoriesSchema = z.object({
  reed: equipmentItemSchema,
  ligature: equipmentItemSchema,
  mouthpiece: equipmentItemSchema,
});

type AccessoriesInput = z.infer<typeof accessoriesSchema>;

type Section = 'reed' | 'ligature' | 'mouthpiece';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'reed', label: 'リード' },
  { key: 'ligature', label: 'リガチャー' },
  { key: 'mouthpiece', label: 'マウスピース' },
];

const emptyItem = { name: '', startDate: '' };

export function AccessoriesForm() {
  const fetchEquipment = useEquipmentStore((s) => s.fetchEquipment);
  const saveEquipment = useEquipmentStore((s) => s.saveEquipment);
  const equipment = useEquipmentStore((s) => s.equipment);
  const loaded = useEquipmentStore((s) => s.loaded);
  const [showPicker, setShowPicker] = useState<Section | null>(null);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccessoriesInput>({
    resolver: zodResolver(accessoriesSchema),
    mode: 'onTouched',
    defaultValues: {
      reed: equipment?.reed ?? emptyItem,
      ligature: equipment?.ligature ?? emptyItem,
      mouthpiece: equipment?.mouthpiece ?? emptyItem,
    },
  });

  const hasResetRef = useRef(equipment != null);
  useEffect(() => {
    if (equipment && !hasResetRef.current) {
      reset({
        reed: equipment.reed,
        ligature: equipment.ligature,
        mouthpiece: equipment.mouthpiece,
      });
      hasResetRef.current = true;
    }
  }, [equipment, reset]);

  const reedStartDate = watch('reed.startDate');
  const ligatureStartDate = watch('ligature.startDate');
  const mouthpieceStartDate = watch('mouthpiece.startDate');
  const startDates: Record<Section, string> = {
    reed: reedStartDate,
    ligature: ligatureStartDate,
    mouthpiece: mouthpieceStartDate,
  };

  if (!loaded) {
    return (
      <YStack flex={1} items="center" justify="center" p="$4">
        <Paragraph>読み込み中...</Paragraph>
      </YStack>
    );
  }

  if (!equipment) {
    return (
      <YStack flex={1} p="$4" gap="$3">
        <Paragraph>楽器情報が未登録です。機材タブで楽器を先に登録してください。</Paragraph>
      </YStack>
    );
  }

  const handleSave = async (values: AccessoriesInput) => {
    const fullEquipment: ClarinetEquipment = {
      instrument: equipment.instrument,
      ...values,
    };
    const result = await saveEquipment(fullEquipment);
    if (result.ok) {
      Alert.alert('保存しました');
    } else {
      Alert.alert('保存に失敗しました');
    }
  };

  return (
    <YStack gap="$4" p="$4">
      {SECTIONS.map(({ key, label }) => (
        <YStack key={key} gap="$2">
          <Paragraph color="$color12" fontWeight="bold">
            {label}
          </Paragraph>

          <Controller
            control={control}
            name={`${key}.name`}
            render={({ field: { onChange, onBlur, value } }) => (
              <YStack gap="$1">
                <Paragraph fontSize="$3" color="$color11">
                  名前 *
                </Paragraph>
                <Input
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder={`例: Vandoren V12`}
                  aria-label={`${label}名`}
                />
                <FieldError message={errors[key]?.name?.message} />
              </YStack>
            )}
          />

          <Controller
            control={control}
            name={`${key}.startDate`}
            render={({ field: { onChange, onBlur, value } }) => (
              <YStack gap="$1">
                <Paragraph fontSize="$3" color="$color11">
                  使用開始日 *
                </Paragraph>
                <Input
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="YYYY-MM-DD"
                  aria-label={`${label}開始日`}
                />
                {Platform.OS !== 'web' && (
                  <Button size="$2" onPress={() => setShowPicker(key)}>
                    カレンダーで選択
                  </Button>
                )}
                {showPicker === key && Platform.OS !== 'web' && (
                  <DateTimePicker
                    mode="date"
                    value={parseYmd(value) ?? new Date()}
                    onChange={(_, d) => {
                      setShowPicker(null);
                      if (d) onChange(formatDate(d));
                    }}
                  />
                )}
                {startDates[key] && (
                  <Paragraph fontSize="$2" color="$color10">
                    使用期間: {calcUsagePeriod(startDates[key]) ?? '—'}
                  </Paragraph>
                )}
                <FieldError message={errors[key]?.startDate?.message} />
              </YStack>
            )}
          />
        </YStack>
      ))}

      <Button theme="blue" onPress={handleSubmit(handleSave)} disabled={isSubmitting}>
        保存
      </Button>
    </YStack>
  );
}
```

- [ ] **Step 4: `app/accessories.tsx` を作成する**

```tsx
import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { AccessoriesForm } from '@/components/accessories-form';

export default function AccessoriesScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '消耗品管理' }} />
      <ScrollView>
        <AccessoriesForm />
      </ScrollView>
    </>
  );
}
```

- [ ] **Step 5: `app/(tabs)/settings.tsx` に消耗品管理リンクを追加する**

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
          rounded="$4"
          borderWidth={1}
          borderColor="$borderColor"
        >
          <Paragraph>📚 教本管理</Paragraph>
          <Paragraph color="$color10">›</Paragraph>
        </XStack>
      </Pressable>
      <Pressable onPress={() => router.push('/accessories')}>
        <XStack
          items="center"
          justify="space-between"
          p="$4"
          bg="$color2"
          rounded="$4"
          borderWidth={1}
          borderColor="$borderColor"
        >
          <Paragraph>🎵 消耗品管理</Paragraph>
          <Paragraph color="$color10">›</Paragraph>
        </XStack>
      </Pressable>
    </YStack>
  );
}
```

- [ ] **Step 6: テストが通ることを確認する**

```bash
npx jest accessories-form.integration.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add components/accessories-form.tsx app/accessories.tsx app/(tabs)/settings.tsx __tests__/integration/accessories-form.integration.test.tsx
git commit -m "feat: 消耗品管理画面を追加し設定画面にリンクを追加"
```

---

## Task 8: `forms/practice-log.ts` — reedNumber フィールド追加

**Files:**

- Modify: `forms/practice-log.ts`
- Modify: `forms/__tests__/practice-log.test.ts`

- [ ] **Step 1: reedNumber バリデーションテストを追加する**

`forms/__tests__/practice-log.test.ts` を開き、`describe('practiceLogSchema')` ブロック内に以下のテストを追加する（既存テストはすべて保持）:

```ts
it('reedNumber が英数字のみなら有効', () => {
  const r = practiceLogSchema.safeParse({
    practicedAt: '2026-05-15',
    textbookEntries: [],
    reedNumber: 'A3b',
  });
  expect(r.success).toBe(true);
});

it('reedNumber が空文字なら有効（任意項目）', () => {
  const r = practiceLogSchema.safeParse({
    practicedAt: '2026-05-15',
    textbookEntries: [],
    reedNumber: '',
  });
  expect(r.success).toBe(true);
});

it('reedNumber が省略された場合も有効', () => {
  const r = practiceLogSchema.safeParse({
    practicedAt: '2026-05-15',
    textbookEntries: [],
  });
  expect(r.success).toBe(true);
});

it('reedNumber に記号が含まれる場合は拒否する', () => {
  const r = practiceLogSchema.safeParse({
    practicedAt: '2026-05-15',
    textbookEntries: [],
    reedNumber: 'A-3',
  });
  expect(r.success).toBe(false);
});

it('reedNumber に日本語が含まれる場合は拒否する', () => {
  const r = practiceLogSchema.safeParse({
    practicedAt: '2026-05-15',
    textbookEntries: [],
    reedNumber: '第3番',
  });
  expect(r.success).toBe(false);
});
```

`forms/__tests__/practice-log.test.ts` の先頭で `practiceLogSchema` を import していることを確認する（既存 import から追加されているはず）。

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest forms/__tests__/practice-log.test.ts -t 'reedNumber' --no-coverage
```

Expected: FAIL

- [ ] **Step 3: `forms/practice-log.ts` に reedNumber を追加する**

`practiceLogSchema` の `textbookEntries` の後に以下を追加する:

```ts
export const practiceLogSchema = z.object({
  practicedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください')
    .refine((s) => s <= today(), '未来の日付は入力できません'),
  longToneMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tonguingMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tonguingTempoBpms: z.array(tonguingBpmEntrySchema).optional(),
  otherMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  otherMemo: z.string().optional(),
  memo: z.string().optional(),
  textbookEntries: z.array(textbookEntrySchema),
  reedNumber: z
    .string()
    .regex(/^[a-zA-Z0-9]*$/, '英数字のみ入力できます')
    .optional(),
});
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest forms/__tests__/practice-log.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add forms/practice-log.ts forms/__tests__/practice-log.test.ts
git commit -m "feat: forms/practice-log に reedNumber フィールドを追加"
```

---

## Task 9: `store/practice-log.ts` — reedNumber 対応

**Files:**

- Modify: `store/practice-log.ts`
- Modify: `store/__tests__/practice-log.test.ts`

- [ ] **Step 1: reedNumber に関するテストを `store/__tests__/practice-log.test.ts` に追加する**

既存の `describe('usePracticeLogStore')` ブロック内に以下を追加する（既存テストはすべて保持）:

```ts
it('add: reedNumber が sessions に保存される', async () => {
  mockSupabase().auth.getUser.mockResolvedValueOnce({
    data: { user: { id: 'user-1' } },
  });
  // session insert
  mockSupabase().from.mockReturnValueOnce({
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'session-new' },
          error: null,
        }),
      }),
    }),
  });

  await usePracticeLogStore.getState().add({
    practicedAt: '2026-05-21',
    textbookEntries: [],
    reedNumber: 'A3',
  });

  expect(mockSupabase().from).toHaveBeenCalledWith('practice_sessions');
  const insertCall = mockSupabase().from.mock.results[0].value.insert;
  expect(insertCall).toHaveBeenCalledWith(expect.objectContaining({ reed_number: 'A3' }));
});

it('fetchAll: reed_number が reedNumber にマップされる', async () => {
  mockSupabase().auth.getUser.mockResolvedValueOnce({
    data: { user: { id: 'user-1' } },
  });
  mockSupabase().from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'session-1',
            practiced_at: '2026-05-21',
            duration_minutes: null,
            other_minutes: null,
            other_memo: null,
            total_minutes: null,
            memo: null,
            reed_number: 'B2',
            practice_session_textbooks: [],
            practice_session_basic_menus: [],
          },
        ],
        error: null,
      }),
    }),
  });

  await usePracticeLogStore.getState().fetchAll();
  expect(usePracticeLogStore.getState().sessions[0].reedNumber).toBe('B2');
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest store/__tests__/practice-log.test.ts -t 'reedNumber' --no-coverage
```

Expected: FAIL

- [ ] **Step 3: `store/practice-log.ts` を更新する**

以下の差分を適用する:

`PracticeSession` 型に `reedNumber: string | null` を追加:

```ts
export type PracticeSession = {
  id: string;
  practicedAt: string;
  durationMinutes: number | null;
  otherMinutes: number | null;
  otherMemo: string | null;
  totalMinutes: number | null;
  memo: string | null;
  reedNumber: string | null;
  textbookEntries: TextbookEntry[];
  basicMenuEntries: BasicMenuEntry[];
};
```

`SessionRow` 型に `reed_number: string | null` を追加:

```ts
type SessionRow = {
  id: string;
  practiced_at: string;
  duration_minutes: number | null;
  other_minutes: number | null;
  other_memo: string | null;
  total_minutes: number | null;
  memo: string | null;
  reed_number: string | null;
  practice_session_textbooks: { ... }[];
  practice_session_basic_menus: { ... }[];
};
```

`fetchAll` の select 文字列に `reed_number` を追加:

```ts
'id, practiced_at, duration_minutes, other_minutes, other_memo, total_minutes, memo, reed_number, ' +
  'practice_session_textbooks ( ... ), ' +
  'practice_session_basic_menus ( ... )',
```

`fetchAll` の sessions マップに `reedNumber` を追加:

```ts
sessions: rows.map((row) => ({
  id: row.id,
  practicedAt: row.practiced_at,
  durationMinutes: row.duration_minutes ?? null,
  otherMinutes: row.other_minutes ?? null,
  otherMemo: row.other_memo ?? null,
  totalMinutes: row.total_minutes ?? null,
  memo: row.memo ?? null,
  reedNumber: row.reed_number ?? null,
  textbookEntries: [...],
  basicMenuEntries: [...],
})),
```

`add` の insert オブジェクトに `reed_number` を追加:

```ts
await supabase.from('practice_sessions').insert({
  user_id: userData.user.id,
  practiced_at: input.practicedAt,
  duration_minutes: totalDuration > 0 ? totalDuration : null,
  other_minutes: input.otherMinutes ?? null,
  other_memo: input.otherMemo || null,
  total_minutes: totalMinutesValue,
  memo: input.memo || null,
  reed_number: input.reedNumber || null,
});
```

`add` の `newSession` オブジェクトに `reedNumber` を追加:

```ts
const newSession: PracticeSession = {
  id: sessionId,
  practicedAt: input.practicedAt,
  ...
  reedNumber: input.reedNumber || null,
  ...
};
```

`update` の update オブジェクトに `reed_number` を追加:

```ts
await supabase.from('practice_sessions').update({
  practiced_at: input.practicedAt,
  ...
  reed_number: input.reedNumber || null,
}).eq('id', id);
```

`update` の `updatedSession` オブジェクトに `reedNumber` を追加:

```ts
const updatedSession: PracticeSession = {
  id,
  ...
  reedNumber: input.reedNumber || null,
  ...
};
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest store/__tests__/practice-log.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add store/practice-log.ts store/__tests__/practice-log.test.ts
git commit -m "feat: store/practice-log に reedNumber を追加"
```

---

## Task 10: `components/practice-log-form.tsx` — reedNumber フィールド追加

**Files:**

- Modify: `components/practice-log-form.tsx`
- Modify: `__tests__/integration/practice-log-form.integration.test.tsx`

- [ ] **Step 1: reedNumber 入力フィールドに関する統合テストを追加する**

`__tests__/integration/practice-log-form.integration.test.tsx` の既存の `describe` ブロック内に以下を追加する（既存テストはすべて保持）:

```tsx
it('reedNumber に英数字を入力して保存すると onSubmit に値が渡される', async () => {
  const onSubmit = jest.fn();
  renderWithProviders(
    <PracticeLogForm
      ref={null}
      onSubmit={onSubmit}
      initialValues={{
        practicedAt: '2026-05-21',
        textbookEntries: [],
        reedNumber: '',
      }}
    />,
  );
  fireEvent.changeText(screen.getByLabelText('使用リード番号'), 'A3b');
  fireEvent.press(screen.getByLabelText('保存'));
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ reedNumber: 'A3b' });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest practice-log-form.integration.test.tsx -t 'reedNumber' --no-coverage
```

Expected: FAIL（aria-label '使用リード番号' の要素が見つからない）

- [ ] **Step 3: `components/practice-log-form.tsx` に reedNumber フィールドを追加する**

`PracticeLogForm` 内の保存ボタンの直前に以下を追加する（「その他」セクションの `otherMemo` Controller の後）:

```tsx
{
  /* 使用リード番号 */
}
<Controller
  control={control}
  name="reedNumber"
  render={({ field: { onChange, onBlur, value } }) => (
    <YStack gap="$1">
      <Paragraph color="$color12">使用リード番号 任意</Paragraph>
      <Input
        value={value ?? ''}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder="例: A3、2b など"
        keyboardType="ascii-capable"
        aria-label="使用リード番号"
      />
      <FieldError message={errors.reedNumber?.message} />
    </YStack>
  )}
/>;
```

また `useForm` の `defaultValues` に `reedNumber: ''` を追加する:

```ts
defaultValues: initialValues ?? {
  practicedAt: today(),
  longToneMinutes: undefined,
  tonguingMinutes: undefined,
  tonguingTempoBpms: [],
  otherMinutes: undefined,
  otherMemo: '',
  memo: '',
  textbookEntries: lastTextbookEntries,
  reedNumber: '',
},
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest practice-log-form.integration.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add components/practice-log-form.tsx __tests__/integration/practice-log-form.integration.test.tsx
git commit -m "feat: components/practice-log-form に使用リード番号フィールドを追加"
```

---

## Task 11: 品質チェック

- [ ] **Step 1: ESLint**

```bash
npm run lint
```

Expected: 0 errors. エラーがあれば `npm run lint:fix` で修正してから再実行。

- [ ] **Step 2: Prettier**

```bash
npm run format:check
```

Expected: 差分なし。差分があれば `npm run format` で修正。

- [ ] **Step 3: TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Jest（全テスト）**

```bash
npm test
```

Expected: 全テスト PASS。

- [ ] **Step 5: 修正があればコミット**

```bash
git add -p  # 修正したファイルのみ選択して add
git commit -m "fix: 品質チェック指摘を修正"
```
