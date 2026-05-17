# 設計 spec: 練習記録フォーム — その他時間・メモ移動・スケールBPM

## 概要

練習記録フォームに 3 つの改善を加える。

1. **メモ欄を日付直下に移動** — 日付 → メモ → 基礎練習 → 教本 → その他 の順に統一する
2. **「その他」練習時間フィールドを追加** — 基礎練習・教本いずれにも該当しない練習時間をタイマー付きで記録できるようにする
3. **スケールジャンル教本にBPM入力を追加** — ジャンルが「スケール」の教本エントリに複数BPMを入力でき、最大値のみDBに保存する

---

## フォームレイアウト（変更後）

```
1. 日付（必須）
2. メモ（任意）        ← 移動
3. 基礎練習セクション
   - ロングトーン（タイマー付き分入力）
   - タンギング（タイマー付き分入力 + BPM複数入力）
4. 教本の進捗セクション（エントリごとに）
   - 教本選択 / ページ / 練習時間
   - ジャンルが「スケール」の場合のみ BPM 入力欄を表示
     （複数入力可、保存時は max のみ格納）
5. その他セクション  ← 新規
   - タイマー付き練習時間（分）入力
6. サマリー表示
   - 基礎: X分 / 基礎練習以外: X分（教本時間 + その他時間の合計）
7. 保存ボタン
```

---

## スキーマ変更

### `forms/practice-log.ts`

`textbookEntrySchema` に `tempoBpms` を追加:

```typescript
const textbookEntrySchema = z.object({
  textbookId: z.string().uuid('教本を選択してください'),
  currentPage: z.number().int().min(0, '0以上の整数を入力してください'),
  durationMinutes: z.number().int().min(1, ...).optional(),
  tempoBpms: z.array(tonguingBpmEntrySchema).optional(), // スケール用 UI 保持、保存時は max のみ
});
```

`practiceLogSchema` に `otherMinutes` を追加:

```typescript
export const practiceLogSchema = z.object({
  ...
  otherMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  ...
});
```

---

## DBマイグレーション

```sql
-- practice_sessions にその他時間列を追加
ALTER TABLE practice_sessions ADD COLUMN other_minutes integer;

-- practice_session_textbooks にテンポ列を追加（スケール用、max BPM を格納）
ALTER TABLE practice_session_textbooks ADD COLUMN tempo_bpm integer;
```

---

## ストア変更 (`store/practice-log.ts`)

### 型の追加

```typescript
type TextbookEntry = {
  ...
  tempoBpm: number | null; // スケール教本のmax BPM
};

export type PracticeSession = {
  ...
  otherMinutes: number | null;
  ...
};
```

### calcSessionTime の変更

戻り値を `{ basic, textbook }` から `{ basic, nonBasic }` に変更する。

```typescript
export function calcSessionTime(session: PracticeSession): { basic: number; nonBasic: number } {
  const basicTextbook = ...;
  const textbookOnly = ...;
  return {
    basic: (session.durationMinutes ?? 0) + basicTextbook,
    nonBasic: textbookOnly + (session.otherMinutes ?? 0),
  };
}
```

### add / update の変更

- `other_minutes` を `practice_sessions` に保存
- `tempo_bpm = Math.max(...entry.tempoBpms.map(e => e.bpm))` を `practice_session_textbooks` に保存（tempoBpms が空の場合は null）

### fetchAll の変更

- `SessionRow` に `other_minutes` を追加
- `practice_session_textbooks` のクエリで `tempo_bpm` を取得

---

## 一覧画面変更 (`app/(tabs)/index.tsx`)

- `formatTimeLabel(basic, nonBasic)` のシグネチャ変更とラベル変更
  - `基礎練習: X分 / 基礎練習以外: X分`
- `calcSessionTime` の戻り値参照を `textbook` → `nonBasic` に更新
- 教本エントリ行に `tempoBpm` があれば `♩=XX` を表示
- セッションカードに「その他: X分」行を追加（`otherMinutes` が非 null の場合）

---

## フォームコンポーネント変更 (`components/practice-log-form.tsx`)

- メモ Controller を日付 Controller の直後に移動
- スケール教本エントリにBPM入力 UI を追加（`useFieldArray` で `textbookEntries.${index}.tempoBpms` を管理）
- 「その他」セクションを教本セクションの後に追加
  - `TimerControl` キー: `'other'`
  - `Controller` で `otherMinutes` を管理
- フォームサマリー計算を更新: `formNonBasicMinutes = formTextbookMinutes + (watchedOther ?? 0)`
- `useImperativeHandle` の submit ハンドラに `'other'` タイマー停止処理を追加

---

## タイマーキー

| セクション     | timerKey                 |
| -------------- | ------------------------ | -------- |
| ロングトーン   | `'long_tone'`            |
| タンギング     | `'tonguing'`             |
| 教本エントリ n | `'textbook-${field.id}'` |
| その他         | `'other'`                | （新規） |

---

## テスト影響範囲

| ファイル                                                         | 変更内容                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `forms/__tests__/practice-log.test.ts`                           | `otherMinutes`・`tempoBpms` のスキーマテストを追加                                                         |
| `store/__tests__/practice-log.test.ts`                           | `calcSessionTime` の `nonBasic` 計算テスト、`add`/`update` の `other_minutes`/`tempo_bpm` 保存テストを追加 |
| `__tests__/integration/practice-log-form.integration.test.tsx`   | メモ位置変更・その他入力・スケールBPM入力の統合テストを追加                                                |
| `__tests__/integration/practice-log-screen.integration.test.tsx` | `calcSessionTime` 変更に伴うラベル更新                                                                     |
