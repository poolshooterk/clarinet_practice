# レッスン録音機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 練習記録フォームの録音 UI を `RecordingSection` 共通コンポーネントとして抽出し、レッスン記録フォームにも同じ録音機能を追加する。

**Architecture:** 既存の `components/practice-log-form.tsx` に埋め込まれている録音ロジックを `components/form/recording-section.tsx` に移動し、練習フォームはそれを使うよう変更する。レッスンフォームは `onSubmit` に録音状態を追加引数として渡すパターンで録音に対応する（`forwardRef` は導入しない）。ストア・画面側も対応するよう順番に変更する。

**Tech Stack:** expo-av (~16.0.8), expo-file-system/legacy, React Hook Form, Zustand v5, Tamagui (`onlyAllowShorthands: true`), Jest + Testing Library

---

## ファイル構成

| 操作     | ファイル                                                        |
| -------- | --------------------------------------------------------------- |
| 新規作成 | `components/form/recording-section.tsx`                         |
| 新規作成 | `components/form/__tests__/recording-section.test.tsx`          |
| 変更     | `components/practice-log-form.tsx`                              |
| 変更     | `store/lesson-record.ts`                                        |
| 変更     | `store/__tests__/lesson-record.test.ts`                         |
| 変更     | `components/lesson-record-form.tsx`                             |
| 変更     | `__tests__/integration/lesson-record-form.integration.test.tsx` |
| 変更     | `app/lesson-record-form.tsx`                                    |
| 変更     | `app/(tabs)/lesson.tsx`                                         |

---

## Task 1: RecordingSection コンポーネント作成

**Files:**

- Create: `components/form/recording-section.tsx`
- Create: `components/form/__tests__/recording-section.test.tsx`

- [ ] **Step 1: テストファイルを作成する（失敗することを確認するため）**

```tsx
// components/form/__tests__/recording-section.test.tsx
import { fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { RecordingSection } from '@/components/form/recording-section';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('@/lib/recording', () => ({
  startRecording: jest.fn().mockResolvedValue({}),
  stopRecording: jest.fn().mockResolvedValue('file:///recordings/tmp.m4a'),
  createSound: jest.fn(),
}));

const mockRecording = () => jest.requireMock('@/lib/recording');

describe('RecordingSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('idle 状態: 録音を開始ボタンが表示される', () => {
    renderWithProviders(<RecordingSection onChange={jest.fn()} />);
    expect(screen.getByLabelText('録音を開始')).toBeTruthy();
  });

  it('web では何もレンダリングされない', () => {
    const originalOS = Platform.OS;
    (Platform as { OS: string }).OS = 'web';
    const { toJSON } = renderWithProviders(<RecordingSection onChange={jest.fn()} />);
    expect(toJSON()).toBeNull();
    (Platform as { OS: string }).OS = originalOS;
  });

  it('録音停止後に onChange が { tempUri, reRecordTriggered: false } で呼ばれる', async () => {
    const onChange = jest.fn();
    renderWithProviders(<RecordingSection onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('録音を開始'));
    await waitFor(() => {
      expect(screen.getByLabelText('録音を停止')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('録音を停止'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        tempUri: 'file:///recordings/tmp.m4a',
        reRecordTriggered: false,
      });
    });
  });

  it('再録音ボタン押下後に onChange が { tempUri: null, reRecordTriggered: true } で呼ばれる', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <RecordingSection onChange={onChange} existingRecordingUri="file:///recordings/lr-1.m4a" />,
    );

    fireEvent.press(screen.getByLabelText('再録音'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        tempUri: null,
        reRecordTriggered: true,
      });
    });
  });

  it('existingRecordingUri が渡されると recorded 状態で初期化される', () => {
    renderWithProviders(
      <RecordingSection onChange={jest.fn()} existingRecordingUri="file:///recordings/lr-1.m4a" />,
    );
    expect(screen.getByLabelText('再録音')).toBeTruthy();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest components/form/__tests__/recording-section --no-coverage
```

期待: `Cannot find module '@/components/form/recording-section'` 等のエラーで FAIL

