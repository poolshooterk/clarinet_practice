# 練習記録の開始/終了時刻 + レッスン宿題の進捗管理 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 練習記録に独立セッションタイマーで自動算出する開始/終了時刻を追加し、レッスン記録に 3 段階進捗つき宿題を追加する。

**Architecture:** 2 つの独立ストリーム。(A) 練習時刻は既存タイマーストア `store/timer.ts` を `firstStartedAt` 拡張し、新 `SessionTimer` が開始/終了 HH:MM を練習フォームへ供給、`practice_sessions` に `start_time`/`end_time` (text) 列を足す。(B) 宿題は `monthly_milestones` を移植した子テーブル `lesson_homework` を作り、専用フォーム + `store/lesson-record.ts` の id 単位 CRUD で管理し (レッスン保存の delete-all-reinsert に巻き込まない)、lesson タブに直近レッスンの宿題カードを置く。

**Tech Stack:** Expo Router v6 / React Hook Form + zod + Tamagui / Zustand v5 / Supabase (Postgres + RLS) / Jest (jest-expo)。

参照 spec: `docs/superpowers/specs/2026-07-23-practice-time-lesson-homework-design.md`

品質チェック 4 ステップ (各ストリーム完了時): `npm run lint` / `npm run format:check` / `npx tsc --noEmit` / `npm test`。反復中の単体は `npx jest <pattern>` を直接ストリームさせる (パイプ禁止)。

---

## ストリーム A: 練習記録の開始/終了時刻

### Task A1: タイマーストアに `firstStartedAt` を追加

**Files:**

- Modify: `store/timer.ts`
- Test: `store/__tests__/timer.test.ts` (新規)

- [ ] **Step 1: 失敗するテストを書く**

`store/__tests__/timer.test.ts` を新規作成:

```ts
import { getElapsedMs, useTimerStore } from '@/store/timer';

describe('useTimerStore firstStartedAt', () => {
  beforeEach(() => {
    useTimerStore.setState({ timers: {} });
    jest.restoreAllMocks();
  });

  it('初回 start で firstStartedAt がセットされる', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    useTimerStore.getState().start('practice-session');
    expect(useTimerStore.getState().timers['practice-session'].firstStartedAt).toBe(1_000_000);
  });

  it('pause→再開(start)しても firstStartedAt は最初の値を保持する', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const store = useTimerStore.getState();
    store.start('practice-session');
    now.mockReturnValue(1_060_000); // +60s
    store.pause('practice-session');
    now.mockReturnValue(1_120_000); // 再開
    store.start('practice-session');
    expect(useTimerStore.getState().timers['practice-session'].firstStartedAt).toBe(1_000_000);
  });

  it('stop 後も firstStartedAt を保持し、end = firstStartedAt + elapsed が導ける', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const store = useTimerStore.getState();
    store.start('practice-session');
    now.mockReturnValue(1_180_000); // +180s
    store.stop('practice-session');
    const entry = useTimerStore.getState().timers['practice-session'];
    expect(entry.firstStartedAt).toBe(1_000_000);
    expect(entry.firstStartedAt! + getElapsedMs(entry)).toBe(1_180_000);
  });

  it('reset で firstStartedAt が null に戻る', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const store = useTimerStore.getState();
    store.start('practice-session');
    store.reset('practice-session');
    expect(useTimerStore.getState().timers['practice-session'].firstStartedAt).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx jest store/__tests__/timer.test.ts`
Expected: FAIL (`firstStartedAt` が undefined)

- [ ] **Step 3: 最小実装**

`store/timer.ts` を編集。`TimerEntry` 型に `firstStartedAt` を追加:

```ts
export type TimerEntry = {
  status: TimerStatus;
  accumulatedMs: number;
  startedAt: number | null;
  firstStartedAt: number | null;
};
```

`defaultEntry` を更新:

```ts
const defaultEntry: TimerEntry = {
  status: 'idle',
  accumulatedMs: 0,
  startedAt: null,
  firstStartedAt: null,
};
```

`start` アクションを更新 (初回のみ firstStartedAt をセット、再開では保持):

```ts
      start: (key) =>
        set((state) => {
          const prev = state.timers[key] ?? defaultEntry;
          return {
            timers: {
              ...state.timers,
              [key]: {
                ...prev,
                status: 'running',
                startedAt: Date.now(),
                firstStartedAt: prev.firstStartedAt ?? Date.now(),
              },
            },
          };
        }),
```

`pause` の再構築オブジェクトに `firstStartedAt` を保持:

```ts
return {
  timers: {
    ...state.timers,
    [key]: {
      status: 'paused',
      accumulatedMs: entry.accumulatedMs + elapsed,
      startedAt: null,
      firstStartedAt: entry.firstStartedAt,
    },
  },
};
```

`stop` の再構築オブジェクトに `firstStartedAt` を保持:

```ts
set((state) => ({
  timers: {
    ...state.timers,
    [key]: {
      status: 'stopped',
      accumulatedMs: totalMs,
      startedAt: null,
      firstStartedAt: (state.timers[key] ?? defaultEntry).firstStartedAt,
    },
  },
}));
```

`reset` は `defaultEntry` スプレッドのままで `firstStartedAt: null` になる (変更不要)。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx jest store/__tests__/timer.test.ts`
Expected: PASS

- [ ] **Step 5: 既存タイマーテストの回帰確認**

Run: `npx jest timer`
Expected: 既存の timer-control 系テストも PASS (firstStartedAt は加算のみで後方互換)

- [ ] **Step 6: コミット**

```bash
git add store/timer.ts store/__tests__/timer.test.ts
git commit -m "feat: タイマーに firstStartedAt を追加し最初の開始時刻を保持"
```

---

### Task A2: `practiceLogSchema` に開始/終了時刻と `formatClock` を追加

**Files:**

- Modify: `forms/practice-log.ts`
- Test: `forms/__tests__/practice-log.test.ts` (無ければ新規)

- [ ] **Step 1: 失敗するテストを書く**

`forms/__tests__/practice-log.test.ts` に以下の describe を追加 (ファイルが無ければ `import { practiceLogSchema, formatClock } from '@/forms/practice-log';` を先頭に置いて新規作成):

```ts
import { formatClock, practiceLogSchema } from '@/forms/practice-log';

describe('practiceLogSchema startTime/endTime', () => {
  const base = { practicedAt: '2020-01-01', textbookEntries: [] };

  it('HH:MM 形式の開始/終了を受け付ける', () => {
    const r = practiceLogSchema.safeParse({ ...base, startTime: '19:00', endTime: '19:50' });
    expect(r.success).toBe(true);
  });

  it('空文字は許容される (未入力)', () => {
    const r = practiceLogSchema.safeParse({ ...base, startTime: '', endTime: '' });
    expect(r.success).toBe(true);
  });

  it('片方だけの入力も許容される', () => {
    const r = practiceLogSchema.safeParse({ ...base, startTime: '19:00', endTime: '' });
    expect(r.success).toBe(true);
  });

  it('不正な形式は拒否される', () => {
    const r = practiceLogSchema.safeParse({ ...base, startTime: '9時' });
    expect(r.success).toBe(false);
  });
});

