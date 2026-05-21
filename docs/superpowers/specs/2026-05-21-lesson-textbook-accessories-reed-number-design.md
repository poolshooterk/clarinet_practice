# 設計: レッスン記録教本追加・消耗品管理・使用リード番号・録音バグ修正

作成日: 2026-05-21

## 概要

以下の3機能追加と1バグ修正を行う。

1. **レッスン記録への教本追加** — 練習記録と同様の教本進捗入力をレッスン記録フォームに追加
2. **設定画面での消耗品管理** — リード・リガチャー・マウスピースを設定画面から管理できる専用画面を追加
3. **練習記録への使用リード番号** — 使用中のリードを特定する任意英数字フィールドを追加
4. **録音ファイル未保存バグ修正** — `stopAndUnloadAsync` 後に `getURI()` を呼んでいたため URI が null になる問題を修正

---

## Feature 1 — レッスン記録への教本追加

### DB スキーマ

```sql
CREATE TABLE lesson_record_textbooks (
  lesson_record_id  uuid  NOT NULL REFERENCES lesson_records(id) ON DELETE CASCADE,
  textbook_id       uuid  NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
  current_page      integer NOT NULL,
  duration_minutes  integer,
  tempo_bpm         integer,
  PRIMARY KEY (lesson_record_id, textbook_id)
);
ALTER TABLE lesson_record_textbooks ENABLE ROW LEVEL SECURITY;
-- RLS: ユーザーは自身の lesson_record に紐づく行のみ操作可能
```

### forms/lesson-record.ts

`textbookEntrySchema` を追加し、`lessonRecordSchema` に `textbookEntries` を追加する。
構造は `forms/practice-log.ts` の `textbookEntrySchema` と同一。

```ts
const textbookEntrySchema = z.object({
  textbookId: z.string().uuid(),
  currentPage: z.number().int().min(1),
  durationMinutes: z.number().int().min(1).optional(),
  tempoBpms: z.number().int().min(1).optional(),
});

// lessonRecordSchema に追加
textbookEntries: z.array(textbookEntrySchema).default([]),
```

### store/lesson-record.ts

- `LessonRecord` 型に `textbookEntries: TextbookEntry[]` を追加
- `fetchAll`: `lesson_record_textbooks` を LEFT JOIN して取得
- `add`: レッスン記録 INSERT 後に `lesson_record_textbooks` を INSERT + `useTextbookProgressStore.upsert` を呼ぶ
- `update`: `lesson_record_textbooks` を DELETE → 再 INSERT + `useTextbookProgressStore.upsert` を呼ぶ

### components/lesson-record-form.tsx

`practice-log-form` の教本エントリセクションと同パターンで実装。
`useTextbookCatalogStore` から教本一覧を取得し、Select + ページ/時間/テンポ入力を動的リストで表示。

### app/lesson-record-form.tsx

`useFocusEffect` を追加し、フォーカス時に以下を呼ぶ:

- `useTextbookCatalogStore.getState().fetchAll()`
- `useLessonRecordStore.getState().fetchAll()`

---

## Feature 2 — 設定画面での消耗品管理（Approach B）

### 方針

機材タブ（`app/(tabs)/equipment.tsx`）は変更しない。
設定画面にリンクを追加し、新規 Stack 画面 `app/accessories.tsx` で消耗品のみ編集できるようにする。
データは既存の `useEquipmentStore` / `user_equipment` テーブルを共用する。

### app/accessories.tsx（新規）

Stack 遷移画面。`<AccessoriesForm />` をレンダーする。

### components/accessories-form.tsx（新規）

- `useEquipmentStore` の `fetchEquipment` / `saveEquipment` / `equipment` / `loaded` を使用
- リード・リガチャー・マウスピースの `name`・`startDate` フィールドのみ表示（楽器フィールドは含まない）
- 各フィールドは既存の `equipmentItemSchema`（`forms/equipment.ts`）を流用
- 保存時は `saveEquipment` に現在の `equipment` の `instrument` フィールドをそのまま合成して渡す

### app/(tabs)/settings.tsx

既存の「教本管理」リンクの後に「消耗品管理」リンクを追加 → `/accessories`

---

## Feature 3 — 練習記録 使用リード番号

### DB migration

```sql
ALTER TABLE practice_sessions ADD COLUMN reed_number text;
```

### forms/practice-log.ts

```ts
reedNumber: z.string().regex(/^[a-zA-Z0-9]*$/).optional(),
```

### store/practice-log.ts

- `PracticeSession` 型に `reedNumber: string | null` 追加
- `fetchAll`: `reed_number` を SELECT に追加、スネーク→キャメル変換
- `add`/`update`: `reed_number: data.reedNumber ?? null` を含める

### components/practice-log-form.tsx

任意の英数字 `Input` フィールドを追加。ラベル「使用リード番号（任意）」。
`keyboardType="ascii-capable"` を指定。

---

## Bug fix — 録音ファイル未保存

### 原因

`lib/recording.ts` の `stopRecording` 関数で、`recording.stopAndUnloadAsync()` を呼んだ後に
`recording.getURI()` を呼んでいる。expo-av の仕様上、unload 後は URI が null を返す可能性があり、
その場合 `finalizeRecording` が呼ばれずファイルが保存されない。

### 修正

```ts
// 変更前
await recording.stopAndUnloadAsync();
const uri = recording.getURI(); // unload後のため null になりうる

// 変更後
const uri = recording.getURI(); // unload前に取得
await recording.stopAndUnloadAsync();
```

---

## テスト方針

| 対象                                   | テスト種別  | 内容                                             |
| -------------------------------------- | ----------- | ------------------------------------------------ |
| `textbookEntrySchema`（lesson-record） | unit        | valid/invalid, 境界値                            |
| `lessonRecordSchema` textbookEntries   | unit        | 空配列・複数エントリ                             |
| `reedNumber` バリデーション            | unit        | 英数字のみ許可、記号NG                           |
| `store/lesson-record.ts` add/update    | unit        | `getState()` 直叩きで textbookEntries の保存確認 |
| `store/practice-log.ts` reed_number    | unit        | add/update/fetchAll での値の往来                 |
| レッスン記録フォーム教本追加           | integration | 教本選択→保存フロー                              |
| 練習記録フォーム リード番号            | integration | 入力→保存→一覧反映                               |
| `lib/recording.ts stopRecording`       | unit        | getURI が unload 前に呼ばれることを確認          |

---

## 変更ファイル一覧

```
supabase/migrations/20260521000001_add_lesson_record_textbooks.sql  (新規)
supabase/migrations/20260521000002_add_practice_sessions_reed_number.sql  (新規)
forms/lesson-record.ts          (変更: textbookEntrySchema 追加)
forms/practice-log.ts           (変更: reedNumber 追加)
store/lesson-record.ts          (変更: textbookEntries 対応)
store/practice-log.ts           (変更: reedNumber 対応)
components/lesson-record-form.tsx  (変更: 教本エントリセクション追加)
components/practice-log-form.tsx   (変更: reedNumber フィールド追加)
components/accessories-form.tsx    (新規)
app/accessories.tsx             (新規)
app/(tabs)/settings.tsx         (変更: 消耗品管理リンク追加)
app/lesson-record-form.tsx      (変更: useFocusEffect 追加)
lib/recording.ts                (変更: getURI 呼び出し順序修正)
```
