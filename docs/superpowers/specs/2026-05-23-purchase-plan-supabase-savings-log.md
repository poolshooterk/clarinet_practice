# 購入計画 Supabase 移行 & 月次貯蓄実績ログ

## 概要

購入計画機能を AsyncStorage ローカル保存から Supabase に移行し、月次の貯蓄実績を累積登録できるようにする。ユーザーは「今月いくら貯めたか」を毎月（同月複数回可）記録し、合計が現在の貯蓄額として自動算出される。

## ユーザーストーリー

- 購入計画（目標楽器・目標金額・予定月額）を Supabase に保存し、機種変更後も引き継げる
- 毎月の貯蓄実績（年月・金額・メモ）を追加・編集・削除できる
- 同月に複数回の実績を登録できる（例：通常貯蓄とボーナス分を別登録）
- 現在の貯蓄額は全実績の合計として自動算出され、購入予定時期が更新される
- 貯蓄実績の表示・編集は当月と前月の2ヶ月分に限定し、画面が縦に長くなるのを防ぐ

## データモデル

### `purchase_plans` テーブル

1 ユーザー 1 行。`user_id` に UNIQUE 制約を持つ。

```sql
CREATE TABLE purchase_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  maker_id              TEXT NOT NULL,
  maker_name            TEXT NOT NULL,
  model_id              TEXT NOT NULL,
  model_name            TEXT NOT NULL,
  target_price          INTEGER NOT NULL CHECK (target_price > 0),
  monthly_savings_target INTEGER NOT NULL CHECK (monthly_savings_target > 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS:
- SELECT: `user_id = auth.uid()`
- INSERT: `user_id = auth.uid()`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()`

### `purchase_plan_savings` テーブル

月次貯蓄実績。同月複数行可（UNIQUE 制約なし）。

```sql
CREATE TABLE purchase_plan_savings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_plan_id  UUID NOT NULL REFERENCES purchase_plans(id) ON DELETE CASCADE,
  year_month        TEXT NOT NULL,          -- 'YYYY-MM' 形式
  amount            INTEGER NOT NULL CHECK (amount > 0),
  memo              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS:
- 全操作: `EXISTS (SELECT 1 FROM purchase_plans WHERE id = purchase_plan_id AND user_id = auth.uid())`

### `current_savings`（導出値）

`purchase_plan_savings.amount` の全件合計をコンポーネント側で計算する。DB カラムとして持たない。

```ts
const currentSavings = savings.reduce((sum, s) => sum + s.amount, 0);
```

## フォーム (`forms/purchase-plan.ts`)

### 変更点

- `currentSavings` フィールドを削除（導出値になるため）
- `monthlySavings` → `monthlyTarget` にリネーム
- `purchasePlanSavingsSchema` を新規追加

```ts
export const purchasePlanSchema = z.object({
  makerId: z.string().min(1),
  makerName: z.string().min(1),
  modelId: z.string().min(1),
  modelName: z.string().min(1),
  targetPrice: z.number().positive(),
  monthlyTarget: z.number().positive(),
});

export const purchasePlanSavingsSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM 形式で入力してください'),
  amount: z.number().int().positive('正の値を入力してください'),
  memo: z.string().nullable(),
});

export type PurchasePlan = z.infer<typeof purchasePlanSchema>;
export type PurchasePlanSavingsInput = z.infer<typeof purchasePlanSavingsSchema>;
```

`calcPurchaseDate` は引数を `(targetPrice, currentSavings, monthlyTarget)` のまま維持（呼び出し側が SUM を渡す）。

## ストア (`store/purchase-plan.ts`)

AsyncStorage の `persist` をやめ、Supabase CRUD に全面置き換え。

```ts
type SavingsEntry = {
  id: string;
  yearMonth: string;
  amount: number;
  memo: string | null;
};

