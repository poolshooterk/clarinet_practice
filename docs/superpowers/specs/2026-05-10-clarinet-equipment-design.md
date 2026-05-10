# 楽器情報登録画面 設計ドキュメント

Date: 2026-05-10

## 概要

クラリネット練習アプリの初期機能として、自身の機材情報（楽器・リード・リガチャー・マウスピース）を登録・保存する画面を実装する。

## アーキテクチャ

### ナビゲーション構成

expo-router v6 のファイルベースルーティングで **3タブ構成** に移行する。

```
app/
  (tabs)/
    _layout.tsx          ← タブ定義（練習記録 / 楽器情報 / 設定）
    index.tsx            ← 練習記録タブ（スケルトン）
    equipment.tsx        ← 楽器情報タブ ← 今回の実装対象
    settings.tsx         ← 設定タブ（スケルトン）
```

### 新規ファイル

```
forms/equipment.ts                              ← zodスキーマ + 日付ヘルパー
components/equipment-form.tsx                   ← フォームUI
store/equipment.ts                              ← Zustand + persist
forms/__tests__/equipment.test.ts               ← スキーマ・ヘルパー単体テスト
store/__tests__/equipment.test.ts               ← ストア単体テスト
__tests__/integration/equipment-form.integration.test.tsx
```

### 既存ファイルの扱い

| ファイル                                           | 対応                 |
| -------------------------------------------------- | -------------------- |
| `app/index.tsx`                                    | 削除（デモ役目終了） |
| `forms/profile.ts` / `components/profile-form.tsx` | 残す（参照実装）     |
| `store/counter.ts` / `store/settings.ts`           | 残す                 |

## データモデル

### 型定義

```ts
type EquipmentItem = {
  name: string; // 機材名（自由入力 or プリセット選択）
  startDate: string; // 使用開始日 YYYY-MM-DD
};

type ClarinetEquipment = {
  instrument: EquipmentItem; // 楽器
  reed: EquipmentItem; // リード
  ligature: EquipmentItem; // リガチャー
  mouthpiece: EquipmentItem; // マウスピース
};
```

### zod スキーマ（`forms/equipment.ts`）

```ts
const equipmentItemSchema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  startDate: z
    .string()
    .min(1, '使用開始日を入力してください')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式で入力してください')
    .refine((s) => parseYmd(s) !== null, '有効な日付を入力してください')
    .refine((s) => parseYmd(s)! <= today(), '未来の日付は選択できません'),
});

const clarinetEquipmentSchema = z.object({
  instrument: equipmentItemSchema,
  reed: equipmentItemSchema,
  ligature: equipmentItemSchema,
  mouthpiece: equipmentItemSchema,
});
```

`parseYmd` / `formatDate` / `today` は `forms/profile.ts` と同パターンで `forms/equipment.ts` に定義する。

### Zustand ストア（`store/equipment.ts`）

```ts
type EquipmentState = {
  equipment: ClarinetEquipment | null;
  setEquipment: (e: ClarinetEquipment) => void;
};
// persist + AsyncStorage
// name: 'clarinet-practice-equipment'
```

## UI コンポーネント

### 画面構成（`components/equipment-form.tsx`）

ScrollView 内に 4 枚のカードを縦並びで配置し、最下部に「保存する」ボタン。

#### 各カードの構成（楽器・リード・リガチャー・マウスピース 共通）

1. **セクションタイトル**（絵文字 + 機材名）
2. **機材名入力欄**（Tamagui Input）― 自由入力、プレースホルダーあり
3. **プリセットチップ**（XStack wrap）― タップで入力欄に反映
4. **使用開始日**（Input + 「📅 選ぶ」ボタン）― iOS/Android は DateTimePicker、Web はテキスト直接入力（`Platform.OS === 'web'` で分岐）
5. **FieldError**（既存 `components/form/field-error.tsx`）― バリデーションエラー表示

### プリセット一覧

#### 楽器

- B♭クラリネット
- Aクラリネット
- バスクラリネット
- Eクラリネット

#### リード

- Vandoren V12
- Vandoren Traditional（青箱）
- Vandoren V21
- D'Addario Select Jazz
- Rico Royal
- Legere Signature

#### リガチャー

- Vandoren M/O
- BG Franck Superior
- Bonade
- Rovner Dark
- Harrison

#### マウスピース

- Vandoren B45
- Vandoren M30
- Vandoren BD5
- Clark W. Fobes Debut
- Selmer C85

### 初回起動時の挙動

`equipment` が `null`（未保存）の場合、全フィールドが空のフォームを表示する。`useForm` の `defaultValues` はすべて空文字列。

### 保存フロー

1. 「保存する」押下 → RHF が zod バリデーション実行
2. 成功 → `useEquipmentStore.setEquipment(data)` → AsyncStorage に永続化 → `Alert.alert('保存しました')` 表示
3. 失敗 → 各フィールドに FieldError 表示（Alert は出さない）
4. 次回起動時 → rehydrate で保存済み値がフォーム初期値として表示

## テスト方針

### 単体テスト（unit）

**`forms/__tests__/equipment.test.ts`**

- `equipmentItemSchema`: 必須チェック・YYYY-MM-DD 形式・未来日付拒否・境界値
- `clarinetEquipmentSchema`: 全フィールドの複合検証
- `parseYmd` / `formatDate` / `today`: round-trip・malformed 入力

**`store/__tests__/equipment.test.ts`**

- `setEquipment` でストア状態が更新されること
- `persist` + AsyncStorage のラウンドトリップ・rehydrate・異常系

### 結合テスト（integration）

**`__tests__/integration/equipment-form.integration.test.tsx`**

- 空送信でエラーが表示されること（スモーク）
- 全項目入力 → 「保存する」 → `onSubmit` が正しい値で呼ばれること
- rehydrate: ストアに初期値を注入した状態でフォームに反映されること

### E2E（Maestro）

今回は追加しない（バリデーション網羅は unit、配線確認は integration で担保済み）。
