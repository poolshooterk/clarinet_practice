# 練習タイマー機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 練習記録フォームの各セクション（ロングトーン・タンギング・各教本）にストップウォッチ機能を追加し、計測した時間（切り上げ分）をフォームへ自動入力する。

**Architecture:** タイマー状態を Zustand + persist で管理し（`store/timer.ts`）、各セクションに `TimerControl` コンポーネントを埋め込む。タイマーキーは `'long_tone'` / `'tonguing'` / `'textbook-<fieldId>'` で識別。バックグラウンド中も `startedAt` タイムスタンプ差分で経過時間を正確に計算する。

**Tech Stack:** Zustand v5 + persist, React Native AppState, React Hook Form setValue, Tamagui

---

## ファイル一覧

| 操作     | ファイル                                                             |
| -------- | -------------------------------------------------------------------- |
| 新規作成 | `supabase/migrations/20260515000003_add_textbook_duration.sql`       |
| 新規作成 | `store/timer.ts`                                                     |
| 新規作成 | `store/__tests__/timer.test.ts`                                      |
| 新規作成 | `components/timer-control.tsx`                                       |
| 新規作成 | `components/__tests__/timer-control.test.tsx`                        |
| 新規作成 | `__tests__/integration/practice-log-form-timer.integration.test.tsx` |
| 変更     | `forms/practice-log.ts`                                              |
| 変更     | `forms/__tests__/practice-log.test.ts`                               |
| 変更     | `store/practice-log.ts`                                              |
| 変更     | `store/__tests__/practice-log.test.ts`                               |
| 変更     | `components/practice-log-form.tsx`                                   |
| 変更     | `app/(tabs)/index.tsx`                                               |

---

## Task 1: DB マイグレーション

**Files:**

- Create: `supabase/migrations/20260515000003_add_textbook_duration.sql`

- [ ] **Step 1: マイグレーションファイルを作成する**

```sql
-- supabase/migrations/20260515000003_add_textbook_duration.sql
ALTER TABLE practice_session_textbooks
  ADD COLUMN duration_minutes integer;
```

- [ ] **Step 2: ローカルへ適用する**

```bash
supabase db push
```

Expected: エラーなく完了し、`practice_session_textbooks` に `duration_minutes` カラムが追加される。

- [ ] **Step 3: コミットする**

```bash
git add supabase/migrations/20260515000003_add_textbook_duration.sql
git commit -m "feat: practice_session_textbooks に duration_minutes カラムを追加"
```

---

## Task 2: Timer Store

**Files:**

- Create: `store/timer.ts`
- Create: `store/__tests__/timer.test.ts`

- [ ] **Step 1: 失敗テストを書く**

