# 練習録音機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 練習フォームにリアルタイム録音・再生セクションを追加し、録音をデバイスローカルにセッションIDで管理する

**Architecture:** expo-av で録音・再生を実装。録音ファイルは `{documentDirectory}recordings/{sessionId}.m4a` に保存（新規セッション作成時は `tmp.m4a` → `{sessionId}.m4a` にリネーム）。DB変更なし。

**Tech Stack:** expo-av, expo-file-system（導入済み）, React Native, Tamagui, Zustand, TypeScript

---

## ファイル構成

| パス                                   | 操作     | 内容                                                                        |
| -------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `lib/recording.ts`                     | 新規作成 | 録音・再生・ファイル操作ヘルパー                                            |
| `lib/__tests__/recording.test.ts`      | 新規作成 | recording.ts の単体テスト                                                   |
| `store/practice-log.ts`                | 変更     | add/update に tempRecordingUri 引数追加、remove で deleteRecording 呼び出し |
| `store/__tests__/practice-log.test.ts` | 変更     | recording 連携テスト追加                                                    |
| `components/practice-log-form.tsx`     | 変更     | 録音セクション追加、PracticeLogFormRef に getTempRecordingUri 追加          |
| `app/practice-log-form.tsx`            | 変更     | 録音URI取得・ストアへの引き渡し                                             |
| `app/(tabs)/index.tsx`                 | 変更     | useFocusEffect で ♪ バッジ管理                                              |
| `app.json`                             | 変更     | expo-av プラグイン追加                                                      |

---

### Task 1: expo-av のインストールと app.json 設定

**Files:**

- Modify: `app.json`
- Modify: `package.json` / `package-lock.json`（npm が自動更新）

- [ ] **Step 1: expo-av をインストール**

```bash
npx expo install expo-av
```

期待される出力: `+ expo-av@...` が `package.json` に追加される

- [ ] **Step 2: app.json を更新**

`app.json` を以下の内容に置き換える（`ios.infoPlist` の追加と `plugins` への expo-av エントリ追加）:

```json
{
  "expo": {
    "name": "expo-template",
    "slug": "expo-template",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "expotemplate",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "NSMicrophoneUsageDescription": "練習の録音に使用します"
      }
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ],
      "@react-native-community/datetimepicker",
      [
        "expo-av",
        {
          "microphonePermission": "練習の録音に使用します"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    }
  }
}
```

- [ ] **Step 3: 品質チェック（lint のみ）**

```bash
npm run lint
```

Expected: 0 errors（JS ファイルの変更なし）

- [ ] **Step 4: コミット**

```bash
git add app.json package.json package-lock.json
git commit -m "feat: expo-av をインストールしマイクパーミッションを設定"
```

---

### Task 2: lib/recording.ts の作成（TDD）

**Files:**

- Create: `lib/recording.ts`
- Create: `lib/__tests__/recording.test.ts`

- [ ] **Step 1: テストファイルを新規作成**

`lib/__tests__/recording.test.ts`:

