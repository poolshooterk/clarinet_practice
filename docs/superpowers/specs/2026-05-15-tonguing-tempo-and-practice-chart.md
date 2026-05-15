# タンギングテンポ入力・月別練習時間グラフ 設計ドキュメント

## 目的

練習記録に 2 つの機能強化を加える。

1. **タンギングのテンポ入力**: 基礎練習セクションでタンギングの分数を入力したとき、BPM 欄を追加表示できるようにする。
2. **月別練習時間グラフ**: 練習記録一覧画面に月単位のバーチャートを追加し、日ごとの練習時間を視覚的に確認できるようにする。グラフと下のリストは選択月で連動する。

---

## Feature 1: タンギング テンポ入力

### 操作フロー

1. 練習記録フォームの「タンギング（分）」に値を入力する
2. 値が入った瞬間に「テンポ（BPM）任意」欄が下に出現する
3. BPM を入力する（任意。入力しなくてもよい）
4. 保存すると BPM が DB に記録される
5. 記録カードには「タンギング: 15分 ♩=120」の形式で表示される（BPM なしの場合は「タンギング: 15分」）

### DBマイグレーション

```sql
ALTER TABLE practice_session_basic_menus
  ADD COLUMN tempo_bpm INT CHECK (tempo_bpm BETWEEN 40 AND 240);
```

`tempo_bpm` は nullable。`long_tone` 行には NULL のまま、`tonguing` 行にのみ値を入れる。

### フォームスキーマ変更 (`forms/practice-log.ts`)

```ts
tonguingTempoBpm: z.number()
  .int()
  .min(40, '40以上の整数を入力してください')
  .max(240, '240以下の整数を入力してください')
  .optional();
```

`PracticeLogInput` に `tonguingTempoBpm` が追加される。

### フォームUI変更 (`components/practice-log-form.tsx`)

`watchedTonguing` が `undefined` でなければ `tonguingTempoBpm` の `Controller` を描画する。数値入力の変換ロジックは既存の `tonguingMinutes` と同じパターン（空文字・NaN → `undefined`）。

### ストア変更 (`store/practice-log.ts`)

`BasicMenuEntry` に `tempoBpm: number | null` を追加。

`fetchAll`: `practice_session_basic_menus` の select に `tempo_bpm` を追加し、マッピング時に `tempoBpm: m.tempo_bpm ?? null` を設定する。

`add`:

- タンギング行に `tempo_bpm: input.tonguingTempoBpm ?? null` を含めて insert する
- `newSession` のローカル更新にも `tempoBpm` を反映する

### カード表示変更 (`app/(tabs)/index.tsx`)

basicMenuEntries の表示ロジックを変更し、`menuType === 'tonguing'` かつ `tempoBpm != null` のとき「タンギング: X分 ♩=Y」形式で表示する。

---

## Feature 2: 月別練習時間グラフ + 月ナビゲーション

### 操作フロー

1. 練習記録タブを開くと、リストの上に当月のバーチャートが表示される
2. チャートの左上に `＜ 2026年5月 ＞` ナビゲーションが表示される
3. `＜` タップで前月、`＞` タップで次月へ遷移する（未来月への `＞` は無効）
4. 選択月が変わると、チャートとリストの両方がその月にフィルタされる
5. 月ヘッダーの統計表示（「05月: 8回 / 計480分」）も選択月に連動する

### 新規コンポーネント `components/practice-chart.tsx`

Props:

```ts
type Props = {
  sessions: PracticeSession[];
  month: string; // YYYY-MM
};
```

- 追加ライブラリ不要。React Native の `View` ベースでバーを描画する
- `month` の日数分のバーを横並びに表示（`flex` で均等割り付け）
- 各バーの高さ = `(dayMinutes / maxMinutes) * MAX_BAR_HEIGHT`。0 分の日はバーなし（高さ 0）
- 同日に複数セッションがある場合は合算する
- 今日の日付のバーをアクセントカラーで表示し、それ以外はサブカラー
- バー下ラベルは 1 日・8 日・15 日・22 日のみ表示（全日付を出すと重なるため）

### 画面変更 (`app/(tabs)/index.tsx`)

- `selectedMonth` state を追加（`useState<string>`、初期値 `today().slice(0, 7)`）
- `monthSessions` を `selectedMonth` でフィルタするよう変更（現在は `currentMonth` 固定）
- ヘッダー部分を月ナビゲーション + 統計表示に変更
- `<PracticeChart sessions={monthSessions} month={selectedMonth} />` をリストの上部に配置
- `sessions` ではなく `monthSessions` を `FlatList` の `data` に渡す
- `fetchAll` の呼び出しは `useFocusEffect` で維持（全セッションをストアに保持し、フィルタはローカルで行う）

---

## コード構成まとめ

| ファイル                                     | 変更内容                                   |
| -------------------------------------------- | ------------------------------------------ |
| `supabase/migrations/<ts>_add_tempo_bpm.sql` | `tempo_bpm` カラム追加                     |
| `forms/practice-log.ts`                      | `tonguingTempoBpm` フィールド追加          |
| `store/practice-log.ts`                      | `BasicMenuEntry` + `add` + `fetchAll` 更新 |
| `components/practice-log-form.tsx`           | BPM 入力欄の条件表示                       |
| `components/practice-chart.tsx`              | 新規 View ベースバーチャート               |
| `app/(tabs)/index.tsx`                       | 月ナビ + グラフ + リストフィルタ           |

---

## テスト方針

| 対象                            | 種別        | 内容                                                                             |
| ------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `forms/practice-log.ts`         | unit        | `tonguingTempoBpm` の境界値（40・240・範囲外・undefined）                        |
| `store/practice-log.ts`         | unit        | `add` で `tempoBpm` が正しくマッピングされること                                 |
| `components/practice-chart.tsx` | unit        | 日別集計ロジック（同日合算・空月・最大値の正規化）                               |
| フォーム + ストア連携           | integration | 分数入力後に BPM 欄が出現すること、BPM 込みで `onSubmit` が呼ばれること          |
| 月ナビゲーション                | integration | `＜ ＞` タップで月が変わりリストがフィルタされること、未来月の `＞` が無効なこと |
