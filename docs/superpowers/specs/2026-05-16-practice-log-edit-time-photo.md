# 設計 spec: 練習記録編集・時間合計・楽器写真

作成日: 2026-05-16

## 概要

以下の 3 機能を追加する。

1. **練習記録の編集・削除** — タップで既存記録を編集フォームへ遷移
2. **練習時間の合計表示改善** — 教本練習時間をジャンルで分類して日次・月次に表示
3. **楽器写真の登録** — カメラ撮影またはライブラリから選択した写真を楽器情報に紐付け

---

## 機能 1: 練習記録の編集・削除

### 操作フロー

- 一覧の各セッションカードをタップ → `/practice-log-form?id=<sessionId>` へ遷移（編集モード）
- 既存のロングプレス削除は廃止し、削除ボタンを編集フォーム画面下部に配置
- `＋ 記録` ボタンは引き続き `/practice-log-form`（id なし）で新規モード

### ストア変更 (`store/practice-log.ts`)

`update(id: string, input: PracticeLogInput): Promise<void>` アクションを追加。

処理手順:

1. `practice_sessions` を UPDATE（practiced_at, duration_minutes, memo）
2. `practice_session_textbooks` を DELETE → INSERT で全件書き換え
3. `practice_session_basic_menus` を DELETE → INSERT で全件書き換え
4. 編集後の textbook currentPage を `useTextbookProgressStore.getState().upsert()` で反映
5. `sessions` 配列を in-place で差し替え（`sessions.map(s => s.id === id ? newSession : s)`）

`remove` アクションは変更なし（フォーム画面から呼び出す形に変更するのみ）。

### フォームコンポーネント変更 (`components/practice-log-form.tsx`)

- `initialValues?: PracticeLogInput` prop を追加
- `useForm` の `defaultValues` を `initialValues ?? { ...既存デフォルト... }` に変更
- フォーム UI・バリデーションロジックは新規/編集で共通のまま

### ルートファイル変更 (`app/practice-log-form.tsx`)

- `useLocalSearchParams` で `id` を取得
- `id` あり（編集モード）:
  - `sessions.find(s => s.id === id)` でセッションを取得
  - `PracticeSession → PracticeLogInput` の変換ロジックを追加
  - 保存時に `update(id, data)` を呼ぶ
  - 画面下部に「削除」ボタンを表示（Alert 確認 → `remove(id)` → `router.back()`）
- `id` なし（新規モード）: 現状のまま `add(data)` を呼ぶ

### 一覧画面変更 (`app/(tabs)/index.tsx`)

- `renderItem` の `Pressable` に `onPress` を追加: `router.push('/practice-log-form?id=' + item.id)`
- `onLongPress` と `handleLongPress` を削除

---

## 機能 2: 練習時間の合計表示改善

### ジャンル区分

| 区分         | ジャンル値                                                 |
| ------------ | ---------------------------------------------------------- |
| 基礎練習扱い | `'スケール'`, `'エチュード'`                               |
| 教本扱い     | `'ソナタ'`, `'コンチェルト'`, `'アンサンブル'`, `'その他'` |

### `TextbookEntry` 型に `genre` を追加 (`store/practice-log.ts`)

```ts
type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  totalPages: number | null;
  genre: string; // 追加
  durationMinutes: number | null;
};
```

`fetchAll` の SELECT クエリを `textbooks(title, total_pages, genre)` に拡張し、`genre` をマッピングする。`add` / `update` 時は `useTextbookCatalogStore` から genre を引いて `newSession` に含める。

### 時間計算ヘルパー

```ts
const BASIC_GENRES = ['スケール', 'エチュード'];

function calcSessionTime(session: PracticeSession) {
  const basicTextbook = session.textbookEntries
    .filter((e) => BASIC_GENRES.includes(e.genre))
    .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  const textbookOnly = session.textbookEntries
    .filter((e) => !BASIC_GENRES.includes(e.genre))
    .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  return {
    basic: (session.durationMinutes ?? 0) + basicTextbook,
    textbook: textbookOnly,
  };
}
```

### DB 変更なし

`practice_sessions.duration_minutes` は引き続きロングトーン + タンギングのみ保存。教本時間の分類は表示レイヤーのみで処理する。

### 一覧画面の表示変更 (`app/(tabs)/index.tsx`)

**月次ヘッダー**（現在: `3回 / 計90分`）:

```
3回 / 基礎練習: 75分 / 教本: 40分
```

両方ゼロの場合は `3回 / 練習時間未記録` と表示。

**セッションカード**（現在: `30分` を右上に表示）:

```
基礎練習: 30分 / 教本: 20分
```

どちらか片方が 0 の場合はその行を省略。

### フォーム内リアルタイム合計 (`components/practice-log-form.tsx`)

フォーム内の「合計: X分」を「基礎: X分 / 教本: Y分」に変更。`useTextbookCatalogStore` から選択中の教本の genre を引いてリアルタイム計算する。

---

## 機能 3: 楽器写真の登録

### 追加パッケージ

```bash
npx expo install expo-image-picker expo-file-system
```

### スキーマ変更 (`forms/equipment.ts`)

```ts
export const instrumentItemSchema = z.object({
  // ... 既存フィールド
  photoUri: z.string().optional(), // 追加
});
```

### ストア変更なし

`ClarinetEquipment.instrument.photoUri` は既存の `persist` middleware + AsyncStorage でそのまま永続化される。

### フォーム変更 (`components/equipment-form.tsx`)

楽器カードの使用開始日フィールドの直下に写真セクションを追加。

**写真なし時（コンパクトバナー）:**

```
┌─────────────────────────────────────────────┐
│ 📷   楽器の写真を追加                        │
│      タップして撮影またはライブラリから選択   │
└─────────────────────────────────────────────┘
```

**写真あり時（サムネイル表示）:**

```
┌──────────────┬─────────────────────────────┐
│              │ 写真を変更 ▾                 │
│  (サムネイル) │                             │
│              │ [✕ 削除]                    │
└──────────────┴─────────────────────────────┘
```

**ActionSheet の選択肢（バナーまたは「写真を変更」タップ時）:**

- 📷 カメラで撮影 → `ImagePicker.requestCameraPermissionsAsync()` → `launchCameraAsync()`
- 🖼 ライブラリから選択 → `ImagePicker.requestMediaLibraryPermissionsAsync()` → `launchImageLibraryAsync()`
- キャンセル

**写真の永続化処理:**

1. picker が返す一時 URI を `FileSystem.copyAsync` でアプリの `documentDirectory` にコピー
2. コピー先の永続 URI を `setValue('instrument.photoUri', uri)` で RHF に反映

**Platform 分岐:** `Platform.OS === 'web'` ではバナー・サムネイルを非表示（expo-image-picker は Web 非対応）。

---

## テスト方針

| 対象                                           | 種別        | 内容                                                                |
| ---------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| `store/practice-log.ts` の `update` アクション | unit        | セッション・textbooks・basicMenus が正しく差し替えられるか          |
| `calcSessionTime` ヘルパー                     | unit        | スケール/エチュードが基礎側に計上され、その他が教本側に計上されるか |
| 練習記録編集フォーム                           | integration | タップ → フォーム表示 → 保存で `update` が呼ばれ一覧に反映されるか  |
| `instrumentItemSchema` の `photoUri`           | unit        | optional かつ文字列のみ受け付けるか                                 |
| 楽器写真セクション                             | integration | `expo-image-picker` をモックして URI が `photoUri` に反映されるか   |