```typescript
// store/__tests__/timer.test.ts
import { useTimerStore } from '@/store/timer';

beforeEach(() => {
  useTimerStore.setState({ timers: {} });
});

describe('start', () => {
  it('idle → running になる', () => {
    useTimerStore.getState().start('long_tone');
    const entry = useTimerStore.getState().timers['long_tone'];
    expect(entry.status).toBe('running');
    expect(entry.startedAt).not.toBeNull();
    expect(entry.accumulatedMs).toBe(0);
  });

  it('paused → running になる（再開）', () => {
    useTimerStore.setState({
      timers: { long_tone: { status: 'paused', accumulatedMs: 5000, startedAt: null } },
    });
    useTimerStore.getState().start('long_tone');
    const entry = useTimerStore.getState().timers['long_tone'];
    expect(entry.status).toBe('running');
    expect(entry.accumulatedMs).toBe(5000);
    expect(entry.startedAt).not.toBeNull();
  });
});

describe('pause', () => {
  it('running → paused になり経過時間を蓄積する', () => {
    const t0 = 1000000;
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(t0)
      .mockReturnValueOnce(t0 + 10000);
    useTimerStore.getState().start('long_tone');
    useTimerStore.getState().pause('long_tone');
    const entry = useTimerStore.getState().timers['long_tone'];
    expect(entry.status).toBe('paused');
    expect(entry.accumulatedMs).toBe(10000);
    expect(entry.startedAt).toBeNull();
    jest.restoreAllMocks();
  });

  it('idle 状態への pause は何もしない', () => {
    useTimerStore.setState({
      timers: { long_tone: { status: 'idle', accumulatedMs: 0, startedAt: null } },
    });
    useTimerStore.getState().pause('long_tone');
    expect(useTimerStore.getState().timers['long_tone'].status).toBe('idle');
  });
});

describe('stop', () => {
  it('1 秒以下 → 1 分（最小値）', () => {
    useTimerStore.setState({
      timers: { long_tone: { status: 'paused', accumulatedMs: 500, startedAt: null } },
    });
    const minutes = useTimerStore.getState().stop('long_tone');
    expect(minutes).toBe(1);
    expect(useTimerStore.getState().timers['long_tone'].status).toBe('stopped');
  });

  it('ちょうど 60 秒 → 1 分', () => {
    useTimerStore.setState({
      timers: { long_tone: { status: 'paused', accumulatedMs: 60000, startedAt: null } },
    });
    expect(useTimerStore.getState().stop('long_tone')).toBe(1);
  });

  it('61 秒 → 2 分（切り上げ）', () => {
    useTimerStore.setState({
      timers: { long_tone: { status: 'paused', accumulatedMs: 61000, startedAt: null } },
    });
    expect(useTimerStore.getState().stop('long_tone')).toBe(2);
  });

  it('running 中でも残り時間を加算して計算する', () => {
    const t0 = 1000000;
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(t0)
      .mockReturnValueOnce(t0 + 90000);
    useTimerStore.getState().start('tonguing');
    const minutes = useTimerStore.getState().stop('tonguing');
    expect(minutes).toBe(2);
    jest.restoreAllMocks();
  });

  it('未登録キーを stop しても 1 を返す', () => {
    expect(useTimerStore.getState().stop('unknown')).toBe(1);
  });
});

describe('reset', () => {
  it('stopped → idle に戻り accumulatedMs が 0 になる', () => {
    useTimerStore.setState({
      timers: { long_tone: { status: 'stopped', accumulatedMs: 60000, startedAt: null } },
    });
    useTimerStore.getState().reset('long_tone');
    const entry = useTimerStore.getState().timers['long_tone'];
    expect(entry.status).toBe('idle');
    expect(entry.accumulatedMs).toBe(0);
    expect(entry.startedAt).toBeNull();
  });
});

describe('resetAll', () => {
  it('全タイマーをクリアする', () => {
    useTimerStore.getState().start('long_tone');
    useTimerStore.getState().start('tonguing');
    useTimerStore.getState().resetAll();
    expect(useTimerStore.getState().timers).toEqual({});
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
npx jest store/__tests__/timer.test.ts
```

Expected: `Cannot find module '@/store/timer'`

- [ ] **Step 3: Timer Store を実装する**