```typescript
import * as FileSystem from 'expo-file-system';

import {
  createSound,
  deleteRecording,
  finalizeRecording,
  getRecordingUri,
  loadRecordedIds,
  startRecording,
  stopRecording,
} from '@/lib/recording';

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Recording: {
      createAsync: jest.fn(),
    },
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///data/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn(),
}));

const mockAudio = () => jest.requireMock('expo-av').Audio;
const mockFS = () => jest.requireMock('expo-file-system') as jest.Mocked<typeof FileSystem>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('startRecording', () => {
  it('マイク権限を要求し録音オブジェクトを返す', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({ exists: true } as FileSystem.FileInfo);
    const mockRecording = { stopAndUnloadAsync: jest.fn(), getURI: jest.fn() };
    mockAudio().Recording.createAsync.mockResolvedValueOnce({ recording: mockRecording });

    const recording = await startRecording();

    expect(mockAudio().requestPermissionsAsync).toHaveBeenCalled();
    expect(mockAudio().setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    expect(recording).toBe(mockRecording);
  });

  it('recordings/ ディレクトリが存在しない場合は作成する', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({ exists: false } as FileSystem.FileInfo);
    const mockRecording = {};
    mockAudio().Recording.createAsync.mockResolvedValueOnce({ recording: mockRecording });

    await startRecording();

    expect(mockFS().makeDirectoryAsync).toHaveBeenCalledWith('file:///data/recordings/', {
      intermediates: true,
    });
  });
});

describe('stopRecording', () => {
  it('録音を停止し tmp.m4a に移動して URI を返す', async () => {
    const mockRecording = {
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue('file:///tmp/some.caf'),
    };

    const uri = await stopRecording(mockRecording as never);

    expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalled();
    expect(mockAudio().setAudioModeAsync).toHaveBeenCalledWith({ allowsRecordingIOS: false });
    expect(mockFS().moveAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/some.caf',
      to: 'file:///data/recordings/tmp.m4a',
    });
    expect(uri).toBe('file:///data/recordings/tmp.m4a');
  });

  it('URI が null のとき例外を投げる', async () => {
    const mockRecording = {
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue(null),
    };

    await expect(stopRecording(mockRecording as never)).rejects.toThrow(
      '録音ファイルURIが取得できませんでした',
    );
  });
});

describe('finalizeRecording', () => {
  it('tmp.m4a を {sessionId}.m4a にリネームする', async () => {
    await finalizeRecording('session-abc');

    expect(mockFS().moveAsync).toHaveBeenCalledWith({
      from: 'file:///data/recordings/tmp.m4a',
      to: 'file:///data/recordings/session-abc.m4a',
    });
  });
});

describe('deleteRecording', () => {
  it('ファイルが存在する場合は削除する', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({ exists: true } as FileSystem.FileInfo);

    await deleteRecording('session-abc');

    expect(mockFS().deleteAsync).toHaveBeenCalledWith('file:///data/recordings/session-abc.m4a');
  });

  it('ファイルが存在しない場合はスキップする', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({ exists: false } as FileSystem.FileInfo);

    await deleteRecording('session-abc');

    expect(mockFS().deleteAsync).not.toHaveBeenCalled();
  });
});

describe('getRecordingUri', () => {
  it('ファイルパスを返す（存在確認なし）', () => {
    expect(getRecordingUri('session-abc')).toBe('file:///data/recordings/session-abc.m4a');
  });
});

describe('loadRecordedIds', () => {
  it('ディレクトリが存在しない場合は空の Set を返す', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({ exists: false } as FileSystem.FileInfo);

    const ids = await loadRecordedIds();

    expect(ids.size).toBe(0);
  });

  it('.m4a ファイルから sessionId を抽出し tmp と非 m4a は除外する', async () => {
    mockFS().getInfoAsync.mockResolvedValueOnce({ exists: true } as FileSystem.FileInfo);
    mockFS().readDirectoryAsync.mockResolvedValueOnce([
      'session-abc.m4a',
      'session-def.m4a',
      'tmp.m4a',
      'other.txt',
    ]);

    const ids = await loadRecordedIds();

    expect(ids).toEqual(new Set(['session-abc', 'session-def']));
  });
});

describe('createSound', () => {
  it('Sound オブジェクトを返す', async () => {
    const mockSound = { playAsync: jest.fn() };
    mockAudio().Sound.createAsync.mockResolvedValueOnce({ sound: mockSound });

    const sound = await createSound('file:///data/recordings/session-abc.m4a');

    expect(mockAudio().setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
    expect(mockAudio().Sound.createAsync).toHaveBeenCalledWith({
      uri: 'file:///data/recordings/session-abc.m4a',
    });
    expect(sound).toBe(mockSound);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest lib/__tests__/recording.test.ts
```

Expected: FAIL（`Cannot find module '@/lib/recording'`）

- [ ] **Step 3: lib/recording.ts を実装**

`lib/recording.ts` を新規作成する:

```typescript
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings/`;
const TMP_PATH = `${RECORDINGS_DIR}tmp.m4a`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
}

export async function startRecording(): Promise<Audio.Recording> {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  await ensureDir();
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );
  return recording;
}

export async function stopRecording(recording: Audio.Recording): Promise<string> {
  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  const uri = recording.getURI();
  if (!uri) throw new Error('録音ファイルURIが取得できませんでした');
  await FileSystem.moveAsync({ from: uri, to: TMP_PATH });
  return TMP_PATH;
}

