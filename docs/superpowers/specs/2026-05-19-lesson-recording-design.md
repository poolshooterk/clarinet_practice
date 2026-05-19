# レッスン録音機能 設計ドキュメント

## 概要

レッスン記録フォームにオーディオ録音機能を追加する。既存の練習記録の録音機能（`lib/recording.ts`、`components/practice-log-form.tsx`）と同じ基盤を使い、録音 UI を `RecordingSection` 共通コンポーネントに抽出して両フォームで共用する。

---

## アーキテクチャ

### 共通コンポーネント抽出

現在 `components/practice-log-form.tsx` に埋め込まれている録音ロジック・UI を `components/form/recording-section.tsx` として独立させる。練習フォームとレッスンフォームの両方がこのコンポーネントを使う。

```
components/form/recording-section.tsx   ← 新規（録音 UI すべて内包）
components/practice-log-form.tsx        ← 変更（RecordingSection を使うよう軽微リファクタ）
components/lesson-record-form.tsx       ← 変更（RecordingSection を追加）
```

### ファイルストレージ

既存の `lib/recording.ts` をそのまま使用。ファイル名は `{documentDirectory}recordings/{id}.m4a`（`id` はレッスン記録 UUID）。練習記録録音と同じディレクトリに共存する。UUID の衝突はないため区別は不要。

---

## コンポーネント設計

### RecordingSection (`components/form/recording-section.tsx`)

```tsx
type RecordingSectionProps = {
  existingRecordingUri?: string | null;
  onChange: (state: { tempUri: string | null; reRecordTriggered: boolean }) => void;
};
```

- **内部状態**: `recState: 'idle' | 'recording' | 'recorded'`、`isPlaying`、`position`、`duration`、`tempUri`、`reRecordTriggered`、`recordingRef`、`soundRef`
- **`Platform.OS === 'web'`** のとき `null` を返す（非表示）
- 録音 / 停止 / 再生 / 一時停止 / シーク / 再録音の UI をすべて内包
- 状態変化のたびに `onChange` を呼ぶ

### practice-log-form の変更

`useRef` で録音状態を保持し、`useImperativeHandle` のシグネチャを維持する：

```tsx
const recStateRef = useRef({ tempUri: null as string | null, reRecordTriggered: false });

// useImperativeHandle（変更なし）
getTempRecordingUri: () => recStateRef.current.tempUri,
shouldDeleteExistingRecording: () =>
  recStateRef.current.reRecordTriggered && recStateRef.current.tempUri === null,

// JSX
<RecordingSection
  existingRecordingUri={existingRecordingUri}
  onChange={(s) => { recStateRef.current = s; }}
/>
```

### lesson-record-form の変更

`forwardRef` は導入しない。代わりに `useState` で録音状態を保持し、保存ボタン押下時に `onSubmit` コールバックで渡す：

```tsx
// onSubmit シグネチャを拡張
onSubmit?: (
  values: LessonRecordInput,
  tempUri: string | null,
  shouldDeleteExisting: boolean,
) => void | Promise<void>;

// 内部
const [recState, setRecState] = useState({
  tempUri: null as string | null,
  reRecordTriggered: false,
});

// 保存時
const wrappedSubmit = handleSubmit((values) => {
  const shouldDelete = recState.reRecordTriggered && recState.tempUri === null;
  props.onSubmit?.(values, recState.tempUri, shouldDelete);
});
```

---

## 画面設計

### app/lesson-record-form.tsx の変更

- `formRef` 不要（レッスンフォームは内部保存ボタン）
- `existingRecordingUri` を `FileSystem.getInfoAsync` で確認し props として渡す
- `handleSave` を録音対応に変更：

```tsx
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
```

### app/(tabs)/lesson.tsx の変更

練習記録一覧と同様に：

```tsx
const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set());

useFocusEffect(
  useCallback(() => {
    fetchAll();
    loadRecordedIds().then(setRecordedIds);
  }, [fetchAll]),
);

// renderItem 内
{
  recordedIds.has(item.id) && (
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
  );
}
```

---

## ストア変更 (`store/lesson-record.ts`)

```tsx
// add
add: async (input: LessonRecordInput, tempRecordingUri?: string | null) => {
  // ... insert ...
  if (tempRecordingUri) {
    try { await finalizeRecording(newId); } catch { /* 録音失敗でも記録は保存 */ }
  }
  set({ records: [newRecord, ...get().records] });
},

// update
update: async (id: string, input: LessonRecordInput, tempRecordingUri?: string | null) => {
  // ... update ...
  if (tempRecordingUri) {
    try { await finalizeRecording(id); } catch { /* 録音失敗でも記録は保存 */ }
  }
  set({ records: get().records.map(...) });
},

// remove（変更：deleteRecording を追加）
remove: async (id: string) => {
  const { error } = await supabase.from('lesson_records').delete().eq('id', id);
  if (error) return;
  await deleteRecording(id);
  set({ records: get().records.filter((r) => r.id !== id) });
},
```

---

## テスト方針

### 新規テスト

| ファイル                                               | 内容                                                                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/form/__tests__/recording-section.test.tsx` | idle 表示 / web 非表示 / onChange 呼び出し（モック）                                                                                                         |
| `store/__tests__/lesson-record.test.ts` への追記       | add 時に finalizeRecording を呼ぶ / update 時に finalizeRecording を呼ぶ / finalizeRecording 失敗時でも記録が保存される / remove 時に deleteRecording を呼ぶ |

### 変更テスト

- `components/practice-log-form` の既存統合テストは `RecordingSection` 抽出後も通ること（録音部分はモック済みのため影響なし）

---

## 制約・非対応事項

- **Web**: 録音セクション非表示（`Platform.OS !== 'web'`）
- **同時録音**: expo-router のスタック遷移上、練習フォームとレッスンフォームが同時に開くことはないため tmp.m4a の競合なし
- **Supabase Storage**: 使用しない。端末ローカルのみ
- **DB スキーマ変更**: なし