- [ ] **Step 3: RecordingSection コンポーネントを実装する**

```tsx
// components/form/recording-section.tsx
import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { createSound, startRecording, stopRecording } from '@/lib/recording';

type RecordingState = 'idle' | 'recording' | 'recorded';

type Props = {
  existingRecordingUri?: string | null;
  onChange: (state: { tempUri: string | null; reRecordTriggered: boolean }) => void;
};

function RecordingSectionNative({ existingRecordingUri, onChange }: Props) {
  const [recState, setRecState] = useState<RecordingState>(() =>
    existingRecordingUri ? 'recorded' : 'idle',
  );
  const [tempUri, setTempUri] = useState<string | null>(existingRecordingUri ?? null);
  const activeRecordingRef = useRef<Audio.Recording | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [reRecordTriggered, setReRecordTriggered] = useState(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});
    };
  }, []);

  async function handleStartRecording() {
    try {
      const recording = await startRecording();
      activeRecordingRef.current = recording;
      setElapsed(0);
      setRecState('recording');
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      // パーミッション拒否など無視
    }
  }

  async function handleStopRecording() {
    if (!activeRecordingRef.current) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      const uri = await stopRecording(activeRecordingRef.current);
      activeRecordingRef.current = null;
      setTempUri(uri);
      setRecState('recorded');
      onChangeRef.current({ tempUri: uri, reRecordTriggered });
    } catch {
      activeRecordingRef.current = null;
      setRecState('idle');
    }
  }

  async function handlePlayPause() {
    if (!tempUri) return;
    if (soundRef.current && isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      return;
    }
    if (!soundRef.current) {
      const sound = await createSound(tempUri);
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        setPosition(status.positionMillis);
        setDuration(status.durationMillis ?? 0);
        if (status.didJustFinish) {
          setIsPlaying(false);
          setPosition(0);
          sound.setPositionAsync(0).catch(() => {});
        }
      });
    }
    await soundRef.current.playAsync();
    setIsPlaying(true);
  }

  async function handleReRecord() {
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setTempUri(null);
    setRecState('idle');
    setReRecordTriggered(true);
    onChangeRef.current({ tempUri: null, reRecordTriggered: true });
  }

  function formatSeconds(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function formatMs(ms: number): string {
    return formatSeconds(Math.floor(ms / 1000));
  }

  return (
    <YStack
      gap="$2"
      p="$3"
      bg="$color1"
      rounded="$3"
      borderWidth={1}
      borderColor={recState === 'recording' ? '$red8' : '$borderColor'}
    >
      <Paragraph fontSize="$2" color="$color10">
        録音
      </Paragraph>

      {recState === 'idle' && (
        <Pressable onPress={handleStartRecording} aria-label="録音を開始">
          <XStack gap="$3" items="center">
            <YStack
              width={44}
              height={44}
              rounded="$10"
              bg="$color2"
              borderWidth={2}
              borderColor="$red9"
              items="center"
              justify="center"
            >
              <YStack width={16} height={16} rounded="$10" bg="$red9" />
            </YStack>
            <YStack>
              <Paragraph fontWeight="500">録音を開始</Paragraph>
              <Paragraph fontSize="$2" color="$color10">
                タップして練習を録音する
              </Paragraph>
            </YStack>
          </XStack>
        </Pressable>
      )}

      {recState === 'recording' && (
        <YStack gap="$3">
          <XStack gap="$3" items="center">
            <YStack
              width={44}
              height={44}
              rounded="$10"
              bg="$red2"
              borderWidth={2}
              borderColor="$red9"
              items="center"
              justify="center"
            >
              <YStack width={14} height={14} rounded="$10" bg="$red9" />
            </YStack>
            <YStack>
              <Paragraph color="$red9" fontWeight="600">
                録音中…
              </Paragraph>
              <Paragraph fontSize="$5" fontWeight="700">
                {formatSeconds(elapsed)}
              </Paragraph>
            </YStack>
          </XStack>
          <Pressable onPress={handleStopRecording} aria-label="録音を停止">
            <YStack
              p="$2"
              rounded="$2"
              bg="$red2"
              borderWidth={1}
              borderColor="$red8"
              items="center"
            >
              <Paragraph color="$red9" fontWeight="600">
                ■ 停止
              </Paragraph>
            </YStack>
          </Pressable>
        </YStack>
      )}

      {recState === 'recorded' && (
        <YStack gap="$2">
          <XStack gap="$3" items="center">
            <Pressable onPress={handlePlayPause} aria-label={isPlaying ? '一時停止' : '再生'}>
              <YStack
                width={40}
                height={40}
                rounded="$10"
                bg="$blue2"
                borderWidth={2}
                borderColor="$blue9"
                items="center"
                justify="center"
              >
                <Paragraph color="$blue9" fontSize="$3">
                  {isPlaying ? '⏸' : '▶'}
                </Paragraph>
              </YStack>
            </Pressable>
            <YStack flex={1} gap="$1">
              <YStack height={4} bg="$color3" rounded="$1" overflow="hidden">
                <YStack
                  height={4}
                  bg="$blue9"
                  rounded="$1"
                  style={{
                    width: duration > 0 ? `${Math.round((position / duration) * 100)}%` : '0%',
                  }}
                />
              </YStack>
              <XStack justify="space-between">
                <Paragraph fontSize="$1" color="$color10">
                  {formatMs(position)}
                </Paragraph>
                <Paragraph fontSize="$1" color="$color11" fontWeight="600">
                  {formatMs(duration)}
                </Paragraph>
              </XStack>
            </YStack>
          </XStack>
          <YStack borderTopWidth={1} borderTopColor="$borderColor" pt="$2">
            <Pressable onPress={handleReRecord} aria-label="再録音">
              <XStack gap="$2" items="center">
                <YStack width={10} height={10} rounded="$10" bg="$red7" />
                <Paragraph fontSize="$2" color="$color10">
                  再録音
                </Paragraph>
              </XStack>
            </Pressable>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}

export function RecordingSection(props: Props) {
  if (Platform.OS === 'web') return null;
  return <RecordingSectionNative {...props} />;
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest components/form/__tests__/recording-section --no-coverage
```