```typescript
// store/timer.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped';

export type TimerEntry = {
  status: TimerStatus;
  accumulatedMs: number;
  startedAt: number | null;
};

type TimerState = {
  timers: Record<string, TimerEntry>;
  start: (key: string) => void;
  pause: (key: string) => void;
  stop: (key: string) => number;
  reset: (key: string) => void;
  resetAll: () => void;
};

const defaultEntry: TimerEntry = { status: 'idle', accumulatedMs: 0, startedAt: null };

export function getElapsedMs(entry: TimerEntry): number {
  if (entry.status === 'running' && entry.startedAt != null) {
    return entry.accumulatedMs + (Date.now() - entry.startedAt);
  }
  return entry.accumulatedMs;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timers: {},

      start: (key) =>
        set((state) => ({
          timers: {
            ...state.timers,
            [key]: {
              ...(state.timers[key] ?? defaultEntry),
              status: 'running',
              startedAt: Date.now(),
            },
          },
        })),

      pause: (key) =>
        set((state) => {
          const entry = state.timers[key] ?? defaultEntry;
          if (entry.status !== 'running') return state;
          const elapsed = entry.startedAt != null ? Date.now() - entry.startedAt : 0;
          return {
            timers: {
              ...state.timers,
              [key]: {
                status: 'paused',
                accumulatedMs: entry.accumulatedMs + elapsed,
                startedAt: null,
              },
            },
          };
        }),

      stop: (key) => {
        const entry = get().timers[key] ?? defaultEntry;
        const elapsed =
          entry.status === 'running' && entry.startedAt != null ? Date.now() - entry.startedAt : 0;
        const totalMs = entry.accumulatedMs + elapsed;
        const minutes = Math.max(1, Math.ceil(totalMs / 60000));
        set((state) => ({
          timers: {
            ...state.timers,
            [key]: { status: 'stopped', accumulatedMs: totalMs, startedAt: null },
          },
        }));
        return minutes;
      },

      reset: (key) =>
        set((state) => ({
          timers: { ...state.timers, [key]: { ...defaultEntry } },
        })),

      resetAll: () => set({ timers: {} }),
    }),
    {
      name: 'clarinet-practice-timers',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

- [ ] **Step 4: テストを実行してすべてパスすることを確認する**

```bash
npx jest store/__tests__/timer.test.ts
```

Expected: PASS (全テスト)

- [ ] **Step 5: コミットする**

```bash
git add store/timer.ts store/__tests__/timer.test.ts
git commit -m "feat: タイマー Zustand ストアを追加（start/pause/stop/reset/resetAll）"
```

---

## Task 3: TimerControl コンポーネント

**Files:**

- Create: `components/timer-control.tsx`
- Create: `components/__tests__/timer-control.test.tsx`

- [ ] **Step 1: 失敗テストを書く**

```typescript
// components/__tests__/timer-control.test.tsx
import { fireEvent } from '@testing-library/react-native';

import { TimerControl } from '@/components/timer-control';
import { useTimerStore } from '@/store/timer';
import { renderWithProviders, screen } from '@/test-utils/render';

beforeEach(() => {
  useTimerStore.setState({ timers: {} });
});

describe('idle 状態', () => {
  it('計測開始・時刻で入力 ボタンを表示する', () => {
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={jest.fn()} />);
    expect(screen.getByLabelText('テストの計測開始')).toBeTruthy();
    expect(screen.getByLabelText('テストの時刻で入力')).toBeTruthy();
  });
});

describe('running 状態', () => {
  it('一時停止・停止 ボタンを表示する', () => {
    useTimerStore.setState({
      timers: { test: { status: 'running', accumulatedMs: 0, startedAt: Date.now() } },
    });
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={jest.fn()} />);
    expect(screen.getByLabelText('テストの一時停止')).toBeTruthy();
    expect(screen.getByLabelText('テストの停止')).toBeTruthy();
  });
});

describe('paused 状態', () => {
  it('再開・停止 ボタンを表示する', () => {
    useTimerStore.setState({
      timers: { test: { status: 'paused', accumulatedMs: 5000, startedAt: null } },
    });
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={jest.fn()} />);
    expect(screen.getByLabelText('テストの再開')).toBeTruthy();
    expect(screen.getByLabelText('テストの停止')).toBeTruthy();
  });
});

describe('stopped 状態', () => {
  it('計測結果テキストとリセットボタンを表示する', () => {
    useTimerStore.setState({
      timers: { test: { status: 'stopped', accumulatedMs: 61000, startedAt: null } },
    });
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={jest.fn()} />);
    expect(screen.getByLabelText('テストのリセット')).toBeTruthy();
    expect(screen.getByText('2分計測済')).toBeTruthy();
  });
});

