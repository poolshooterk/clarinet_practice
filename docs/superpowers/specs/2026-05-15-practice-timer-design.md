# 練習タイマー機能 設計 spec

日付: 2026-05-15

## 概要

練習記録フォームの各練習セクション（ロングトーン・タンギング・各教本）に、ストップウォッチ機能を追加する。ライブ計測（開始/一時停止/停止）と手動時刻入力（HH:MM の開始・終了時刻を指定）の両方に対応する。計測結果は分単位（切り上げ）でフォームフィールドへ自動入力する。分数のみ DB に保存し、開始・終了時刻は保存しない。

## アーキテクチャ

### 新規ファイル

| ファイル                       | 役割                                    |
| ------------------------------ | --------------------------------------- |
| `store/timer.ts`               | タイマー状態の Zustand + persist ストア |
| `components/timer-control.tsx` | タイマー UI コンポーネント              |

### 変更ファイル

| ファイル                           | 変更内容                                                        |
| ---------------------------------- | --------------------------------------------------------------- |
| `forms/practice-log.ts`            | `textbookEntrySchema` に `durationMinutes` を追加               |
| `components/practice-log-form.tsx` | 各セクションに `TimerControl` を組み込む                        |
| `store/practice-log.ts`            | `TextbookEntry` 型・`add`・`fetchAll` に `durationMinutes` 対応 |
| `app/(tabs)/index.tsx`             | 教本エントリの時間表示を追加                                    |
| `supabase/migrations/`             | `practice_session_textbooks.duration_minutes` カラム追加        |

## タイマー状態モデル

各タイマーは文字列キーで識別する。

- ロングトーン: `'long_tone'`
- タンギング: `'tonguing'`
- 教本エントリ: `'textbook-<uuid>'`（フォームの field id を使用）

```typescript
type TimerEntry = {
  status: 'idle' | 'running' | 'paused' | 'stopped';
  accumulatedMs: number; // 前回一時停止までの累積ミリ秒
  startedAt: number | null; // 最後に開始/再開した Date.now()
};

type TimerStore = {
  timers: Record<string, TimerEntry>;
  start: (key: string) => void;
  pause: (key: string) => void;
  stop: (key: string) => number; // 切り上げ分数を返す（最小1分）
  reset: (key: string) => void;
  resetAll: () => void;
};
```

経過時間は常に `accumulatedMs + (status === 'running' ? Date.now() - startedAt : 0)` で動的計算する。`startedAt` を数値タイムスタンプで保持するため、バックグラウンド中も時刻は進んでおり、フォアグラウンド復帰時に正しい値が得られる。

## TimerControl コンポーネント

```typescript
type Props = {
  timerKey: string;
  onStop: (minutes: number) => void;
};
```

### 表示状態

| status    | 表示内容                                      |
| --------- | --------------------------------------------- |
| `idle`    | 「計測開始」ボタン                            |
| `running` | 経過時間（MM:SS）＋「一時停止」「停止」ボタン |
| `paused`  | 経過時間（MM:SS）＋「再開」「停止」ボタン     |
| `stopped` | 計測結果（X分）＋「リセット」ボタン           |

`useEffect` + `setInterval(1000)` で表示を更新。`AppState` の `change` イベントを購読し、フォアグラウンド復帰時に `setInterval` を再起動する。

### 手動時刻入力モード

TimerControl 下部に「時刻で入力」トグルを設ける。展開すると開始時刻（HH:MM）・終了時刻（HH:MM）の Input が表示され、両方入力された時点で分数を計算（切り上げ）してフォームへ反映する。日をまたぐ場合（終了 < 開始）は翌日とみなして計算する。タイマー計測と手動入力は排他的（一方を操作するともう一方をリセット）。

## フォームへの統合

### ロングトーン・タンギング

既存の「〇〇（分）任意」Input の上に `TimerControl` を配置。`onStop` コールバックで `Controller` の `onChange` を呼び出し、分数フィールドに自動入力する。

### 教本エントリ

各教本エントリカード内に `durationMinutes` フィールドを追加し、その上に `TimerControl` を配置する。タイマーキーは `'textbook-' + field.id`（RHF の `useFieldArray` が生成する id）を使用する。

### 保存時の処理

`useImperativeHandle` で公開する `submit` 関数内で、全タイマーキーを走査して `running` 状態のものを `timerStore.stop(key)` で停止し、`setValue` でフォームフィールドに分数をセットしてから `handleSubmit` を呼び出す。保存後・フォームキャンセル時に `timerStore.resetAll()` を呼び出す。

### リセットボタンの挙動

`stopped` 状態の「リセット」ボタンはタイマー表示を `idle` に戻すのみ。フォームの分数フィールドの値はクリアしない（ユーザーが値を手動編集している可能性があるため）。

## データモデル変更

### forms/practice-log.ts

```typescript
const textbookEntrySchema = z.object({
  textbookId: z.string().uuid('教本を選択してください'),
  currentPage: z.number().int().min(0, '0以上の整数を入力してください'),
  durationMinutes: z.number().int().min(1).optional(), // 追加
});
```

### DB マイグレーション

```sql
ALTER TABLE practice_session_textbooks
  ADD COLUMN duration_minutes integer;
```

### store/practice-log.ts の型変更

```typescript
type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  totalPages: number | null;
  durationMinutes: number | null; // 追加
};
```

## エラーハンドリング

- タイマーが `idle` かつ手動入力もない場合 → 分数フィールドは空のまま（現行と同じ任意扱い）
- 手動入力で終了時刻 ≤ 開始時刻の場合（日またぎを除く）→ エラーメッセージを表示し、フォームへ反映しない
- 保存時にタイマーが `running` の場合 → 自動 stop して分数をセットしてから submit

## テスト方針

### unit テスト

- `store/__tests__/timer.test.ts`: 状態遷移（start / pause / resume / stop）・切り上げ計算（61秒→2分、60秒→1分、1秒→1分）・`resetAll`
- `forms/__tests__/practice-log.test.ts`: `textbookEntrySchema` の `durationMinutes` 境界値

### integration テスト

- `__tests__/integration/practice-log-form-timer.integration.test.tsx`:
  - TimerControl の「計測開始 → 停止」操作でフォームの分数フィールドが更新されること
  - 手動入力（HH:MM）で分数が計算・反映されること

### unit テスト（コンポーネント）

- `components/__tests__/timer-control.test.tsx`: 各 status（idle / running / paused / stopped）で正しい UI が表示されること