期待: 5 tests passed

- [ ] **Step 5: 品質チェック**

```bash
npm run lint && npm run format:check && npx tsc --noEmit
```

期待: エラー 0 件

- [ ] **Step 6: コミット**

```bash
git add components/form/recording-section.tsx components/form/__tests__/recording-section.test.tsx
git commit -m "feat: RecordingSection 共通コンポーネントを追加"
```

---

## Task 2: practice-log-form を RecordingSection に差し替え

**Files:**

- Modify: `components/practice-log-form.tsx`

このタスクは既存の録音ロジックを RecordingSection に置き換えるリファクタリング。`useImperativeHandle` のシグネチャを維持するため既存の統合テストはそのまま通る。

- [ ] **Step 1: 変更後も統合テストが通ることをまず確認する（変更前のベースライン）**

```bash
npx jest __tests__/integration/practice-log-form --no-coverage 2>&1 | tail -5
```

期待: 現状のテストがすべてパスしていることを確認

- [ ] **Step 2: practice-log-form.tsx を変更する**

`components/practice-log-form.tsx` の先頭インポートを以下に変更する（`Audio` と `createSound/startRecording/stopRecording` を削除し `RecordingSection` を追加）:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
  useFieldArray,
  useForm,
  type UseFormSetValue,
  useWatch,
} from 'react-hook-form';
import { Platform, Pressable, ScrollView } from 'react-native';
import { Button, Input, Paragraph, Select, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { RecordingSection } from '@/components/form/recording-section';
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
```

- [ ] **Step 3: 録音状態変数・cleanup useEffect・ハンドラ関数を削除して recStateRef に置き換える**

現在の録音関連コード（ファイル内で `// type RecordingState` から始まるブロック〜 `function formatMs` まで）を以下に差し替える:

```tsx
const recStateRef = useRef({ tempUri: null as string | null, reRecordTriggered: false });
```

- [ ] **Step 4: useImperativeHandle の録音部分を recStateRef 参照に変更する**

現在:

```tsx
getTempRecordingUri: () => tempUri,
shouldDeleteExistingRecording: () => reRecordTriggered && tempUri === null,
```

変更後:

```tsx
getTempRecordingUri: () => recStateRef.current.tempUri,
shouldDeleteExistingRecording: () =>
  recStateRef.current.reRecordTriggered && recStateRef.current.tempUri === null,
```

- [ ] **Step 5: JSX の録音セクションを RecordingSection に置き換える**

現在の `{/* 録音 */}` ブロック（`{Platform.OS !== 'web' && ( ... )}` の録音 YStack 全体）を以下に差し替える:

```tsx
{
  /* 録音 */
}
<RecordingSection
  existingRecordingUri={existingRecordingUri}
  onChange={(s) => {
    recStateRef.current = s;
  }}
/>;
```

- [ ] **Step 6: 統合テストが引き続き通ることを確認する**

```bash
npx jest __tests__/integration/practice-log-form --no-coverage
```

期待: 変更前と同じテストがすべてパス

- [ ] **Step 7: 品質チェック**

```bash
npm run lint && npm run format:check && npx tsc --noEmit
```

期待: エラー 0 件

- [ ] **Step 8: コミット**

```bash
git add components/practice-log-form.tsx
git commit -m "refactor: practice-log-form の録音ロジックを RecordingSection に移行"
```

---

## Task 3: store/lesson-record.ts に録音対応を追加

**Files:**

- Modify: `store/lesson-record.ts`
- Modify: `store/__tests__/lesson-record.test.ts`

- [ ] **Step 1: テストを先に追記して失敗することを確認する**

`store/__tests__/lesson-record.test.ts` の `import` 冒頭に録音モックを追加:

```typescript
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

const mockFrom = () => jest.requireMock('@/lib/supabase').supabase.from as jest.Mock;
const mockGetUser = () => jest.requireMock('@/lib/supabase').supabase.auth.getUser as jest.Mock;
const mockRecording = () => jest.requireMock('@/lib/recording');
```

`describe('useLessonRecordStore', ...)` 内の `beforeEach` を以下に更新:

```typescript
beforeEach(async () => {
  await AsyncStorage.clear();
  useLessonRecordStore.setState({ records: [], loading: false });
  mockGetUser().mockResolvedValue({ data: { user: { id: 'user-1' } } });
  jest.clearAllMocks();
  mockGetUser().mockResolvedValue({ data: { user: { id: 'user-1' } } });
});
```

`describe` ブロックの末尾（既存テストの後）に録音テストを追加:

```typescript
it('add: tempRecordingUri あり → finalizeRecording がレコードIDで呼ばれる', async () => {
  mockFrom().mockReturnValueOnce({
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'lr-new',
            held_at: '2026-05-15T05:00:00.000Z',
            advice: null,
            notes: null,
          },
          error: null,
        }),
      }),
    }),
  });
  await useLessonRecordStore
    .getState()
    .add(
      { date: '2026-05-15', time: '14:00', advice: '', notes: '' },
      'file:///data/recordings/tmp.m4a',
    );
  expect(mockRecording().finalizeRecording).toHaveBeenCalledWith('lr-new');
});

it('add: tempRecordingUri なし → finalizeRecording は呼ばれない', async () => {
  mockFrom().mockReturnValueOnce({
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'lr-new',
            held_at: '2026-05-15T05:00:00.000Z',
            advice: null,
            notes: null,
          },
          error: null,
        }),
      }),
    }),
  });
  await useLessonRecordStore
    .getState()
    .add({ date: '2026-05-15', time: '14:00', advice: '', notes: '' });
  expect(mockRecording().finalizeRecording).not.toHaveBeenCalled();
});

it('update: tempRecordingUri あり → finalizeRecording がレコードIDで呼ばれる', async () => {
  useLessonRecordStore.setState({
    records: [{ id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: null, notes: null }],
  });
  mockFrom().mockReturnValueOnce({
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
  });
  await useLessonRecordStore
    .getState()
    .update(
      'lr-1',
      { date: '2026-05-20', time: '10:00', advice: '', notes: '' },
      'file:///data/recordings/tmp.m4a',
    );
  expect(mockRecording().finalizeRecording).toHaveBeenCalledWith('lr-1');
});

it('update: tempRecordingUri なし → finalizeRecording は呼ばれない', async () => {
  useLessonRecordStore.setState({
    records: [{ id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: null, notes: null }],
  });
  mockFrom().mockReturnValueOnce({
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
  });
  await useLessonRecordStore
    .getState()
    .update('lr-1', { date: '2026-05-20', time: '10:00', advice: '', notes: '' });
  expect(mockRecording().finalizeRecording).not.toHaveBeenCalled();
});

it('remove: deleteRecording がレコードIDで呼ばれる', async () => {
  useLessonRecordStore.setState({
    records: [{ id: 'lr-1', heldAt: '2026-05-15T05:00:00.000Z', advice: null, notes: null }],
  });
  mockFrom().mockReturnValueOnce({
    delete: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
  });
  await useLessonRecordStore.getState().remove('lr-1');
  expect(mockRecording().deleteRecording).toHaveBeenCalledWith('lr-1');
});

it('add: finalizeRecording が失敗しても record は保存される', async () => {
  mockFrom().mockReturnValueOnce({
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'lr-new',
            held_at: '2026-05-15T05:00:00.000Z',
            advice: null,
            notes: null,
          },
          error: null,
        }),
      }),
    }),
  });
  mockRecording().finalizeRecording.mockRejectedValueOnce(new Error('disk full'));
  await useLessonRecordStore
    .getState()
    .add(
      { date: '2026-05-15', time: '14:00', advice: '', notes: '' },
      'file:///data/recordings/tmp.m4a',
    );
  expect(useLessonRecordStore.getState().records).toHaveLength(1);
  expect(useLessonRecordStore.getState().records[0].id).toBe('lr-new');
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest store/__tests__/lesson-record --no-coverage 2>&1 | tail -20
```

期待: add/update/remove 録音テストが FAIL（まだ実装していないため）

- [ ] **Step 3: store/lesson-record.ts を録音対応に変更する**

```typescript
import { create } from 'zustand';

import { combineDateTime, type LessonRecordInput } from '@/forms/lesson-record';
import { deleteRecording, finalizeRecording } from '@/lib/recording';
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
    if (tempRecordingUri) {
      try {
        await finalizeRecording(row.id);
      } catch {
        // 録音失敗でも記録は保存
      }
    }
    set({
      records: [
        { id: row.id, heldAt: row.held_at, advice: row.advice, notes: row.notes },
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

- [ ] **Step 4: テストがすべて通ることを確認する**

```bash
npx jest store/__tests__/lesson-record --no-coverage
```

期待: 全テスト passed

- [ ] **Step 5: 品質チェック**

```bash
npm run lint && npm run format:check && npx tsc --noEmit
```

期待: エラー 0 件

- [ ] **Step 6: コミット**

```bash
git add store/lesson-record.ts store/__tests__/lesson-record.test.ts
git commit -m "feat: lesson-record ストアに録音対応を追加"
```

---

## Task 4: lesson-record-form コンポーネントに RecordingSection を追加

**Files:**

- Modify: `components/lesson-record-form.tsx`
- Modify: `__tests__/integration/lesson-record-form.integration.test.tsx`

- [ ] **Step 1: 統合テストに録音モックと引数検証を追加する**

`__tests__/integration/lesson-record-form.integration.test.tsx` を以下に更新:

```tsx
import { fireEvent, waitFor } from '@testing-library/react-native';

import { LessonRecordForm } from '@/components/lesson-record-form';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('@/lib/recording', () => ({
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  createSound: jest.fn(),
}));

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
    expect(onSubmit.mock.calls[0][1]).toBeNull();
    expect(onSubmit.mock.calls[0][2]).toBe(false);
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
    expect(onSubmit.mock.calls[0][1]).toBeNull();
    expect(onSubmit.mock.calls[0][2]).toBe(false);
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

- [ ] **Step 2: テストが（まだ）失敗することを確認する**

```bash
npx jest __tests__/integration/lesson-record-form --no-coverage 2>&1 | tail -20
```

期待: `onSubmit.mock.calls[0][1]` / `[2]` の assertion で FAIL

- [ ] **Step 3: components/lesson-record-form.tsx を録音対応に変更する**

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { Button, Input, Paragraph, TextArea, YStack } from 'tamagui';

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

const defaultOnSubmit = (_values: LessonRecordInput) => {
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

- [ ] **Step 4: 統合テストがすべて通ることを確認する**

```bash
npx jest __tests__/integration/lesson-record-form --no-coverage
```

期待: 全テスト passed

- [ ] **Step 5: 品質チェック**

```bash
npm run lint && npm run format:check && npx tsc --noEmit
```

期待: エラー 0 件

- [ ] **Step 6: コミット**

```bash
git add components/lesson-record-form.tsx __tests__/integration/lesson-record-form.integration.test.tsx
git commit -m "feat: lesson-record-form に RecordingSection を追加"
```

---

## Task 5: app/lesson-record-form.tsx を録音対応に変更

**Files:**

- Modify: `app/lesson-record-form.tsx`

- [ ] **Step 1: app/lesson-record-form.tsx を更新する**

```tsx
import * as FileSystem from 'expo-file-system/legacy';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { LessonRecordForm } from '@/components/lesson-record-form';
import { type LessonRecordInput, splitHeldAt } from '@/forms/lesson-record';
import { deleteRecording, getRecordingUri } from '@/lib/recording';
import { useLessonRecordStore } from '@/store/lesson-record';

export default function LessonRecordFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const records = useLessonRecordStore((s) => s.records);
  const add = useLessonRecordStore((s) => s.add);
  const update = useLessonRecordStore((s) => s.update);
  const remove = useLessonRecordStore((s) => s.remove);

  const existing = id ? records.find((r) => r.id === id) : undefined;

  const [existingRecordingUri, setExistingRecordingUri] = useState<string | null>(null);

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

- [ ] **Step 2: 品質チェック**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

期待: エラー 0 件、全テスト passed

- [ ] **Step 3: コミット**

```bash
git add app/lesson-record-form.tsx
git commit -m "feat: app/lesson-record-form に録音 props を渡す"
```

---

## Task 6: app/(tabs)/lesson.tsx に録音バッジを追加

**Files:**

- Modify: `app/(tabs)/lesson.tsx`

- [ ] **Step 1: app/(tabs)/lesson.tsx を更新する**

```tsx
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { formatHeldAt } from '@/forms/lesson-record';
import { loadRecordedIds } from '@/lib/recording';
import { useLessonRecordStore } from '@/store/lesson-record';

export default function LessonScreen() {
  const records = useLessonRecordStore((s) => s.records);
  const loading = useLessonRecordStore((s) => s.loading);
  const fetchAll = useLessonRecordStore((s) => s.fetchAll);
  const remove = useLessonRecordStore((s) => s.remove);
  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      loadRecordedIds().then(setRecordedIds);
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
              <XStack items="center" gap="$2">
                <Paragraph fontWeight="bold">{formatHeldAt(item.heldAt)}</Paragraph>
                {recordedIds.has(item.id) && (
                  <Paragraph
                    fontSize="$1"
                    color="$blue9"
                    bg="$blue3"
                    px="$1"
                    rounded="$1"
                    borderWidth={1}
                    borderColor="$blue7"
                  >
                    ♪
                  </Paragraph>
                )}
              </XStack>
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

- [ ] **Step 2: 全品質チェック**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

期待: エラー 0 件、全テスト passed

- [ ] **Step 3: コミット**

```bash
git add app/\(tabs\)/lesson.tsx
git commit -m "feat: レッスン一覧に録音バッジ (♪) を追加"
```

---

## 実装完了後の確認

全タスク完了後、以下を実行して問題がないことを確認する:

```bash
npm test
```

期待: 新規テスト (recording-section + lesson-record ストア録音テスト) を含む全テストが passed