export async function finalizeRecording(sessionId: string): Promise<void> {
  await FileSystem.moveAsync({
    from: TMP_PATH,
    to: `${RECORDINGS_DIR}${sessionId}.m4a`,
  });
}

export async function deleteRecording(sessionId: string): Promise<void> {
  const uri = `${RECORDINGS_DIR}${sessionId}.m4a`;
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri);
  }
}

export function getRecordingUri(sessionId: string): string {
  return `${RECORDINGS_DIR}${sessionId}.m4a`;
}

export async function createSound(uri: string): Promise<Audio.Sound> {
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync({ uri });
  return sound;
}

export async function loadRecordedIds(): Promise<Set<string>> {
  const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!info.exists) return new Set();
  const files = await FileSystem.readDirectoryAsync(RECORDINGS_DIR);
  return new Set(
    files.filter((f) => f.endsWith('.m4a') && f !== 'tmp.m4a').map((f) => f.slice(0, -4)),
  );
}
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
npx jest lib/__tests__/recording.test.ts
```

Expected: PASS

- [ ] **Step 5: 品質チェック 4 ステップ**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

Expected: 全ステップ 0 エラー

- [ ] **Step 6: コミット**

```bash
git add lib/recording.ts lib/__tests__/recording.test.ts
git commit -m "feat: lib/recording.ts を追加（録音・再生・ファイル操作ヘルパー）"
```

---

### Task 3: store/practice-log.ts の更新（TDD）

**Files:**

- Modify: `store/practice-log.ts`
- Modify: `store/__tests__/practice-log.test.ts`

- [ ] **Step 1: テストを追加**

`store/__tests__/practice-log.test.ts` の先頭にある既存の `jest.mock` 群（`jest.mock('@/store/textbook-progress', ...)` の直後）に以下のモックを追加する:

```typescript
jest.mock('@/lib/recording', () => ({
  finalizeRecording: jest.fn().mockResolvedValue(undefined),
  deleteRecording: jest.fn().mockResolvedValue(undefined),
}));

const mockRecording = () => jest.requireMock('@/lib/recording');
```

次に、`describe('usePracticeLogStore', ...)` ブロックの末尾に以下のテストを追加する:

```typescript
it('add: tempRecordingUri あり → finalizeRecording がセッションIDで呼ばれる', async () => {
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

  await usePracticeLogStore.getState().add(
    {
      practicedAt: '2026-05-19',
      longToneMinutes: undefined,
      tonguingMinutes: undefined,
      tonguingTempoBpms: [],
      otherMinutes: undefined,
      otherMemo: '',
      memo: '',
      textbookEntries: [],
    },
    'file:///data/recordings/tmp.m4a',
  );

  expect(mockRecording().finalizeRecording).toHaveBeenCalledWith('new-session');
});

it('add: tempRecordingUri なし → finalizeRecording は呼ばれない', async () => {
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
    practicedAt: '2026-05-19',
    longToneMinutes: undefined,
    tonguingMinutes: undefined,
    tonguingTempoBpms: [],
    otherMinutes: undefined,
    otherMemo: '',
    memo: '',
    textbookEntries: [],
  });

  expect(mockRecording().finalizeRecording).not.toHaveBeenCalled();
});

it('update: tempRecordingUri あり → finalizeRecording がセッションIDで呼ばれる', async () => {
  mockSupabase()
    .from.mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    })
    .mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    })
    .mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

  await usePracticeLogStore.getState().update(
    'session-abc',
    {
      practicedAt: '2026-05-19',
      longToneMinutes: undefined,
      tonguingMinutes: undefined,
      tonguingTempoBpms: [],
      otherMinutes: undefined,
      otherMemo: '',
      memo: '',
      textbookEntries: [],
    },
    'file:///data/recordings/tmp.m4a',
  );

  expect(mockRecording().finalizeRecording).toHaveBeenCalledWith('session-abc');
});