describe('formatClock', () => {
  it('epoch を HH:MM に整形する', () => {
    const d = new Date(2026, 0, 1, 19, 5, 0);
    expect(formatClock(d.getTime())).toBe('19:05');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx jest forms/__tests__/practice-log.test.ts`
Expected: FAIL (`formatClock` 未定義 / start/end フィールドがスキーマに無い)

- [ ] **Step 3: 最小実装**

`forms/practice-log.ts` を編集。`practiceLogSchema` の `reedNumber` の直後 (閉じ `})` の前) に 2 フィールドを追加:

```ts
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, '時刻は HH:MM 形式で入力してください')
    .or(z.literal(''))
    .nullable()
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, '時刻は HH:MM 形式で入力してください')
    .or(z.literal(''))
    .nullable()
    .optional(),
```

ファイル末尾 (`formatDate` の後) に `formatClock` を追加:

```ts
export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx jest forms/__tests__/practice-log.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add forms/practice-log.ts forms/__tests__/practice-log.test.ts
git commit -m "feat: 練習記録スキーマに開始/終了時刻と formatClock を追加"
```

---

### Task A3: DB マイグレーション (start_time / end_time 列)

**Files:**

- Create: `supabase/migrations/20260723000000_add_practice_sessions_start_end_time.sql`

- [ ] **Step 1: マイグレーションファイルを作成**

```sql
alter table practice_sessions add column start_time text;
alter table practice_sessions add column end_time text;
```

- [ ] **Step 2: 適用**

Claude Code から MCP ツール `mcp__supabase__apply_migration` で name=`add_practice_sessions_start_end_time`、上記 SQL を適用する。ローカル CLI 運用時は `supabase db push`。

- [ ] **Step 3: 列の存在確認**

MCP `mcp__supabase__list_tables` (schemas=["public"]) で `practice_sessions` に `start_time` / `end_time` があることを確認。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260723000000_add_practice_sessions_start_end_time.sql
git commit -m "feat: practice_sessions に start_time/end_time 列を追加"
```

---

### Task A4: `store/practice-log.ts` に開始/終了時刻を配線

**Files:**

- Modify: `store/practice-log.ts`
- Test: `store/__tests__/practice-log.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`store/__tests__/practice-log.test.ts` に以下を追加 (既存の add テストのモック様式に合わせる)。`add` 経路で start/end が insert され optimistic session に入り、total_minutes に影響しないことを確認:

```ts
describe('add 開始/終了時刻', () => {
  it('start_time/end_time を insert し、total は分数からのみ算出される', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    const insert = jest
      .fn()
      .mockReturnValue({
        select: jest
          .fn()
          .mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'new-1' }, error: null }),
          }),
      });
    mockSupabase().from.mockReturnValue({ insert });

    const result = await usePracticeLogStore.getState().add({
      practicedAt: '2020-01-01',
      longToneMinutes: 10,
      textbookEntries: [],
      startTime: '19:00',
      endTime: '19:50',
    } as any);

    expect(result).toEqual({ ok: true });
    // 最初の insert(=practice_sessions) 引数に start_time/end_time が入る
    const sessionInsertArg = insert.mock.calls[0][0];
    expect(sessionInsertArg.start_time).toBe('19:00');
    expect(sessionInsertArg.end_time).toBe('19:50');
    // total は longTone 10 分のみ (時刻は不参入)
    expect(sessionInsertArg.total_minutes).toBe(10);
    const session = usePracticeLogStore.getState().sessions[0];
    expect(session.startTime).toBe('19:00');
    expect(session.endTime).toBe('19:50');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx jest store/__tests__/practice-log.test.ts -t '開始/終了時刻'`
Expected: FAIL (`start_time` が insert 引数に無い / `session.startTime` undefined)

- [ ] **Step 3: 最小実装**

`store/practice-log.ts` を編集。

(1) `PracticeSession` 型 (37-49) に追加:

```ts
startTime: string | null;
endTime: string | null;
```

(2) `SessionRow` 型 (64-91) の `reed_number` の後に追加:

```ts
start_time: string | null;
end_time: string | null;
```

(3) `fetchAll` の select 文字列 (135) の先頭列リストに `start_time, end_time,` を追加:

```ts
        'id, practiced_at, duration_minutes, other_minutes, other_memo, total_minutes, memo, reed_number, start_time, end_time, ' +
```

(4) `fetchAll` の map (147-155 付近、`reedNumber` の後) に追加:

```ts
        startTime: row.start_time ?? null,
        endTime: row.end_time ?? null,
```

(5) `add` の insert オブジェクト (204-213、`reed_number` の後) に追加:

```ts
        start_time: input.startTime || null,
        end_time: input.endTime || null,
```

(6) `add` の `newSession` (308-336、`reedNumber` の後) に追加:

```ts
      startTime: input.startTime || null,
      endTime: input.endTime || null,
```

(7) `update` の update オブジェクト (367-375、`reed_number` の後) に追加:

```ts
        start_time: input.startTime || null,
        end_time: input.endTime || null,
```

(8) `update` の `updatedSession` (485-513、`reedNumber` の後) に追加:

```ts
      startTime: input.startTime || null,
      endTime: input.endTime || null,
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx jest store/__tests__/practice-log.test.ts`
Expected: PASS (既存テストも含めて緑)

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラー 0 (PracticeSession を構築する箇所が start/end 必須になったため、次タスクの UI 側でも埋める。この時点で store 内は全経路埋めたので通る)

- [ ] **Step 6: コミット**

```bash
git add store/practice-log.ts store/__tests__/practice-log.test.ts
git commit -m "feat: 練習記録ストアに開始/終了時刻を配線"
```

---

### Task A5: `SessionTimer` コンポーネント

**Files:**

- Create: `components/form/session-timer.tsx`
- Test: `components/form/__tests__/session-timer.test.tsx`

`TimerControl` (`components/timer-control.tsx`) の表示/interval/AppState 復帰を踏襲するが、`onStop(minutes)` ではなく開始/終了時刻 (HH:MM) を親へ返す。専用キー定数 `PRACTICE_SESSION_TIMER_KEY = 'practice-session'` をエクスポート。

- [ ] **Step 1: 失敗するテストを書く**

`components/form/__tests__/session-timer.test.tsx` を新規作成:

```tsx
import { fireEvent } from '@testing-library/react-native';

import { SessionTimer } from '@/components/form/session-timer';
import { renderWithProviders } from '@/test-utils/render';
import { useTimerStore } from '@/store/timer';

describe('SessionTimer', () => {
  beforeEach(() => {
    useTimerStore.setState({ timers: {} });
    jest.restoreAllMocks();
  });

  it('練習開始で開始時刻が onTimesChange に渡る', () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 0, 1, 19, 0, 0).getTime());
    const onTimesChange = jest.fn();
    const { getByLabelText } = renderWithProviders(<SessionTimer onTimesChange={onTimesChange} />);
    fireEvent.press(getByLabelText('練習の計測開始'));
    expect(onTimesChange).toHaveBeenCalledWith({ startTime: '19:00', endTime: null });
  });

  it('停止で終了時刻 = 開始 + 計測 が渡る', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 0, 1, 19, 0, 0).getTime());
    const onTimesChange = jest.fn();
    const { getByLabelText } = renderWithProviders(<SessionTimer onTimesChange={onTimesChange} />);
    fireEvent.press(getByLabelText('練習の計測開始'));
    now.mockReturnValue(new Date(2026, 0, 1, 19, 50, 0).getTime()); // +50分
    fireEvent.press(getByLabelText('練習の停止'));
    expect(onTimesChange).toHaveBeenLastCalledWith({ startTime: '19:00', endTime: '19:50' });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx jest components/form/__tests__/session-timer.test.tsx`
Expected: FAIL (モジュール未作成)

- [ ] **Step 3: 最小実装**

`components/form/session-timer.tsx` を新規作成:

```tsx
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Button, Paragraph, XStack } from 'tamagui';

