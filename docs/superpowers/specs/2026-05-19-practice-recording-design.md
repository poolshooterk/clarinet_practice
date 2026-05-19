# 練習録音機能 設計ドキュメント

## 概要

練習セッションに任意で音声録音を添付できる機能を追加する。  
アプリ内でリアルタイム録音し、録音ファイルはデバイスローカルに保存する。  
1セッション1録音。録音後は練習フォーム上で再生できる。

---

## 要件

| 項目           | 内容                                                                |
| -------------- | ------------------------------------------------------------------- |
| 録音タイミング | アプリ内でリアルタイム録音（別ファイルアップロード不可）            |
| 保存先         | デバイスローカルのみ（Supabase Storage 不使用）                     |
| 上限           | 1セッション1録音                                                    |
| 再生           | 録音済みセッションを編集フォームで再生可能                          |
| 一覧表示       | セッション一覧に「録音あり」♪バッジを表示                           |
| Web 対応       | Web では録音セクションを非表示（`expo-av` が Web 録音非対応のため） |
| DB 変更        | なし                                                                |

---

## アーキテクチャ

### 追加ライブラリ

- `expo-av` — 録音・再生（`npx expo install expo-av`）
- `expo-file-system` — すでに導入済み。ファイル移動・削除に使用

### ファイルパス規則

```
{FileSystem.documentDirectory}recordings/tmp.m4a       # 録音中の一時ファイル（毎回上書き）
{FileSystem.documentDirectory}recordings/{sessionId}.m4a  # 確定済み録音
```

### マイクパーミッション

- iOS: `app.json` の `expo.ios.infoPlist` に `NSMicrophoneUsageDescription` を追加
- Android: `expo-av` が `RECORD_AUDIO` パーミッションを自動付与

---

## データフロー

### 新規セッション作成

1. ユーザーが練習フォームを開く
2. 録音ボタンをタップ → `tmp.m4a` に録音開始
3. 停止ボタンをタップ → `tmp.m4a` に録音完了、フォームに録音時間を表示
4. フォームの他フィールドを記入して「保存」
5. `practice_sessions` に INSERT → `sessionId` 取得
6. `tmp.m4a` を `{sessionId}.m4a` にリネーム（`FileSystem.moveAsync`）

### 既存セッション編集

1. セッション一覧からセッションをタップ → 編集フォームを開く
2. `{sessionId}.m4a` が存在すれば再生コントロールを表示
3. 再録音タップ → 新たに `tmp.m4a` に録音
4. 「保存」 → `tmp.m4a` で `{sessionId}.m4a` を上書き（`FileSystem.moveAsync`）

### セッション削除

- `practice_sessions` を DELETE するとともに `{sessionId}.m4a` も削除（`FileSystem.deleteAsync`、ファイルが存在しない場合はスキップ）

### フォームを保存せず閉じた場合

- `tmp.m4a` はそのまま残る。次回録音時に上書きされるため cleanup 不要。

---

## UIの状態遷移

録音セクションは練習フォームの最上部に配置する。

### ① 待機中（録音なし）

```
[ ● ]  録音を開始
       タップして練習を録音する
```

赤い丸ボタン。タップで録音開始。

### ② 録音中

```
[ ●~ ]  録音中…
         0:42
[ ■ 停止 ]
```

赤いパルスアニメーション＋経過タイマー（秒単位）。「停止」ボタンで録音終了。

### ③ 録音済み（再生可）

```
[ ▶ ]  ──────────────  1:23
                        0:00
       ● 再録音
```

再生ボタン＋プログレスバー＋録音時間。再生中は「▶」→「⏸」に切り替わる。「再録音」タップで①に戻り、新たに録音できる（確定は保存時）。

---

## セッション一覧での録音インジケーター

`app/(tabs)/index.tsx` の `useFocusEffect` 内で録音ディレクトリを1回スキャンし、ファイルが存在するセッションIDの `Set<string>` を local state に保持する。

```ts
const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set());

useFocusEffect(
  useCallback(() => {
    loadRecordedIds().then(setRecordedIds);
  }, []),
);
```

各セッションカードで `recordedIds.has(item.id)` が true の場合に ♪ バッジを表示する。

---

## ファイル・コンポーネント構成

### 新規作成

| パス                              | 役割                             |
| --------------------------------- | -------------------------------- |
| `lib/recording.ts`                | 録音・再生・ファイル操作ヘルパー |
| `lib/__tests__/recording.test.ts` | `lib/recording.ts` の単体テスト  |

#### `lib/recording.ts` の主要エクスポート

```ts
// 録音
startRecording(): Promise<Audio.Recording>
stopRecording(recording: Audio.Recording): Promise<string>  // 一時URIを返す

// 再生
createPlayer(uri: string): Promise<Audio.Sound>
playFromPosition(sound: Audio.Sound, positionMs: number): Promise<void>

// ファイル操作
finalizeRecording(sessionId: string): Promise<void>   // tmp.m4a → {sessionId}.m4a
deleteRecording(sessionId: string): Promise<void>     // 存在しなければスキップ
getRecordingUri(sessionId: string): string            // パスを返す（存在確認なし）
loadRecordedIds(): Promise<Set<string>>               // ディレクトリスキャン
```

### 変更対象

| パス                               | 変更内容                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/practice-log-form.tsx` | 録音セクションをフォーム最上部に追加。録音・再生状態を local state で管理。`PracticeLogFormRef` に `getTempRecordingUri(): string \| null` を追加 |
| `app/practice-log-form.tsx`        | `handleSubmit` で `formRef.current?.getTempRecordingUri()` を取得し、`add` / `update` に渡す                                                      |
| `store/practice-log.ts`            | `add(input, tempRecordingUri?)` / `update(id, input, tempRecordingUri?)` のシグネチャ変更。`remove(id)` で `deleteRecording` を呼び出す           |
| `app/(tabs)/index.tsx`             | `useFocusEffect` でディレクトリスキャン → `recordedIds` を管理。セッションカードに ♪ バッジ追加                                                   |
| `app.json`                         | `NSMicrophoneUsageDescription` を追加                                                                                                             |

---

## テスト方針

| テスト     | 場所                                                                        | 内容                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 単体       | `lib/__tests__/recording.test.ts`                                           | `expo-av` / `expo-file-system` をモック。`finalizeRecording` のパス検証、`deleteRecording` の存在確認スキップ、`loadRecordedIds` のID抽出 |
| ストア単体 | `store/__tests__/practice-log.test.ts`                                      | `add` 時に `finalizeRecording` が呼ばれること、`remove` 時に `deleteRecording` が呼ばれること                                             |
| 結合       | 追加しない（録音デバイスAPIはJestでモックが複雑なため。手動動作確認で代替） |

---

## 実装スコープ外

- 録音ファイルの書き出し・共有（AirDrop / ファイルアプリへの保存）
- 波形表示
- 録音のトリミング
- クラウド同期（Supabase Storage へのアップロード）