describe('onStop コールバック', () => {
  it('停止ボタンを押すと onStop が分数で呼ばれる', () => {
    useTimerStore.setState({
      timers: { test: { status: 'paused', accumulatedMs: 61000, startedAt: null } },
    });
    const onStop = jest.fn();
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={onStop} />);
    fireEvent.press(screen.getByLabelText('テストの停止'));
    expect(onStop).toHaveBeenCalledWith(2);
  });
});

describe('手動時刻入力', () => {
  it('時刻で入力を押すと HH:MM フィールドが現れる', () => {
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('テストの時刻で入力'));
    expect(screen.getByLabelText('テストの開始時刻')).toBeTruthy();
    expect(screen.getByLabelText('テストの終了時刻')).toBeTruthy();
  });

  it('10:00〜10:15 → onStop(15) が呼ばれる', () => {
    const onStop = jest.fn();
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={onStop} />);
    fireEvent.press(screen.getByLabelText('テストの時刻で入力'));
    fireEvent.changeText(screen.getByLabelText('テストの開始時刻'), '10:00');
    fireEvent.changeText(screen.getByLabelText('テストの終了時刻'), '10:15');
    fireEvent.press(screen.getByLabelText('テストの適用'));
    expect(onStop).toHaveBeenCalledWith(15);
  });

  it('23:50〜00:10（日またぎ） → onStop(20) が呼ばれる', () => {
    const onStop = jest.fn();
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={onStop} />);
    fireEvent.press(screen.getByLabelText('テストの時刻で入力'));
    fireEvent.changeText(screen.getByLabelText('テストの開始時刻'), '23:50');
    fireEvent.changeText(screen.getByLabelText('テストの終了時刻'), '00:10');
    fireEvent.press(screen.getByLabelText('テストの適用'));
    expect(onStop).toHaveBeenCalledWith(20);
  });

  it('同じ時刻ではエラーメッセージを表示する', () => {
    renderWithProviders(<TimerControl timerKey="test" label="テスト" onStop={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('テストの時刻で入力'));
    fireEvent.changeText(screen.getByLabelText('テストの開始時刻'), '10:00');
    fireEvent.changeText(screen.getByLabelText('テストの終了時刻'), '10:00');
    fireEvent.press(screen.getByLabelText('テストの適用'));
    expect(screen.getByText('開始時刻と終了時刻が同じです')).toBeTruthy();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
npx jest components/__tests__/timer-control.test.tsx
```

Expected: `Cannot find module '@/components/timer-control'`

- [ ] **Step 3: TimerControl コンポーネントを実装する**

```typescript
// components/timer-control.tsx
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Button, Input, Paragraph, XStack, YStack } from 'tamagui';

import { getElapsedMs, useTimerStore } from '@/store/timer';

type Props = {
  timerKey: string;
  label: string;
  onStop: (minutes: number) => void;
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function parseHHMM(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function TimerControl({ timerKey, label, onStop }: Props) {
  const timers = useTimerStore((s) => s.timers);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const stop = useTimerStore((s) => s.stop);
  const reset = useTimerStore((s) => s.reset);

  const entry = timers[timerKey] ?? { status: 'idle' as const, accumulatedMs: 0, startedAt: null };
  const [displayMs, setDisplayMs] = useState(() => getElapsedMs(entry));
  const [showManual, setShowManual] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [manualError, setManualError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startInterval() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const e = useTimerStore.getState().timers[timerKey];
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
        const e = useTimerStore.getState().timers[timerKey];
        if (e?.status === 'running') {
          setDisplayMs(getElapsedMs(e));
          startInterval();
        }
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerKey]);

  function handleStop() {
    const minutes = stop(timerKey);
    onStop(minutes);
  }

  function handleManualApply() {
    const startMin = parseHHMM(startTime);
    const endMin = parseHHMM(endTime);
    if (startMin === null || endMin === null) {
      setManualError('HH:MM 形式で入力してください');
      return;
    }
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    if (diff === 0) {
      setManualError('開始時刻と終了時刻が同じです');
      return;
    }
    setManualError('');
    reset(timerKey);
    setShowManual(false);
    setStartTime('');
    setEndTime('');
    onStop(Math.ceil(diff));
  }

  if (entry.status === 'idle') {
    return (
      <YStack gap="$1">
        <XStack gap="$2" items="center">
          <Button
            size="$2"
            onPress={() => {
              start(timerKey);
              setShowManual(false);
            }}
            aria-label={`${label}の計測開始`}
          >
            計測開始
          </Button>
          <Button
            size="$2"
            onPress={() => setShowManual((v) => !v)}
            aria-label={`${label}の時刻で入力`}
          >
            時刻で入力
          </Button>
        </XStack>
        {showManual && (
          <YStack gap="$1">
            <XStack gap="$2" items="center">
              <Input
                flex={1}
                placeholder="開始 HH:MM"
                value={startTime}
                onChangeText={setStartTime}
                keyboardType="numbers-and-punctuation"
                aria-label={`${label}の開始時刻`}
              />
              <Paragraph>〜</Paragraph>
              <Input
                flex={1}
                placeholder="終了 HH:MM"
                value={endTime}
                onChangeText={setEndTime}
                keyboardType="numbers-and-punctuation"
                aria-label={`${label}の終了時刻`}
              />
              <Button size="$2" onPress={handleManualApply} aria-label={`${label}の適用`}>
                適用
              </Button>
            </XStack>
            {manualError ? (
              <Paragraph color="$red10" fontSize="$2">
                {manualError}
              </Paragraph>
            ) : null}
          </YStack>
        )}
      </YStack>
    );
  }

  if (entry.status === 'running' || entry.status === 'paused') {
    return (
      <XStack gap="$2" items="center">
        <Paragraph>{formatElapsed(displayMs)}</Paragraph>
        {entry.status === 'running' ? (
          <Button size="$2" onPress={() => pause(timerKey)} aria-label={`${label}の一時停止`}>
            一時停止
          </Button>
        ) : (
          <Button size="$2" onPress={() => start(timerKey)} aria-label={`${label}の再開`}>
            再開
          </Button>
        )}
        <Button size="$2" onPress={handleStop} aria-label={`${label}の停止`}>
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
      <Button size="$2" onPress={() => reset(timerKey)} aria-label={`${label}のリセット`}>
        リセット
      </Button>
    </XStack>
  );
}
```

- [ ] **Step 4: テストを実行してすべてパスすることを確認する**

```bash
npx jest components/__tests__/timer-control.test.tsx
```

Expected: PASS (全テスト)

- [ ] **Step 5: コミットする**

```bash
git add components/timer-control.tsx components/__tests__/timer-control.test.tsx
git commit -m "feat: TimerControl コンポーネントを追加（ライブ計測・手動時刻入力）"
```

---

## Task 4: フォームスキーマ更新

**Files:**

- Modify: `forms/practice-log.ts`
- Modify: `forms/__tests__/practice-log.test.ts`

- [ ] **Step 1: textbookEntries[].durationMinutes の失敗テストを追加する**

`forms/__tests__/practice-log.test.ts` の末尾（`describe('textbookEntries', ...)` ブロック内）に追加：

```typescript
describe('textbookEntries[].durationMinutes', () => {
  it('省略可能', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      textbookEntries: [{ textbookId: '123e4567-e89b-12d3-a456-426614174001', currentPage: 5 }],
    });
    expect(result.success).toBe(true);
  });

  it('1 は有効', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      textbookEntries: [
        {
          textbookId: '123e4567-e89b-12d3-a456-426614174001',
          currentPage: 5,
          durationMinutes: 1,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('0 はエラー', () => {
    const result = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      textbookEntries: [
        {
          textbookId: '123e4567-e89b-12d3-a456-426614174001',
          currentPage: 5,
          durationMinutes: 0,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
npx jest forms/__tests__/practice-log.test.ts
```

Expected: `durationMinutes 0 はエラー` が FAIL（まだスキーマにフィールドがないため pass してしまう）

- [ ] **Step 3: textbookEntrySchema に durationMinutes を追加する**

`forms/practice-log.ts` の `textbookEntrySchema` を以下に置き換える：

```typescript
const textbookEntrySchema = z.object({
  textbookId: z.string().uuid('教本を選択してください'),
  currentPage: z.number().int().min(0, '0以上の整数を入力してください'),
  durationMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
});
```

- [ ] **Step 4: テストを実行してすべてパスすることを確認する**

```bash
npx jest forms/__tests__/practice-log.test.ts
```

Expected: PASS (全テスト)

- [ ] **Step 5: コミットする**

```bash
git add forms/practice-log.ts forms/__tests__/practice-log.test.ts
git commit -m "feat: textbookEntrySchema に durationMinutes を追加"
```

---

## Task 5: practice-log ストア更新

**Files:**

- Modify: `store/practice-log.ts`
- Modify: `store/__tests__/practice-log.test.ts`

- [ ] **Step 1: store/practice-log.ts を更新する**

`TextbookEntry` 型に `durationMinutes` を追加：

```typescript
type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  totalPages: number | null;
  durationMinutes: number | null;
};
```

`SessionRow` の `practice_session_textbooks` 配列の要素型に `duration_minutes` を追加：

```typescript
type SessionRow = {
  id: string;
  practiced_at: string;
  duration_minutes: number | null;
  memo: string | null;
  practice_session_textbooks: {
    textbook_id: string;
    current_page: number;
    duration_minutes: number | null;
    textbooks: { title: string; total_pages: number | null } | null;
  }[];
  practice_session_basic_menus: {
    menu_type: string;
    duration_minutes: number;
    tempo_bpms: number[] | null;
  }[];
};
```

`fetchAll` の textbookEntries マッピングを更新：

```typescript
textbookEntries: (row.practice_session_textbooks ?? []).map((entry) => ({
  textbookId: entry.textbook_id,
  textbookTitle: entry.textbooks?.title ?? '',
  currentPage: entry.current_page,
  totalPages: entry.textbooks?.total_pages ?? null,
  durationMinutes: entry.duration_minutes ?? null,
})),
```

`add` の `textbookEntries` insert を更新（`duration_minutes` を追加）：

```typescript
const { error: entriesError } = await supabase.from('practice_session_textbooks').insert(
  input.textbookEntries.map((entry) => ({
    session_id: sessionId,
    textbook_id: entry.textbookId,
    current_page: entry.currentPage,
    duration_minutes: entry.durationMinutes ?? null,
  })),
);
```

`add` の `newSession` 構築の textbookEntries を更新：

```typescript
textbookEntries: input.textbookEntries.map((entry) => {
  const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
  return {
    textbookId: entry.textbookId,
    textbookTitle: tb?.title ?? '',
    currentPage: entry.currentPage,
    totalPages: tb?.totalPages ?? null,
    durationMinutes: entry.durationMinutes ?? null,
  };
}),
```

- [ ] **Step 2: store/**tests**/practice-log.test.ts の既存 mock データに duration_minutes: null を追加する**

`fetchAll` のモックデータ内 `practice_session_textbooks` の各エントリに追加：

```typescript
practice_session_textbooks: [
  {
    textbook_id: 'tb-1',
    current_page: 14,
    duration_minutes: null,  // 追加
    textbooks: { title: 'ローズ 32のエチュード', total_pages: 32 },
  },
],
```

`add` のモックデータと期待値にも `durationMinutes: null` を追加：

```typescript
// toMatchObject の期待値に追加
expect(sessions[0].textbookEntries[0]).toMatchObject({
  textbookId: 'tb-1',
  textbookTitle: 'ローズ 32のエチュード',
  currentPage: 14,
  totalPages: 32,
  durationMinutes: null, // 追加
});
```

- [ ] **Step 3: テストを実行してすべてパスすることを確認する**

```bash
npx jest store/__tests__/practice-log.test.ts
```

Expected: PASS (全テスト)

- [ ] **Step 4: コミットする**

```bash
git add store/practice-log.ts store/__tests__/practice-log.test.ts
git commit -m "feat: practice-log ストアの TextbookEntry に durationMinutes を追加"
```

---

## Task 6: フォームコンポーネント統合 + 統合テスト

**Files:**

- Modify: `components/practice-log-form.tsx`
- Create: `__tests__/integration/practice-log-form-timer.integration.test.tsx`

- [ ] **Step 1: 統合テストを書く**

```typescript
// __tests__/integration/practice-log-form-timer.integration.test.tsx
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { PracticeLogForm, type PracticeLogFormRef } from '@/components/practice-log-form';
import { useTimerStore } from '@/store/timer';
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

jest.mock('@/store/textbook-catalog', () => ({
  useTextbookCatalogStore: {
    getState: jest.fn().mockReturnValue({ textbooks: [] }),
    // selector hook として呼ばれる場合のデフォルト
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(jest.fn() as any),
  },
}));

// useTextbookCatalogStore をフック呼び出しでも使えるようにする
jest.mock('@/store/textbook-catalog', () => {
  const textbooks: never[] = [];
  const store = Object.assign(jest.fn((selector: (s: { textbooks: never[] }) => unknown) => selector({ textbooks })), {
    getState: jest.fn().mockReturnValue({ textbooks }),
  });
  return { useTextbookCatalogStore: store };
});

jest.mock('@/store/practice-log', () => ({
  usePracticeLogStore: jest.fn((selector: (s: { sessions: never[] }) => unknown) =>
    selector({ sessions: [] }),
  ),
}));

beforeEach(() => {
  useTimerStore.setState({ timers: {} });
});

it('計測開始 → 停止 でロングトーン分数フィールドが更新される', async () => {
  const t0 = 1_000_000;
  jest
    .spyOn(Date, 'now')
    .mockReturnValueOnce(t0)
    .mockReturnValueOnce(t0 + 90_000);

  renderWithProviders(<PracticeLogForm ref={{ current: null }} onSubmit={jest.fn()} />);

  fireEvent.press(screen.getByLabelText('ロングトーンの計測開始'));
  fireEvent.press(screen.getByLabelText('ロングトーンの停止'));

  await waitFor(() => {
    expect(screen.getByLabelText('ロングトーン')).toHaveProp('value', '2');
  });

  jest.restoreAllMocks();
});

it('手動時刻入力でタンギング分数フィールドが更新される', async () => {
  renderWithProviders(<PracticeLogForm ref={{ current: null }} onSubmit={jest.fn()} />);

  fireEvent.press(screen.getByLabelText('タンギングの時刻で入力'));
  fireEvent.changeText(screen.getByLabelText('タンギングの開始時刻'), '10:00');
  fireEvent.changeText(screen.getByLabelText('タンギングの終了時刻'), '10:15');
  fireEvent.press(screen.getByLabelText('タンギングの適用'));

  await waitFor(() => {
    expect(screen.getByLabelText('タンギング')).toHaveProp('value', '15');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
npx jest __tests__/integration/practice-log-form-timer.integration.test.tsx
```

Expected: FAIL（`getByLabelText('ロングトーンの計測開始')` が見つからない）

- [ ] **Step 3: practice-log-form.tsx にタイマー機能を統合する**

ファイル冒頭の import に追加：

```typescript
import { TimerControl } from '@/components/timer-control';
import { useTimerStore } from '@/store/timer';
```

`useForm` の destructure に `setValue` を追加：

```typescript
const {
  control,
  handleSubmit,
  watch,
  setValue,
  formState: { errors, isSubmitting },
} = useForm<PracticeLogInput>({ ... });
```

`resetAll` を取得：

```typescript
const resetAll = useTimerStore((s) => s.resetAll);
```

`submitForm` の定義を変更（保存後に resetAll を呼ぶ）：

```typescript
const submitForm = handleSubmit(async (data) => {
  await onSubmit(data);
  resetAll();
});
```

`useImperativeHandle` を変更（保存前に実行中タイマーを自動停止）：

```typescript
useImperativeHandle(ref, () => ({
  submit: () => {
    const timerState = useTimerStore.getState();
    if (timerState.timers['long_tone']?.status === 'running') {
      setValue('longToneMinutes', timerState.stop('long_tone'));
    }
    if (timerState.timers['tonguing']?.status === 'running') {
      setValue('tonguingMinutes', timerState.stop('tonguing'));
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
```

基礎練習セクションの BASIC_MENUS map を変更（TimerControl を追加）。現在の：

```tsx
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
          <Input ... />
          <FieldError message={errors[fieldName]?.message} />
        </YStack>
      )}
    />
  );
})}
```

を以下に置き換える：

```tsx
{
  BASIC_MENUS.map(({ type, label }) => {
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
  });
}
```

教本エントリカード内（ページ入力の下）に TimerControl と durationMinutes フィールドを追加：

```tsx
{/* 教本練習時間 */}
<TimerControl
  timerKey={`textbook-${field.id}`}
  label={`教本 ${index + 1}`}
  onStop={(minutes) =>
    setValue(`textbookEntries.${index}.durationMinutes`, minutes)
  }
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
```

- [ ] **Step 4: テストを実行してすべてパスすることを確認する**

```bash
npx jest __tests__/integration/practice-log-form-timer.integration.test.tsx
```

Expected: PASS (全テスト)

- [ ] **Step 5: 既存の practice-log-form 統合テストが壊れていないか確認する**

```bash
npx jest __tests__/integration/practice-log-form.integration.test.tsx
```

Expected: PASS (全テスト)

- [ ] **Step 6: コミットする**

```bash
git add components/practice-log-form.tsx __tests__/integration/practice-log-form-timer.integration.test.tsx
git commit -m "feat: 練習記録フォームにタイマー機能を統合"
```

---

## Task 7: 一覧画面に教本練習時間を表示

**Files:**

- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: 教本エントリ表示に durationMinutes を追加する**

`index.tsx` の教本エントリ描画部分を変更する。現在の：

```tsx
{
  item.textbookEntries.map((entry) => (
    <XStack key={entry.textbookId} gap="$2" items="center">
      <Paragraph fontSize="$2">{entry.textbookTitle}</Paragraph>
      <Paragraph fontSize="$2" color="$blue9" ml="auto">
        {`p.${entry.currentPage}`}
      </Paragraph>
    </XStack>
  ));
}
```

を以下に置き換える：

```tsx
{
  item.textbookEntries.map((entry) => (
    <XStack key={entry.textbookId} gap="$2" items="center">
      <Paragraph fontSize="$2">{entry.textbookTitle}</Paragraph>
      {entry.durationMinutes != null && (
        <Paragraph fontSize="$2" color="$color10">
          {`${entry.durationMinutes}分`}
        </Paragraph>
      )}
      <Paragraph fontSize="$2" color="$blue9" ml="auto">
        {`p.${entry.currentPage}`}
      </Paragraph>
    </XStack>
  ));
}
```

- [ ] **Step 2: 品質チェック 4 ステップを通す**

```bash
npm run lint
npm run format:check
npx tsc --noEmit
npm test
```

Expected: エラー 0 件・差分 0 件・型エラー 0 件・全テスト PASS

差分があれば `npm run lint:fix` / `npm run format` で修正して再実行。

- [ ] **Step 3: コミットする**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: 練習記録一覧に教本練習時間を表示"
```
