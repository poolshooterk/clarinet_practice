# 練習記録 総練習時間・その他内容・楽器使用期間・ブルーデザイン 設計仕様

## 概要

4つの改善を1スペックにまとめる。すべて小規模変更のため単一の実装サイクルで完結させる。

---

## 機能1: その他練習内容フィールドの追加

### 変更対象

- DB: `practice_sessions.other_memo TEXT`
- `forms/practice-log.ts`: `otherMemo: z.string().optional()` をスキーマに追加
- `store/practice-log.ts`: `PracticeSession.otherMemo: string | null`、fetchAll / add / update で `other_memo` を読み書き
- `components/practice-log-form.tsx`: その他セクションのタイマー入力の下に「練習内容（任意）」テキスト入力を追加
- `app/practice-log-form.tsx`: `initialValues` に `otherMemo: editingSession.otherMemo ?? ''` を追加
- `app/(tabs)/index.tsx`: 個別カードで `item.otherMemo` を表示（`item.memo` と同様のスタイル）

### UI仕様

その他セクション内の配置順：

1. 練習時間入力（数値） + タイマーボタン
2. 「練習内容（任意）」ラベル + `Input` （`placeholder="例: 曲の通し練習、アンサンブルなど"` / `aria-label="その他練習内容"`）

カード表示: `otherMemo` が存在する場合、`その他: X分` の下に1行追加。

---

## 機能2: 総練習時間の表示・DB保存

### 変更対象

- DB: `practice_sessions.total_minutes INTEGER`
- `store/practice-log.ts`:
  - `PracticeSession.totalMinutes: number | null` を追加
  - `add` / `update` で `total_minutes = calcSessionTime(session).basic + calcSessionTime(session).nonBasic` を計算して保存
  - `fetchAll` で `total_minutes` を読み込む
- `app/(tabs)/index.tsx`:
  - 月ヘッダー: 「X回 / 合計: X分」（合計のみ。基礎/基礎練習以外の内訳は月ヘッダーに表示しない）
  - 個別カード: XStack に「合計: X分」を表示 + その下の行に「基礎練習: X分 / 基礎練習以外: X分」の内訳を表示
- `components/practice-log-form.tsx`:
  - サマリー行（`formBasicMinutes`/`formNonBasicMinutes` を表示している箇所）に合計行を追加
  - 表示: `基礎: X分 / 基礎練習以外: X分` + `合計: X分`（別行、ブルー色 `color="$blue9"`）

### 計算ロジック

`total_minutes` は `add`/`update` 時点での `calcSessionTime` 結果の `basic + nonBasic` を使用。テキストブックのdurationは既にstoreが取得済みのため、追加クエリは不要。

マイグレーション前の既存レコードは `total_minutes` が null になる。個別カードの表示では `session.totalMinutes ?? (calcSessionTime(session).basic + calcSessionTime(session).nonBasic)` でフォールバック計算する。

### 月ヘッダーの合計

`monthTotals.basic + monthTotals.nonBasic` をリアルタイム計算して表示（DBのtotal_minutesは使わずフロント計算）。

---

## 機能3: 楽器情報の使用期間拡張（リード・リガチャー・マウスピース）

### 変更対象

- `components/equipment-form.tsx` のみ。DB変更・スキーマ変更なし。

### 実装

`OTHER_SECTIONS.map` ループの中で、`watch(\`${section.key}.startDate\`)` の値を `calcUsagePeriod` に渡し、結果が存在する場合に `使用期間: X` を `FieldError` の下に表示する。楽器セクションの `instrumentUsagePeriod` と同じスタイル（`color="$color11" size="$2"`）。

---

## 機能4: ブルーアクセントデザイン

### 変更対象

- `app/_layout.tsx` のみ。

### 実装

`<TamaguiProvider>` 直下の `<Stack>` を `<Theme name="blue">` でラップする：

```tsx
import { Theme } from 'tamagui';

<TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme ?? 'light'}>
  <Theme name="blue">
    <Stack screenOptions={{ headerShown: false }} />
  </Theme>
</TamaguiProvider>;
```

これにより、明示的な `theme` 指定を持たないデフォルト `Button` がブルーアクセントになる。`theme="red"` など明示指定されたものは変更されない。

---

## DBマイグレーション

```sql
ALTER TABLE practice_sessions ADD COLUMN other_memo text;
ALTER TABLE practice_sessions ADD COLUMN total_minutes integer;
```

単一マイグレーションファイルにまとめる（`supabase/migrations/<timestamp>_add_other_memo_and_total_minutes.sql`）。

---

## テスト方針

### 単体テスト

- `store/__tests__/practice-log.test.ts`: `add` / `update` が `total_minutes` を正しく計算して保存するかを既存パターンで追加

### 結合テスト

- `__tests__/integration/practice-log-form.integration.test.tsx`:
  - その他練習内容フィールドの入力 → `onSubmit` に `otherMemo` が渡ることを確認
  - フォームサマリー行に「合計: X分」が表示されることを確認

### 型チェック・品質

品質チェック4ステップ（lint / format:check / tsc / test）を通す。

---

## 対象外

- `total_minutes` のDB値をフロントで読み込んで使う箇所はなし（月ヘッダーはフロント計算、個別カードはstoreから `totalMinutes` を読む）
- ブルーデザインでOS ダークモード対応の追加変更なし（`Theme name="blue"` はライト・ダーク両対応）