type PurchasePlanRecord = {
  id: string;
  makerId: string;
  makerName: string;
  modelId: string;
  modelName: string;
  targetPrice: number;
  monthlyTarget: number;
};

type PurchasePlanState = {
  plan: PurchasePlanRecord | null;
  savings: SavingsEntry[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  upsertPlan: (input: PurchasePlan) => Promise<void>;
  addSaving: (planId: string, input: PurchasePlanSavingsInput) => Promise<void>;
  updateSaving: (id: string, input: PurchasePlanSavingsInput) => Promise<void>;
  removeSaving: (id: string) => Promise<void>;
};
```

- `fetchAll`: `purchase_plans` と `purchase_plan_savings` を結合取得
- `upsertPlan`: `INSERT ... ON CONFLICT (user_id) DO UPDATE` で1行を維持
- `addSaving` / `updateSaving` / `removeSaving`: 通常の INSERT / UPDATE / DELETE

## 画面構成

### `app/(tabs)/purchase-plan.tsx`

変更なし。`PurchasePlanForm` を貼るだけ。

### `components/purchase-plan-form.tsx`（全面刷新）

3カード構成のスクロールビュー。

**計画カード（青）**
- 楽器ピッカー（InstrumentPicker）
- 目標金額・予定月額の数値入力
- 「保存」ボタン（`upsertPlan` を呼ぶ）
- plan が未登録の場合は計画カードのみ表示

**進捗カード（緑）**
- 現在の貯蓄額: `savings.reduce(...)` で全件合計
- プログレスバー: `currentSavings / targetPrice` の比率
- 購入予定時期: `calcPurchaseDate(targetPrice, currentSavings, monthlyTarget)`
- plan が登録済みの場合のみ表示

**貯蓄実績カード（橙）**
- 表示対象: 当月・前月のエントリのみ（`year_month >= prevMonthStr` でフィルター）
- 全件は DB に保持し、進捗の合計には含める
- 各エントリ行: 年月・金額・メモ・編集ボタン・削除ボタン
- 「＋ 追加」ボタン → `purchase-plan-savings-form` へスタック遷移（`planId` を渡す）
- 編集ボタン → 同フォームへ `planId` + `id` を渡して遷移
- plan が登録済みの場合のみ表示

### `app/purchase-plan-savings-form.tsx`（新規）

追加・編集で共用するスタック画面。

- URL params: `planId: string`（必須）、`id?: string`（編集時）
- フィールド: 年月（YYYY-MM テキスト入力）・金額（数値）・メモ（テキスト、任意）
- 追加モード: 年月のデフォルト値は当月（`new Date()` から生成）
- 編集モード: ストアから既存エントリを取得して初期値に設定
- 保存ボタン: 追加なら `addSaving`、編集なら `updateSaving`
- 削除ボタン: 編集モードのみ表示、`removeSaving` 後に前画面へ戻る

### `app/_layout.tsx`

Stack に `purchase-plan-savings-form` を追加。

## テスト方針

### unit (`forms/__tests__/purchase-plan.test.ts`)

- `purchasePlanSchema`: `monthlyTarget` リネーム後のバリデーション
- `purchasePlanSavingsSchema`: YYYY-MM 正規表現・amount 正の値・境界値
- `calcPurchaseDate`: 既存テストを維持

### unit (`store/__tests__/purchase-plan.test.ts`)

- `upsertPlan` / `addSaving` / `updateSaving` / `removeSaving` の状態遷移を `getState()` 直叩き
- Supabase はモック

### integration (`__tests__/integration/purchase-plan-form.integration.test.tsx`)

- 計画カード保存 → 進捗カード表示の経路を 1 件
- 当月・前月フィルターが機能すること（旧エントリが表示されないこと）を 1 件

### E2E

追加しない（既存フローなし、今回も対象外）。

## スコープ外

- 購入計画を複数持つ機能
- 2ヶ月より古い実績の閲覧・エクスポート
- 月次実績のグラフ表示
