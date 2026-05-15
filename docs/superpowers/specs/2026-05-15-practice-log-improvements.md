# 練習記録改善 — 設計 spec

作成日: 2026-05-15

## 概要

練習記録に関する3つの改善を行う。

1. **月別グラフの条件表示** — 選択月に記録がない場合はグラフを非表示
2. **タンギング複数BPM** — 1セッションで複数テンポを記録できるようにする
3. **教本デフォルト値** — フォームを開いたとき前回セッションの教本・ページを初期値として設定

---

## Feature 1: 月別グラフの条件表示

### 変更箇所

`app/(tabs)/index.tsx` のみ。

### 仕様

- `monthSessions.length > 0` の場合のみ `<PracticeChart>` を描画する
- 空月ではグラフ領域ごと非表示になる（高さを占有しない）
- 月ナビゲーション・合計分表示は引き続き常時表示

---

## Feature 2: タンギング複数BPM

### DBマイグレーション

`practice_session_basic_menus` テーブルを変更する。

```sql
-- 新列追加
ALTER TABLE practice_session_basic_menus
  ADD COLUMN tempo_bpms integer[];

-- 既存データを移行
UPDATE practice_session_basic_menus
  SET tempo_bpms = ARRAY[tempo_bpm]
  WHERE tempo_bpm IS NOT NULL;

-- 旧列削除
ALTER TABLE practice_session_basic_menus
  DROP COLUMN tempo_bpm;
```

### フォームスキーマ (`forms/practice-log.ts`)

```typescript
// 削除
tonguingTempoBpm: z.number().int().min(40).max(240).optional();

// 追加
tonguingTempoBpms: z.array(
  z.object({ bpm: z.number().int().min(40, '40以上').max(240, '240以下') }),
).optional();
```

`useFieldArray` で管理するためオブジェクト `{ bpm: number }` でラップする。
`PracticeLogInput.tonguingTempoBpms` の型は `{ bpm: number }[] | undefined`。

### フォームUI (`components/practice-log-form.tsx`)

- `tonguingMinutes` が `undefined` でない場合に BPM 入力セクションを表示（現行の表示条件と同じ）
- `useFieldArray({ control, name: 'tonguingTempoBpms' })` で動的リスト管理
- 初期状態は空リスト（`fields.length === 0`）
- 「＋ テンポを追加」ボタンで `{ bpm: undefined }` を append
- 各行に数値 Input + ✕削除ボタン
- エラーは `errors.tonguingTempoBpms?.[index]?.bpm?.message` で表示

### ストア (`store/practice-log.ts`)

**型変更:**

```typescript
// Before
type BasicMenuEntry = {
  menuType: string;
  durationMinutes: number;
  tempoBpm: number | null;
};

// After
type BasicMenuEntry = {
  menuType: string;
  durationMinutes: number;
  tempoBpms: number[];
};
```

**`SessionRow` 型変更:**

```typescript
// Before
{ menu_type: string; duration_minutes: number; tempo_bpm: number | null }[]

// After
{ menu_type: string; duration_minutes: number; tempo_bpms: number[] | null }[]
```

**`fetchAll` マッピング変更:**

```typescript
tempoBpms: m.tempo_bpms ?? [],
```

**`add()` の `basicMenuRows` 構築変更:**

```typescript
// tonguing 行の tempo_bpms
tempo_bpms: input.tonguingTempoBpms?.length
  ? input.tonguingTempoBpms.map((e) => e.bpm)
  : null,
```

**`newSession` の `basicMenuEntries` マッピング変更:**

```typescript
basicMenuEntries: basicMenuRows.map((r) => ({
  menuType: r.menu_type,
  durationMinutes: r.duration_minutes,
  tempoBpms: r.tempo_bpms ?? [],
})),
```

### 練習カード表示 (`app/(tabs)/index.tsx`)

```typescript
// Before
const suffix =
  entry.menuType === 'tonguing' && entry.tempoBpm != null ? ` ♩=${entry.tempoBpm}` : '';

// After
const suffix =
  entry.menuType === 'tonguing' && entry.tempoBpms.length > 0
    ? ` ♩=${entry.tempoBpms.join(', ')}`
    : '';
```

---

## Feature 3: 教本デフォルト値

### 変更箇所

`components/practice-log-form.tsx` のみ。DBスキーマ変更なし。

### 仕様

- フォームコンポーネント内で `usePracticeLogStore((s) => s.sessions)` から最新セッション (`sessions[0]`) を取得
- `sessions[0]?.textbookEntries` を `defaultValues.textbookEntries` にマッピング
- 取り込むフィールド: `textbookId` / `currentPage`（両方引き継ぐ）
- 教本カタログ (`useTextbookCatalogStore`) に存在しない `textbookId` はフィルタして除外する（削除済み教本の混入防止）
- `sessions` が空の場合は従来通り `textbookEntries: []`

```typescript
const sessions = usePracticeLogStore((s) => s.sessions);
const textbooks = useTextbookCatalogStore((s) => s.textbooks);
const textbookIds = new Set(textbooks.map((t) => t.id));

const lastTextbookEntries = (sessions[0]?.textbookEntries ?? [])
  .filter((e) => textbookIds.has(e.textbookId))
  .map((e) => ({ textbookId: e.textbookId, currentPage: e.currentPage }));
```

`defaultValues.textbookEntries` にこの値を設定する。

---

## テスト方針

| 対象                                       | 種別         | 内容                                                                               |
| ------------------------------------------ | ------------ | ---------------------------------------------------------------------------------- |
| `practiceLogSchema` の `tonguingTempoBpms` | unit         | 空配列・BPM境界値（40/240）・範囲外・undefined                                     |
| `store/practice-log.ts` の `add()`         | unit         | `tempoBpms` が正しくマッピングされること（空・単一・複数）                         |
| `components/practice-chart.tsx`            | unit（既存） | 変更なし                                                                           |
| フォーム + BPM 複数入力                    | integration  | タンギング分数入力後にBPMリストが出現し、追加・削除できること                      |
| フォーム + 教本デフォルト                  | integration  | 前回セッションありの状態でフォームを開くと教本・ページが初期値として表示されること |
| 月別グラフ条件表示                         | integration  | 空月では `PracticeChart` が描画されないこと                                        |