it('remove: deleteRecording がセッションIDで呼ばれる', async () => {
  usePracticeLogStore.setState({
    sessions: [
      {
        id: 'session-abc',
        practicedAt: '2026-05-19',
        durationMinutes: null,
        otherMinutes: null,
        otherMemo: null,
        totalMinutes: null,
        memo: null,
        textbookEntries: [],
        basicMenuEntries: [],
      },
    ],
  });
  mockSupabase().from.mockReturnValue({
    delete: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
  });

  await usePracticeLogStore.getState().remove('session-abc');

  expect(mockRecording().deleteRecording).toHaveBeenCalledWith('session-abc');
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest store/__tests__/practice-log.test.ts
```

Expected: FAIL（`add` の引数シグネチャ不一致など）

- [ ] **Step 3: store/practice-log.ts を更新**

**3a. インポートを追加**（既存の import 群の末尾に追加）:

```typescript
import { deleteRecording, finalizeRecording } from '@/lib/recording';
```

**3b. `PracticeLogState` の `add` / `update` シグネチャを変更**:

```typescript
type PracticeLogState = {
  sessions: PracticeSession[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: PracticeLogInput, tempRecordingUri?: string | null) => Promise<void>;
  update: (id: string, input: PracticeLogInput, tempRecordingUri?: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
};
```

**3c. `add` アクションのシグネチャを変更し、`finalizeRecording` 呼び出しを追加**:

```typescript
  add: async (input: PracticeLogInput, tempRecordingUri?: string | null) => {
```

`add` 内の最後の `set({ sessions: [newSession, ...get().sessions] })` 直前に追加:

```typescript
if (tempRecordingUri) {
  await finalizeRecording(sessionId);
}
set({ sessions: [newSession, ...get().sessions] });
```

**3d. `update` アクションのシグネチャを変更し、`finalizeRecording` 呼び出しを追加**:

```typescript
  update: async (id: string, input: PracticeLogInput, tempRecordingUri?: string | null) => {
```

`update` 内の最後の `set({...})` 直前に追加:

```typescript
if (tempRecordingUri) {
  await finalizeRecording(id);
}
```

**3e. `remove` アクションに `deleteRecording` を追加**:

変更前:

```typescript
  remove: async (id: string) => {
    const { error } = await supabase.from('practice_sessions').delete().eq('id', id);
    if (error) return;
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  },
```

変更後:

```typescript
  remove: async (id: string) => {
    const { error } = await supabase.from('practice_sessions').delete().eq('id', id);
    if (error) return;
    await deleteRecording(id);
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  },
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
npx jest store/__tests__/practice-log.test.ts
```

Expected: PASS

- [ ] **Step 5: 品質チェック 4 ステップ**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

Expected: 全ステップ 0 エラー

- [ ] **Step 6: コミット**

```bash
git add store/practice-log.ts store/__tests__/practice-log.test.ts
git commit -m "feat: practice-log ストアに録音ファイル連携を追加"
```

---

### Task 4: components/practice-log-form.tsx に録音セクションを追加

**Files:**

- Modify: `components/practice-log-form.tsx`

- [ ] **Step 1: インポートを更新**

変更前:

```typescript
import { forwardRef, useImperativeHandle, useState } from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
  useFieldArray,
  useForm,
  type UseFormSetValue,
  useWatch,
} from 'react-hook-form';
import { Platform, ScrollView } from 'react-native';
```

変更後:

```typescript
import { Audio } from 'expo-av';
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
```

`@/lib/recording` インポートを既存の `@/` imports の中に追加する:

```typescript
import { createSound, startRecording, stopRecording } from '@/lib/recording';
```

- [ ] **Step 2: Props と Ref 型を更新**

変更前:

```typescript
type Props = {
  onSubmit: (data: PracticeLogInput) => void | Promise<void>;
  initialValues?: PracticeLogInput;
};

export type PracticeLogFormRef = {
  submit: () => void;
};
```

変更後:

```typescript
type Props = {
  onSubmit: (data: PracticeLogInput) => void | Promise<void>;
  initialValues?: PracticeLogInput;
  existingRecordingUri?: string | null;
};

export type PracticeLogFormRef = {
  submit: () => void;
  getTempRecordingUri: () => string | null;
};
```

- [ ] **Step 3: forwardRef の引数に existingRecordingUri を追加**

変更前:

```typescript
export const PracticeLogForm = forwardRef<PracticeLogFormRef, Props>(function PracticeLogForm(
  { onSubmit, initialValues },
  ref,
) {
```

変更後:

```typescript
export const PracticeLogForm = forwardRef<PracticeLogFormRef, Props>(function PracticeLogForm(
  { onSubmit, initialValues, existingRecordingUri },
  ref,
) {
```

- [ ] **Step 4: 録音ステート・ロジックをコンポーネント内に追加**

既存の `const [showPicker, setShowPicker] = useState(false);` の直後に以下を追加する:

```typescript
type RecordingState = 'idle' | 'recording' | 'recorded';
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
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatMs(ms: number): string {
  return formatSeconds(Math.floor(ms / 1000));
}
```

- [ ] **Step 5: useImperativeHandle に getTempRecordingUri を追加**

変更前:

```typescript
  useImperativeHandle(ref, () => ({
    submit: () => {
      ...（既存コード）...
      submitForm();
    },
  }));
```

変更後（`submitForm();` の後に `,` を追加し `getTempRecordingUri` を追記）:

```typescript
  useImperativeHandle(ref, () => ({
    submit: () => {
      ...（既存コード）...
      submitForm();
    },
    getTempRecordingUri: () => tempUri,
  }));
```

- [ ] **Step 6: 録音セクション UI を ScrollView 内の先頭に追加**

`<ScrollView>` 内の `<YStack gap="$4" p="$4">` の直後、`{/* 日付 */}` コメントの直前に挿入する:

```typescript
        {/* 録音 */}
        {Platform.OS !== 'web' && (
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
                    w={44}
                    h={44}
                    rounded="$10"
                    bg="$color2"
                    borderWidth={2}
                    borderColor="$red9"
                    items="center"
                    justify="center"
                  >
                    <YStack w={16} h={16} rounded="$10" bg="$red9" />
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
                    w={44}
                    h={44}
                    rounded="$10"
                    bg="$red2"
                    borderWidth={2}
                    borderColor="$red9"
                    items="center"
                    justify="center"
                  >
                    <YStack w={14} h={14} rounded="$10" bg="$red9" />
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
                      w={40}
                      h={40}
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
                    <YStack h={4} bg="$color3" rounded="$1" overflow="hidden">
                      <YStack
                        h={4}
                        bg="$blue9"
                        rounded="$1"
                        style={{
                          width:
                            duration > 0 ? `${Math.round((position / duration) * 100)}%` : '0%',
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
                      <YStack w={10} h={10} rounded="$10" bg="$red7" />
                      <Paragraph fontSize="$2" color="$color10">
                        再録音
                      </Paragraph>
                    </XStack>
                  </Pressable>
                </YStack>
              </YStack>
            )}
          </YStack>
        )}
```

- [ ] **Step 7: 品質チェック 4 ステップ**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

Expected: 全ステップ 0 エラー

- [ ] **Step 8: コミット**

```bash
git add components/practice-log-form.tsx
git commit -m "feat: 練習フォームに録音セクションを追加"
```

---

### Task 5: app/practice-log-form.tsx の更新

**Files:**

- Modify: `app/practice-log-form.tsx`

- [ ] **Step 1: インポートを更新**

変更前:

```typescript
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Alert, Pressable } from 'react-native';
import { Button, Paragraph, YStack } from 'tamagui';

import { PracticeLogForm, type PracticeLogFormRef } from '@/components/practice-log-form';
import { type PracticeLogInput } from '@/forms/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';
```

変更後:

```typescript
import * as FileSystem from 'expo-file-system';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Button, Paragraph, YStack } from 'tamagui';

import { PracticeLogForm, type PracticeLogFormRef } from '@/components/practice-log-form';
import { type PracticeLogInput } from '@/forms/practice-log';
import { getRecordingUri } from '@/lib/recording';
import { usePracticeLogStore } from '@/store/practice-log';
```

- [ ] **Step 2: 既存録音 URI の確認ロジックを追加**

`const editingSession = ...` 行の直後に追加する:

```typescript
const [existingRecordingUri, setExistingRecordingUri] = useState<string | null>(null);

useEffect(() => {
  if (!id) return;
  const uri = getRecordingUri(id);
  FileSystem.getInfoAsync(uri).then((info) => {
    if (info.exists) setExistingRecordingUri(uri);
  });
}, [id]);
```

- [ ] **Step 3: handleSubmit を更新**

変更前:

```typescript
const handleSubmit = async (data: PracticeLogInput) => {
  if (id) {
    await update(id, data);
  } else {
    await add(data);
  }
  router.back();
};
```

変更後:

```typescript
const handleSubmit = async (data: PracticeLogInput) => {
  const tempUri = formRef.current?.getTempRecordingUri() ?? null;
  if (id) {
    await update(id, data, tempUri);
  } else {
    await add(data, tempUri);
  }
  router.back();
};
```

- [ ] **Step 4: PracticeLogForm に existingRecordingUri を渡す**

変更前:

```typescript
      <PracticeLogForm ref={formRef} onSubmit={handleSubmit} initialValues={initialValues} />
```

変更後:

```typescript
      <PracticeLogForm
        ref={formRef}
        onSubmit={handleSubmit}
        initialValues={initialValues}
        existingRecordingUri={existingRecordingUri}
      />
```

- [ ] **Step 5: 品質チェック 4 ステップ**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

Expected: 全ステップ 0 エラー

- [ ] **Step 6: コミット**

```bash
git add app/practice-log-form.tsx
git commit -m "feat: 練習フォーム画面に録音URI連携を追加"
```

---

### Task 6: app/(tabs)/index.tsx に ♪ バッジを追加

**Files:**

- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: インポートを更新**

変更前:

```typescript
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { PracticeChart } from '@/components/practice-chart';
import { BASIC_MENUS, today } from '@/forms/practice-log';
import { calcSessionTime, usePracticeLogStore } from '@/store/practice-log';
```

変更後:

```typescript
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { PracticeChart } from '@/components/practice-chart';
import { BASIC_MENUS, today } from '@/forms/practice-log';
import { loadRecordedIds } from '@/lib/recording';
import { calcSessionTime, usePracticeLogStore } from '@/store/practice-log';
```

- [ ] **Step 2: recordedIds ステートと useFocusEffect を更新**

既存の `useFocusEffect` の直前に `recordedIds` ステートを追加し、`useFocusEffect` のコールバックに `loadRecordedIds` を追加する。

変更前:

```typescript
useFocusEffect(
  useCallback(() => {
    fetchAll();
  }, [fetchAll]),
);
```

変更後:

```typescript
const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set());

useFocusEffect(
  useCallback(() => {
    fetchAll();
    loadRecordedIds().then(setRecordedIds);
  }, [fetchAll]),
);
```

- [ ] **Step 3: セッションカードの日付行を更新して ♪ バッジを追加**

変更前:

```typescript
              <XStack justify="space-between" items="baseline" mb="$1">
                <Paragraph fontWeight="bold">
                  {`${item.practicedAt}（${dayOfWeek(item.practicedAt)}）`}
                </Paragraph>
                {(() => {
                  const sessionTime = calcSessionTime(item);
                  const total = item.totalMinutes ?? sessionTime.basic + sessionTime.nonBasic;
                  return total > 0 ? (
                    <Paragraph fontSize="$2" color="$blue9" fontWeight="bold">
                      {`合計: ${total}分`}
                    </Paragraph>
                  ) : null;
                })()}
              </XStack>
```

変更後:

```typescript
              <XStack justify="space-between" items="baseline" mb="$1">
                <Paragraph fontWeight="bold">
                  {`${item.practicedAt}（${dayOfWeek(item.practicedAt)}）`}
                </Paragraph>
                <XStack gap="$2" items="center">
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
                  {(() => {
                    const sessionTime = calcSessionTime(item);
                    const total = item.totalMinutes ?? sessionTime.basic + sessionTime.nonBasic;
                    return total > 0 ? (
                      <Paragraph fontSize="$2" color="$blue9" fontWeight="bold">
                        {`合計: ${total}分`}
                      </Paragraph>
                    ) : null;
                  })()}
                </XStack>
              </XStack>
```

- [ ] **Step 4: 品質チェック 4 ステップ**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

Expected: 全ステップ 0 エラー

- [ ] **Step 5: コミット**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat: セッション一覧に録音ありの ♪ バッジを追加"
```