import { formatClock } from '@/forms/practice-log';
import { getElapsedMs, useTimerStore } from '@/store/timer';

export const PRACTICE_SESSION_TIMER_KEY = 'practice-session';

type Props = {
  onTimesChange: (times: { startTime: string | null; endTime: string | null }) => void;
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function SessionTimer({ onTimesChange }: Props) {
  const timers = useTimerStore((s) => s.timers);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const stop = useTimerStore((s) => s.stop);
  const reset = useTimerStore((s) => s.reset);

  const key = PRACTICE_SESSION_TIMER_KEY;
  const entry = timers[key] ?? {
    status: 'idle' as const,
    accumulatedMs: 0,
    startedAt: null,
    firstStartedAt: null,
  };
  const [displayMs, setDisplayMs] = useState(() => getElapsedMs(entry));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startInterval() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const e = useTimerStore.getState().timers[key];
      if (e) setDisplayMs(getElapsedMs(e));
    }, 1000);
  }

  useEffect(() => {
    if (entry.status === 'running') {
      startInterval();
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplayMs(getElapsedMs(entry));
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.status]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const e = useTimerStore.getState().timers[key];
        if (e?.status === 'running') {
          setDisplayMs(getElapsedMs(e));
          startInterval();
        }
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reportTimes(finalize: boolean) {
    const e = useTimerStore.getState().timers[key];
    if (!e || e.firstStartedAt == null) {
      onTimesChange({ startTime: null, endTime: null });
      return;
    }
    onTimesChange({
      startTime: formatClock(e.firstStartedAt),
      endTime: finalize ? formatClock(e.firstStartedAt + getElapsedMs(e)) : null,
    });
  }

  function handleStart() {
    start(key);
    reportTimes(false);
  }
  function handlePause() {
    pause(key);
    reportTimes(true);
  }
  function handleStop() {
    stop(key);
    reportTimes(true);
  }
  function handleReset() {
    reset(key);
    onTimesChange({ startTime: null, endTime: null });
  }

  if (entry.status === 'idle') {
    return (
      <Button size="$2" onPress={handleStart} aria-label="練習の計測開始">
        練習開始
      </Button>
    );
  }

  if (entry.status === 'running' || entry.status === 'paused') {
    return (
      <XStack gap="$2" items="center">
        <Paragraph>{formatElapsed(displayMs)}</Paragraph>
        {entry.status === 'running' ? (
          <Button size="$2" onPress={handlePause} aria-label="練習の一時停止">
            一時停止
          </Button>
        ) : (
          <Button size="$2" onPress={handleStart} aria-label="練習の再開">
            再開
          </Button>
        )}
        <Button size="$2" onPress={handleStop} aria-label="練習の停止">
          停止
        </Button>
      </XStack>
    );
  }

  const stoppedMinutes = Math.max(1, Math.ceil(entry.accumulatedMs / 60000));
  return (
    <XStack gap="$2" items="center">
      <Paragraph fontSize="$2" color="$color10">
        {stoppedMinutes}分計測済
      </Paragraph>
      <Button size="$2" onPress={handleReset} aria-label="練習タイマーのリセット">
        リセット
      </Button>
    </XStack>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx jest components/form/__tests__/session-timer.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add components/form/session-timer.tsx components/form/__tests__/session-timer.test.tsx
git commit -m "feat: 開始/終了時刻を算出する SessionTimer を追加"
```

---

### Task A6: 練習フォームに SessionTimer と開始/終了 Input を組み込む

**Files:**

- Modify: `components/practice-log-form.tsx`
- Modify: `app/practice-log-form.tsx`

- [ ] **Step 1: フォーム部品を編集**

`components/practice-log-form.tsx`:

(1) import を追加。既存の `@/forms/practice-log` からの import 行に `formatClock` を**マージ**する (重複 import 行を作らない。import/no-duplicates 回避):

```tsx
import {
  BASIC_GENRES,
  BASIC_MENUS,
  formatClock,
  formatDate,
  type PracticeLogInput,
  practiceLogSchema,
  today,
} from '@/forms/practice-log';
```

さらに新規 import 行を 2 本追加:

```tsx
import { PRACTICE_SESSION_TIMER_KEY, SessionTimer } from '@/components/form/session-timer';
import { getElapsedMs } from '@/store/timer';
```

注: `useTimerStore` は既存 import 済み。`getElapsedMs` を同じ `@/store/timer` の import 行にマージしてもよい。

(2) `defaultValues` (264-274) に開始/終了の初期値を追加:

```tsx
      startTime: '',
      endTime: '',
```

(3) 日付 Controller の直後 (413 行 `/>` の後) に、SessionTimer と開始/終了 Input を追加:

```tsx
{
  /* 練習時間帯 (セッションタイマー) */
}
<YStack gap="$2">
  <Paragraph color="$color12">練習時間帯 任意</Paragraph>
  <SessionTimer
    onTimesChange={({ startTime, endTime }) => {
      setValue('startTime', startTime ?? '', { shouldDirty: true });
      if (endTime != null) setValue('endTime', endTime, { shouldDirty: true });
    }}
  />
  <XStack gap="$2" items="center">
    <Controller
      control={control}
      name="startTime"
      render={({ field: { onChange, onBlur, value } }) => (
        <YStack flex={1} gap="$1">
          <Paragraph fontSize="$2" color="$color10">
            開始
          </Paragraph>
          <Input
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="HH:MM"
            aria-label="練習開始時刻"
          />
          <FieldError message={errors.startTime?.message} />
        </YStack>
      )}
    />
    <Controller
      control={control}
      name="endTime"
      render={({ field: { onChange, onBlur, value } }) => (
        <YStack flex={1} gap="$1">
          <Paragraph fontSize="$2" color="$color10">
            終了
          </Paragraph>
          <Input
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder="HH:MM"
            aria-label="練習終了時刻"
          />
          <FieldError message={errors.endTime?.message} />
        </YStack>
      )}
    />
  </XStack>
</YStack>;
```

(4) `useImperativeHandle` の submit (336-357) で、送信時にセッションタイマーが稼働中なら終了時刻を確定してから submit する。`fields.forEach(...)` の後、`submitForm();` の前に追加:

```tsx
const sessionEntry = timerState.timers[PRACTICE_SESSION_TIMER_KEY];
if (sessionEntry?.firstStartedAt != null) {
  setValue('endTime', formatClock(sessionEntry.firstStartedAt + getElapsedMs(sessionEntry)));
}
```

補足: `submitForm` は完了後に `resetAll()` を呼ぶため、保存成功時にセッションタイマーも自動リセットされる (別途 reset 不要)。開始時刻の setValue により `isDirty` が立つので未保存ガードにも乗る (`timersActive` は running を既に検知)。

- [ ] **Step 2: ルート (編集モードのマッピング) を編集**

`app/practice-log-form.tsx` の `initialValues` useMemo (55-75) の `reedNumber` の後に追加:

```tsx
            startTime: editingSession.startTime ?? '',
            endTime: editingSession.endTime ?? '',
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 4: Lint**

Run: `npx eslint components/practice-log-form.tsx app/practice-log-form.tsx components/form/session-timer.tsx`
Expected: エラー 0

- [ ] **Step 5: コミット**

```bash
git add components/practice-log-form.tsx app/practice-log-form.tsx
git commit -m "feat: 練習フォームにセッションタイマーと開始/終了時刻入力を追加"
```

---

### Task A7: 一覧カードに時間帯を表示

**Files:**

- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: 実装**

`app/(tabs)/index.tsx` のカードヘッダ `XStack`(138-166) の直後 (基礎/基礎以外ラベルの前、167 行の前) に追加:

```tsx
{
  item.startTime || item.endTime ? (
    <Paragraph fontSize="$2" color="$color10" mb="$1">
      {`${item.startTime ?? ''}${item.endTime ? `–${item.endTime}` : ''}`}
    </Paragraph>
  ) : null;
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラー 0 (`item.startTime`/`endTime` は Task A4 で PracticeSession に定義済み)

- [ ] **Step 3: コミット**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat: 練習記録一覧に練習時間帯を表示"
```

---

### Task A8: 練習フォーム integration スモーク + ストリーム A 総合チェック

**Files:**

- Modify: `__tests__/integration/practice-log-form.integration.test.tsx`

- [ ] **Step 1: スモークテストを追加**

既存の integration テストに 1 ケース追加: 開始/終了時刻の手入力 Input に `fireEvent.changeText` して保存し、`add`/`update` が呼ばれる (もしくは Alert 副作用) ことを確認する。既存テストの render/submit ヘルパに合わせて記述:

```tsx
it('開始/終了時刻を手入力して保存できる', async () => {
  const { getByLabelText } = renderPracticeForm(); // 既存のセットアップに準拠
  fireEvent.changeText(getByLabelText('練習開始時刻'), '19:00');
  fireEvent.changeText(getByLabelText('練習終了時刻'), '19:50');
  // 既存の保存トリガ (ヘッダ保存 or 保存ボタン) を押下
  fireEvent.press(getByLabelText('保存'));
  // 既存テストと同じ待ち受けで add/update 呼び出しを検証
});
```

注: 既存テストのモック/ヘルパ名は実ファイルに合わせる。DateTimePicker 由来の native picker は検証対象外。

- [ ] **Step 2: スモークテスト実行**

Run: `npx jest __tests__/integration/practice-log-form.integration.test.tsx`
Expected: PASS

- [ ] **Step 3: ストリーム A 品質チェック 4 ステップ**

```bash
npm run lint
npm run format:check
npx tsc --noEmit
npx jest --runInBand
```

Expected: すべて緑。差分があれば `npm run lint:fix` / `npm run format` で修正して再実行。

- [ ] **Step 4: コミット**

```bash
git add __tests__/integration/practice-log-form.integration.test.tsx
git commit -m "test: 練習フォームの開始/終了時刻入力スモークを追加"
```

---

## ストリーム B: レッスン宿題 (進捗管理)

### Task B1: `forms/homework.ts` (スキーマ + ステータス定数)

**Files:**

- Create: `forms/homework.ts`
- Test: `forms/__tests__/homework.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`forms/__tests__/homework.test.ts`:

```ts
import { HOMEWORK_STATUS_LABELS, homeworkSchema } from '@/forms/homework';

describe('homeworkSchema', () => {
  it('内容のみで valid (status 必須)', () => {
    const r = homeworkSchema.safeParse({ content: 'ロングトーン強化', status: 'not_started' });
    expect(r.success).toBe(true);
  });

  it('内容が空だと invalid', () => {
    const r = homeworkSchema.safeParse({ content: '', status: 'not_started' });
    expect(r.success).toBe(false);
  });

  it('期限 YYYY-MM-DD / 空文字を許容', () => {
    expect(
      homeworkSchema.safeParse({ content: 'x', status: 'done', dueDate: '2026-08-15' }).success,
    ).toBe(true);
    expect(homeworkSchema.safeParse({ content: 'x', status: 'done', dueDate: '' }).success).toBe(
      true,
    );
  });

  it('不正な status は拒否', () => {
    const r = homeworkSchema.safeParse({ content: 'x', status: 'wip' });
    expect(r.success).toBe(false);
  });

  it('ラベルが日本語で定義される', () => {
    expect(HOMEWORK_STATUS_LABELS.in_progress).toBe('進行中');
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗**

Run: `npx jest forms/__tests__/homework.test.ts`
Expected: FAIL (モジュール未作成)

- [ ] **Step 3: 実装**

`forms/homework.ts`:

```ts
import { z } from 'zod';

export const HOMEWORK_STATUS_VALUES = ['not_started', 'in_progress', 'done'] as const;
export type HomeworkStatus = (typeof HOMEWORK_STATUS_VALUES)[number];

export const HOMEWORK_STATUS_LABELS: Record<HomeworkStatus, string> = {
  not_started: '未着手',
  in_progress: '進行中',
  done: '完了',
};

export const homeworkSchema = z.object({
  content: z.string().min(1, '入力してください'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください')
    .or(z.literal(''))
    .nullable()
    .optional(),
  textbookId: z.string().nullable().optional(),
  reviewNote: z.string().nullable().optional(),
  status: z.enum(HOMEWORK_STATUS_VALUES),
});

export type HomeworkInput = z.infer<typeof homeworkSchema>;
```

- [ ] **Step 4: テスト実行 → 成功**

Run: `npx jest forms/__tests__/homework.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add forms/homework.ts forms/__tests__/homework.test.ts
git commit -m "feat: 宿題スキーマとステータス定数を追加"
```

---

### Task B2: DB マイグレーション (lesson_homework)

**Files:**

- Create: `supabase/migrations/20260723000001_add_lesson_homework.sql`

- [ ] **Step 1: マイグレーション作成**

```sql
create table lesson_homework (
  id                uuid        primary key default gen_random_uuid(),
  lesson_record_id  uuid        not null references lesson_records(id) on delete cascade,
  content           text        not null,
  due_date          date,
  textbook_id       uuid        references textbooks(id) on delete set null,
  review_note       text,
  status            text        not null default 'not_started'
                      check (status in ('not_started', 'in_progress', 'done')),
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index lesson_homework_lesson_idx on lesson_homework (lesson_record_id);

alter table lesson_homework enable row level security;

create policy "ユーザーは自分のレッスンの宿題を参照できる"
  on lesson_homework for select
  using (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_homework.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );

create policy "ユーザーは自分のレッスンに宿題を追加できる"
  on lesson_homework for insert
  with check (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_homework.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );

create policy "ユーザーは自分のレッスンの宿題を更新できる"
  on lesson_homework for update
  using (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_homework.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_homework.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );

create policy "ユーザーは自分のレッスンの宿題を削除できる"
  on lesson_homework for delete
  using (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_homework.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: 適用**

MCP `mcp__supabase__apply_migration` (name=`add_lesson_homework`) で適用。

- [ ] **Step 3: 確認**

MCP `mcp__supabase__list_tables` で `lesson_homework` と 4 ポリシーの存在を確認。`mcp__supabase__get_advisors` (type=security) で RLS 警告が出ないことを確認。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260723000001_add_lesson_homework.sql
git commit -m "feat: lesson_homework テーブルと RLS を追加"
```

---

### Task B3: `store/lesson-record.ts` に宿題を配線

**Files:**

- Modify: `store/lesson-record.ts`
- Test: `store/__tests__/lesson-record.test.ts` (無ければ新規)

- [ ] **Step 1: 失敗するテストを書く**

`store/__tests__/lesson-record.test.ts` に宿題アクションのテストを追加 (既存の lesson-record テストのモック様式に合わせる。無ければ practice-log.test.ts のモック様式を流用):

```ts
import { useLessonRecordStore } from '@/store/lesson-record';

// supabase / textbook-catalog / recording は既存テストと同じ jest.mock を用意する

describe('宿題アクション', () => {
  beforeEach(() => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-07-20T10:00:00+09:00',
          advice: null,
          notes: null,
          textbookEntries: [],
          recordings: [],
          homework: [],
        },
      ],
      loading: false,
    });
    jest.clearAllMocks();
  });

  it('addHomework で nested 配列に追加される', async () => {
    mockSupabase().from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'hw-1',
              content: 'ロングトーン',
              due_date: null,
              textbook_id: null,
              review_note: null,
              status: 'not_started',
              completed_at: null,
              textbooks: null,
            },
            error: null,
          }),
        }),
      }),
    });
    const r = await useLessonRecordStore
      .getState()
      .addHomework('lr-1', { content: 'ロングトーン', status: 'not_started' });
    expect(r).toEqual({ ok: true });
    expect(useLessonRecordStore.getState().records[0].homework).toHaveLength(1);
  });

  it('updateHomeworkStatus done で completedAt がセットされる', async () => {
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: 'x',
          advice: null,
          notes: null,
          textbookEntries: [],
          recordings: [],
          homework: [
            {
              id: 'hw-1',
              content: 'x',
              dueDate: null,
              textbookId: null,
              textbookTitle: '',
              reviewNote: null,
              status: 'not_started',
              completedAt: null,
            },
          ],
        },
      ],
      loading: false,
    });
    mockSupabase().from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'hw-1',
                content: 'x',
                due_date: null,
                textbook_id: null,
                review_note: null,
                status: 'done',
                completed_at: '2026-07-21T00:00:00Z',
                textbooks: null,
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    await useLessonRecordStore.getState().updateHomeworkStatus('hw-1', 'done');
    const hw = useLessonRecordStore.getState().records[0].homework[0];
    expect(hw.status).toBe('done');
    expect(hw.completedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗**

Run: `npx jest store/__tests__/lesson-record.test.ts -t '宿題アクション'`
Expected: FAIL (アクション未定義)

- [ ] **Step 3: 実装**

`store/lesson-record.ts` を編集。

(1) import に追加:

```ts
import type { HomeworkInput, HomeworkStatus } from '@/forms/homework';
```

(2) 型を追加 (`TextbookEntry` の近く):

```ts
export type Homework = {
  id: string;
  content: string;
  dueDate: string | null;
  textbookId: string | null;
  textbookTitle: string;
  reviewNote: string | null;
  status: HomeworkStatus;
  completedAt: string | null;
};

type HomeworkRow = {
  id: string;
  content: string;
  due_date: string | null;
  textbook_id: string | null;
  review_note: string | null;
  status: HomeworkStatus;
  completed_at: string | null;
  textbooks: { title: string } | null;
};

function mapHomework(row: HomeworkRow): Homework {
  return {
    id: row.id,
    content: row.content,
    dueDate: row.due_date,
    textbookId: row.textbook_id,
    textbookTitle: row.textbooks?.title ?? '',
    reviewNote: row.review_note,
    status: row.status,
    completedAt: row.completed_at,
  };
}

const HOMEWORK_SELECT =
  'id, content, due_date, textbook_id, review_note, status, completed_at, textbooks ( title )';

export type MutationResult = { ok: true } | { ok: false; reason: 'unknown' };
```

(3) `LessonRecord` 型 (20-27) に追加:

```ts
  homework: Homework[];
```

(4) `LessonRecordRow` 型 (37-49) に追加:

```ts
  lesson_homework: HomeworkRow[];
```

(5) `fetchAll` の select 文字列 (82-86) に宿題 join を追加 (末尾に `+ ', lesson_homework ( ' + HOMEWORK_SELECT + ' )'`):

```ts
      .select(
        'id, held_at, advice, notes, ' +
          'lesson_record_textbooks ( textbook_id, current_page, duration_minutes, tempo_bpm, textbooks ( title ) ), ' +
          'lesson_record_recordings ( id, index, local_uri, memo ), ' +
          'lesson_homework ( ' +
          HOMEWORK_SELECT +
          ' )',
      )
```

(6) `fetchAll` の map (94-112) の各 record に追加:

```ts
        homework: (row.lesson_homework ?? []).map(mapHomework),
```

(7) `add` の optimistic 追加オブジェクト (190-207) に追加:

```ts
          homework: [],
```

(8) 状態型 `LessonRecordState` (51-69) に 4 アクションを追加:

```ts
addHomework: (lessonRecordId: string, input: HomeworkInput) => Promise<MutationResult>;
updateHomework: (id: string, input: HomeworkInput) => Promise<MutationResult>;
updateHomeworkStatus: (id: string, status: HomeworkStatus) => Promise<void>;
removeHomework: (id: string) => Promise<void>;
```

(9) store 実装末尾 (`deleteRecordingRow` の後) に 4 アクションを追加:

```ts
  addHomework: async (lessonRecordId, input) => {
    const completedAt = input.status === 'done' ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from('lesson_homework')
      .insert({
        lesson_record_id: lessonRecordId,
        content: input.content,
        due_date: input.dueDate || null,
        textbook_id: input.textbookId || null,
        review_note: input.reviewNote || null,
        status: input.status,
        completed_at: completedAt,
      })
      .select(HOMEWORK_SELECT)
      .single();
    if (error || !data) return { ok: false, reason: 'unknown' };
    const hw = mapHomework(data as unknown as HomeworkRow);
    set({
      records: get().records.map((r) =>
        r.id === lessonRecordId ? { ...r, homework: [...r.homework, hw] } : r,
      ),
    });
    return { ok: true };
  },

  updateHomework: async (id, input) => {
    const completedAt = input.status === 'done' ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from('lesson_homework')
      .update({
        content: input.content,
        due_date: input.dueDate || null,
        textbook_id: input.textbookId || null,
        review_note: input.reviewNote || null,
        status: input.status,
        completed_at: completedAt,
      })
      .eq('id', id)
      .select(HOMEWORK_SELECT)
      .single();
    if (error || !data) return { ok: false, reason: 'unknown' };
    const hw = mapHomework(data as unknown as HomeworkRow);
    set({
      records: get().records.map((r) => ({
        ...r,
        homework: r.homework.map((h) => (h.id === id ? hw : h)),
      })),
    });
    return { ok: true };
  },

  updateHomeworkStatus: async (id, status) => {
    const completedAt = status === 'done' ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from('lesson_homework')
      .update({ status, completed_at: completedAt })
      .eq('id', id)
      .select(HOMEWORK_SELECT)
      .single();
    if (error || !data) return;
    const hw = mapHomework(data as unknown as HomeworkRow);
    set({
      records: get().records.map((r) => ({
        ...r,
        homework: r.homework.map((h) => (h.id === id ? hw : h)),
      })),
    });
  },

  removeHomework: async (id) => {
    const { error } = await supabase.from('lesson_homework').delete().eq('id', id);
    if (error) return;
    set({
      records: get().records.map((r) => ({
        ...r,
        homework: r.homework.filter((h) => h.id !== id),
      })),
    });
  },
```

注: `add`/`update` の delete-all-reinsert は textbook 子だけを対象とし、宿題には触れない。`update` の optimistic は `{ ...r, ... }` スプレッドなので既存の `homework` を保持する (変更不要)。

- [ ] **Step 4: テスト実行 → 成功**

Run: `npx jest store/__tests__/lesson-record.test.ts`
Expected: PASS

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラー 0 (LessonRecord に homework 必須化 → fetchAll/add 両経路で埋めたので通る)

- [ ] **Step 6: コミット**

```bash
git add store/lesson-record.ts store/__tests__/lesson-record.test.ts
git commit -m "feat: レッスンストアに宿題の id 単位 CRUD を追加"
```

---

### Task B4: 宿題フォーム画面 `app/homework-form.tsx`

**Files:**

- Create: `app/homework-form.tsx`

`monthly-milestone-form.tsx` の `snapshotRef` パターン (保存時のヘッダ書換クラッシュ回避) を踏襲する。

- [ ] **Step 1: 実装**

`app/homework-form.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { Button, Input, Paragraph, Select, TextArea, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { formatDate } from '@/forms/lesson-record';
import {
  HOMEWORK_STATUS_LABELS,
  HOMEWORK_STATUS_VALUES,
  type HomeworkInput,
  homeworkSchema,
} from '@/forms/homework';
import { type Homework, useLessonRecordStore } from '@/store/lesson-record';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

// 外側: params 解決 + スナップショット確定。RHF を持つ本体 (HomeworkFormBody) は
// existing が確定してからマウントするため、defaultValues が常に正しい
// (edit モードで records 未取得の初回に空 default で初期化される RHF バグを避ける)。
export default function HomeworkForm() {
  const { lessonRecordId, id } = useLocalSearchParams<{ lessonRecordId?: string; id?: string }>();
  const records = useLessonRecordStore((s) => s.records);

  useFocusEffect(
    useCallback(() => {
      useTextbookCatalogStore.getState().fetchAll();
      useLessonRecordStore.getState().fetchAll();
    }, []),
  );

  // 開いた時点の宿題を一度だけ固定する (保存後の再解決でモード反転→クラッシュを避ける)。
  const snapshotRef = useRef<{ existing: Homework | undefined } | null>(null);
  if (snapshotRef.current === null) {
    if (id == null) {
      snapshotRef.current = { existing: undefined };
    } else {
      const ex = records.flatMap((r) => r.homework).find((h) => h.id === id);
      if (ex) snapshotRef.current = { existing: ex };
    }
  }

  // 編集モードで宿題がまだ取得できていない (records 未ロード) 場合はローディング表示。
  if (snapshotRef.current === null) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: '宿題を編集' }} />
        <YStack p="$4">
          <Paragraph>読み込み中...</Paragraph>
        </YStack>
      </>
    );
  }

  return (
    <HomeworkFormBody existing={snapshotRef.current.existing} lessonRecordId={lessonRecordId} />
  );
}

type BodyProps = { existing: Homework | undefined; lessonRecordId?: string };

function HomeworkFormBody({ existing, lessonRecordId }: BodyProps) {
  const textbooks = useTextbookCatalogStore((s) => s.textbooks);
  const addHomework = useLessonRecordStore((s) => s.addHomework);
  const updateHomework = useLessonRecordStore((s) => s.updateHomework);
  const removeHomework = useLessonRecordStore((s) => s.removeHomework);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isEdit = existing != null;

  const defaultValues: HomeworkInput = existing
    ? {
        content: existing.content,
        dueDate: existing.dueDate ?? '',
        textbookId: existing.textbookId ?? '',
        reviewNote: existing.reviewNote ?? '',
        status: existing.status,
      }
    : { content: '', dueDate: '', textbookId: '', reviewNote: '', status: 'not_started' };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<HomeworkInput>({
    resolver: zodResolver(homeworkSchema),
    mode: 'onTouched',
    defaultValues,
  });

  async function onSubmit(values: HomeworkInput) {
    const result = isEdit
      ? await updateHomework(existing!.id, values)
      : lessonRecordId
        ? await addHomework(lessonRecordId, values)
        : ({ ok: false, reason: 'unknown' } as const);
    if (!result.ok) {
      Alert.alert('保存に失敗しました');
      return;
    }
    router.back();
  }

  function onDelete() {
    if (!existing) return;
    Alert.alert('宿題を削除しますか？', '', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await removeHomework(existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: isEdit ? '宿題を編集' : '宿題を追加' }} />
      <YStack p="$4" gap="$3">
        <Controller
          control={control}
          name="content"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>内容 *</Paragraph>
              <TextArea
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="例: ロングトーンを毎日10分"
                numberOfLines={3}
                aria-label="宿題の内容"
              />
              <FieldError message={errors.content?.message} />
            </YStack>
          )}
        />

        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <YStack gap="$1">
              <Paragraph>進捗</Paragraph>
              <XStack gap="$2">
                {HOMEWORK_STATUS_VALUES.map((v) => (
                  <Button
                    key={v}
                    size="$2"
                    theme={field.value === v ? 'blue' : undefined}
                    onPress={() => field.onChange(v)}
                    aria-label={`ステータス ${HOMEWORK_STATUS_LABELS[v]}`}
                  >
                    {HOMEWORK_STATUS_LABELS[v]}
                  </Button>
                ))}
              </XStack>
            </YStack>
          )}
        />

        <Controller
          control={control}
          name="dueDate"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph>期限 (任意)</Paragraph>
              <Input
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="YYYY-MM-DD"
                aria-label="宿題の期限"
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
              <FieldError message={errors.dueDate?.message} />
            </YStack>
          )}
        />

        <Controller
          control={control}
          name="textbookId"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph>関連教本 (任意)</Paragraph>
              <Select value={value ?? ''} onValueChange={onChange}>
                <Select.Trigger onBlur={onBlur} aria-label="関連教本を選択">
                  <Select.Value placeholder="教本を選択" />
                </Select.Trigger>
                <Select.Content>
                  <Select.ScrollUpButton />
                  <Select.Viewport>
                    {textbooks.map((tb, i) => (
                      <Select.Item key={tb.id} index={i} value={tb.id}>
                        <Select.ItemText>{tb.title}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                  <Select.ScrollDownButton />
                </Select.Content>
              </Select>
            </YStack>
          )}
        />

        <Controller
          control={control}
          name="reviewNote"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph>振り返りメモ (任意)</Paragraph>
              <TextArea
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="取り組んだ結果など"
                numberOfLines={3}
                aria-label="宿題の振り返りメモ"
              />
            </YStack>
          )}
        />

        <Button
          theme="blue"
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          aria-label="保存"
        >
          保存
        </Button>
        {isEdit && (
          <Button theme="red" onPress={onDelete}>
            削除
          </Button>
        )}
      </YStack>
    </>
  );
}
```

- [ ] **Step 2: 型チェック + Lint**

Run: `npx tsc --noEmit && npx eslint app/homework-form.tsx`
Expected: エラー 0 (`typedRoutes` により `/homework-form` が型に追加される)

- [ ] **Step 3: コミット**

```bash
git add app/homework-form.tsx
git commit -m "feat: 宿題の追加/編集フォーム画面を追加"
```

---

### Task B5: 宿題セクション + 直近レッスンカード

**Files:**

- Create: `components/lesson-homework-section.tsx`
- Create: `components/latest-lesson-homework-card.tsx`
- Test: `components/__tests__/latest-lesson-homework-card.test.tsx`

`LessonHomeworkSection` は再利用部品 (宿題一覧 + ステータストグル + 追加/編集ナビ)。`LatestLessonHomeworkCard` は `records[0]` を対象にカードで包む。

- [ ] **Step 1: 失敗するテストを書く**

`components/__tests__/latest-lesson-homework-card.test.tsx`:

```tsx
import { fireEvent } from '@testing-library/react-native';

import { LatestLessonHomeworkCard } from '@/components/latest-lesson-homework-card';
import { renderWithProviders } from '@/test-utils/render';
import { useLessonRecordStore } from '@/store/lesson-record';

describe('LatestLessonHomeworkCard', () => {
  it('ステータストグルで updateHomeworkStatus が呼ばれる', () => {
    const updateHomeworkStatus = jest.fn();
    useLessonRecordStore.setState({
      records: [
        {
          id: 'lr-1',
          heldAt: '2026-07-20T10:00:00+09:00',
          advice: null,
          notes: null,
          textbookEntries: [],
          recordings: [],
          homework: [
            {
              id: 'hw-1',
              content: 'ロングトーン強化',
              dueDate: null,
              textbookId: null,
              textbookTitle: '',
              reviewNote: null,
              status: 'not_started',
              completedAt: null,
            },
          ],
        },
      ],
      loading: false,
      updateHomeworkStatus,
    } as any);

    const { getByLabelText } = renderWithProviders(<LatestLessonHomeworkCard />);
    fireEvent.press(getByLabelText('ロングトーン強化 のステータスを進める'));
    expect(updateHomeworkStatus).toHaveBeenCalledWith('hw-1', 'in_progress');
  });

  it('レッスンが無ければ何も描画しない', () => {
    useLessonRecordStore.setState({ records: [], loading: false } as any);
    const { queryByText } = renderWithProviders(<LatestLessonHomeworkCard />);
    expect(queryByText('今の宿題')).toBeNull();
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗**

Run: `npx jest components/__tests__/latest-lesson-homework-card.test.tsx`
Expected: FAIL (モジュール未作成)

- [ ] **Step 3: 実装**

`components/lesson-homework-section.tsx`:

```tsx
import { router } from 'expo-router';
import { Button, Paragraph, XStack, YStack } from 'tamagui';

import { HOMEWORK_STATUS_LABELS, type HomeworkStatus } from '@/forms/homework';
import { type Homework, useLessonRecordStore } from '@/store/lesson-record';

const NEXT_STATUS: Record<HomeworkStatus, HomeworkStatus> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'not_started',
};

type Props = {
  lessonRecordId: string;
  homework: Homework[];
};

export function LessonHomeworkSection({ lessonRecordId, homework }: Props) {
  const updateHomeworkStatus = useLessonRecordStore((s) => s.updateHomeworkStatus);

  return (
    <YStack gap="$2">
      {homework.length === 0 ? (
        <Paragraph fontSize="$2" color="$color10">
          宿題はありません
        </Paragraph>
      ) : (
        homework.map((h) => (
          <XStack
            key={h.id}
            gap="$2"
            items="center"
            p="$2"
            bg="$color2"
            rounded="$3"
            justify="space-between"
          >
            <YStack flex={1} gap="$1">
              <Paragraph
                onPress={() => router.push(`/homework-form?id=${h.id}`)}
                accessibilityLabel={`${h.content} を編集`}
              >
                {h.content}
              </Paragraph>
              {h.dueDate ? (
                <Paragraph fontSize="$1" color="$color10">
                  {`期限 ${h.dueDate}`}
                </Paragraph>
              ) : null}
            </YStack>
            <Button
              size="$2"
              theme={
                h.status === 'done' ? 'green' : h.status === 'in_progress' ? 'blue' : undefined
              }
              onPress={() => updateHomeworkStatus(h.id, NEXT_STATUS[h.status])}
              aria-label={`${h.content} のステータスを進める`}
            >
              {HOMEWORK_STATUS_LABELS[h.status]}
            </Button>
          </XStack>
        ))
      )}
      <Button
        size="$2"
        onPress={() => router.push(`/homework-form?lessonRecordId=${lessonRecordId}`)}
        aria-label="宿題を追加"
      >
        ＋ 宿題を追加
      </Button>
    </YStack>
  );
}
```

`components/latest-lesson-homework-card.tsx`:

```tsx
import { Paragraph, YStack } from 'tamagui';

import { LessonHomeworkSection } from '@/components/lesson-homework-section';
import { useLessonRecordStore } from '@/store/lesson-record';

export function LatestLessonHomeworkCard() {
  const records = useLessonRecordStore((s) => s.records);
  const latest = records[0]; // held_at desc で最新
  if (!latest) return null;

  return (
    <YStack
      mx="$3"
      mt="$3"
      mb="$1"
      p="$3"
      bg="$color1"
      rounded="$3"
      borderWidth={1}
      borderColor="$borderColor"
      gap="$2"
    >
      <Paragraph fontWeight="bold">今の宿題</Paragraph>
      <LessonHomeworkSection lessonRecordId={latest.id} homework={latest.homework} />
    </YStack>
  );
}
```

- [ ] **Step 4: テスト実行 → 成功**

Run: `npx jest components/__tests__/latest-lesson-homework-card.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add components/lesson-homework-section.tsx components/latest-lesson-homework-card.tsx components/__tests__/latest-lesson-homework-card.test.tsx
git commit -m "feat: 宿題セクションと直近レッスン宿題カードを追加"
```

---

### Task B6: lesson タブとレッスンフォームに宿題を配線

**Files:**

- Modify: `app/(tabs)/lesson.tsx`
- Modify: `app/lesson-record-form.tsx`

- [ ] **Step 1: lesson タブにカードを配置**

`app/(tabs)/lesson.tsx`:

import を追加:

```tsx
import { LatestLessonHomeworkCard } from '@/components/latest-lesson-homework-card';
```

`ListHeaderComponent` の月ナビ `XStack`(81-102) の直後、`monthlySummary` カードの前に配置:

```tsx
<LatestLessonHomeworkCard />
```

- [ ] **Step 2: レッスン編集画面に宿題セクションを配置**

`app/lesson-record-form.tsx`:

import を追加:

```tsx
import { Paragraph, YStack } from 'tamagui';

import { LessonHomeworkSection } from '@/components/lesson-homework-section';
```

`<ScrollView>` 内、`<LessonRecordForm ... />` の直後に、編集モードのときだけ宿題セクションを追加:

```tsx
{
  id && existing ? (
    <YStack px="$4" pb="$4" gap="$2">
      <Paragraph color="$color12" fontWeight="bold">
        宿題
      </Paragraph>
      <LessonHomeworkSection lessonRecordId={id} homework={existing.homework} />
    </YStack>
  ) : null;
}
{
  !id ? (
    <YStack px="$4" pb="$4">
      <Paragraph fontSize="$2" color="$color10">
        宿題はレッスンを保存後に追加できます
      </Paragraph>
    </YStack>
  ) : null;
}
```

- [ ] **Step 3: 型チェック + Lint**

Run: `npx tsc --noEmit && npx eslint "app/(tabs)/lesson.tsx" app/lesson-record-form.tsx`
Expected: エラー 0

- [ ] **Step 4: コミット**

```bash
git add "app/(tabs)/lesson.tsx" app/lesson-record-form.tsx
git commit -m "feat: lesson タブと編集画面に宿題セクションを配線"
```

---

### Task B7: 宿題フォーム integration スモーク + ストリーム B 総合チェック

**Files:**

- Create: `__tests__/integration/homework-form.integration.test.tsx`

- [ ] **Step 1: スモークテスト**

`__tests__/integration/homework-form.integration.test.tsx` を新規作成。既存 integration テスト (例: `__tests__/integration/practice-log-form.integration.test.tsx`) の render/モック様式に合わせ、宿題フォームに内容を入力して保存すると `addHomework` が呼ばれる 1 経路を確認する:

```tsx
import { fireEvent, waitFor } from '@testing-library/react-native';

import HomeworkForm from '@/app/homework-form';
import { renderWithProviders } from '@/test-utils/render';
import { useLessonRecordStore } from '@/store/lesson-record';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useLocalSearchParams: () => ({ lessonRecordId: 'lr-1' }),
  router: { back: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
  useFocusEffect: () => {},
}));

describe('homework-form integration', () => {
  it('内容を入力して保存すると addHomework が呼ばれる', async () => {
    const addHomework = jest.fn().mockResolvedValue({ ok: true });
    useLessonRecordStore.setState({ records: [], addHomework } as any);

    const { getByLabelText } = renderWithProviders(<HomeworkForm />);
    fireEvent.changeText(getByLabelText('宿題の内容'), 'ロングトーン強化');
    fireEvent.press(getByLabelText('保存'));

    await waitFor(() => expect(addHomework).toHaveBeenCalled());
    expect(addHomework.mock.calls[0][0]).toBe('lr-1');
    expect(addHomework.mock.calls[0][1].content).toBe('ロングトーン強化');
  });
});
```

注: `useTextbookCatalogStore` 等が必要なら既存テストの `jest.setup.ts` グローバルモック + `setState` で補う。モックの詳細は既存 integration テストに合わせて調整する。

- [ ] **Step 2: スモークテスト実行**

Run: `npx jest __tests__/integration/homework-form.integration.test.tsx`
Expected: PASS

- [ ] **Step 3: ストリーム B 品質チェック 4 ステップ**

```bash
npm run lint
npm run format:check
npx tsc --noEmit
npx jest --runInBand
```

Expected: すべて緑。

- [ ] **Step 4: コミット**

```bash
git add __tests__/integration/homework-form.integration.test.tsx
git commit -m "test: 宿題フォームの保存経路スモークを追加"
```

---

## Task C1: ドキュメント更新

**Files:**

- Modify: `supabase/CLAUDE.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: supabase/CLAUDE.md**

「DB スキーマ概要」の `practice_sessions` 行に `start_time` / `end_time` を追記し、新テーブル行を追加:

```
- `lesson_homework` — レッスンの宿題。`lesson_record_id` / `content` / `due_date` / `textbook_id` / `review_note` / `status('not_started'|'in_progress'|'done')` / `completed_at`。RLS は親 `lesson_records.user_id` を EXISTS で検証
```

- [ ] **Step 2: ルート CLAUDE.md**

Architecture のルート一覧に追加:

```
- `app/homework-form.tsx` — 宿題 登録/編集フォーム画面 (スタック遷移)
```

「重要な設計判断」に 2 点追記:

```
- **練習記録の開始/終了時刻は独立セッションタイマーで算出する**: `components/form/session-timer.tsx` (`SessionTimer`) が `store/timer.ts` を専用キー `'practice-session'` で駆動し、`firstStartedAt`(初回開始 epoch) を開始時刻、`firstStartedAt + 計測 elapsed` を終了時刻として HH:MM で練習フォームへ供給する (壁時計の停止時刻ではない)。`practice_sessions.start_time`/`end_time` (text) に保存され、`total_minutes`/`calcSessionTime` の分数計算には不参入。手入力 HH:MM でも修正可能
- **レッスン宿題はレッスン保存の delete-all-reinsert に含めない**: `lesson_homework` は `store/lesson-record.ts` の `addHomework`/`updateHomework`/`updateHomeworkStatus`/`removeHomework` で id 単位に CRUD する。`lesson_records` の `update` は textbook 子を全削除→再挿入するが、宿題を同じ扱いにするとレッスン後に独立更新した進捗ステータスが消えるため。作成は保存済みレッスン (編集モード) から `app/homework-form.tsx` 経由でのみ行う
```

- [ ] **Step 3: フォーマット確認**

Run: `npm run format`
Expected: 差分整形のみ

- [ ] **Step 4: コミット**

```bash
git add supabase/CLAUDE.md CLAUDE.md
git commit -m "docs: 開始/終了時刻と宿題進捗の設計判断を CLAUDE.md に追記"
```

---

## 完了時の統合 Verification (実機/dev build)

`npm start` で dev build を起動し、以下を手動確認する:

1. **練習時刻**: 練習記録フォームで「練習開始」→ 開始 Input に現在時刻が即時反映 → 一時停止/再開 → 停止で終了 Input に (開始+計測) が入る → 保存 → 一覧カードに `19:00–19:50` 表示。合計分数が時刻入力で変わらないこと。手入力 HH:MM の修正も反映されること。
2. **宿題**: レッスンを新規保存 → 編集画面 or lesson タブ「今の宿題」カードから「＋宿題を追加」→ 内容/期限/教本/振り返りを入力し保存 → カードにステータスボタン表示 → タップで 未着手→進行中→完了 と循環 → レッスン記録を再度編集して保存しても宿題ステータスが保持されること (delete-all-reinsert 非巻き込みの回帰確認)。

## finishing

両ストリーム完了後、`superpowers:finishing-a-development-branch` で `main` 直コミット運用に沿ってまとめる (個人開発の標準)。
