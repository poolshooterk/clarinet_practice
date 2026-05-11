# クラリネット楽器情報 v2 設計仕様

## 概要

楽器情報フォームにメーカー・機種名のチップ選択UI・購入金額フィールドを追加し、独立した「購入計画」タブを新設する。メーカー・機種名リストはSupabaseで管理し、Zustandでキャッシュする。

---

## 要件

### 楽器カードの拡張

- B♭クラリネット固定（楽器種別の選択は不要）
- メーカーをチップ一覧から選択する（Supabase管理、ユーザー追加可能）
- メーカー選択後に機種名チップが展開される（選択中メーカーに紐づくもの）
- 機種名をチップ一覧から選択する（Supabase管理、ユーザー追加可能）
- 購入金額（任意）フィールドを追加

### 購入計画タブ（新規）

- ボトムナビに5番目のタブ（💰 購入計画）を追加
- 欲しい楽器のメーカー・機種名をチップ選択（楽器カードと同じUI）
- 目標金額・現在の貯蓄額・月あたり貯蓄額を入力
- 入力値からリアルタイムで購入可能時期を算出・表示（保存ボタン不要）
- 入力値はZustandに自動保存（再訪時に復元）

---

## アーキテクチャ

### 方針

- `InstrumentPicker` を共通コンポーネントとして切り出し、楽器カードと購入計画フォームの両方で使用
- メーカー・機種名リストはSupabaseから初回取得後にZustand + AsyncStorageでキャッシュ
- ユーザーが追加した項目はSupabaseにinsertしてからキャッシュを更新
- 購入可能日は `calcPurchaseDate` ヘルパー（純粋関数）で算出
- 購入計画フォームはRHF `onChange` モード + `watch()` でリアルタイム算出、`useEffect` でZustand自動保存

### Supabaseテーブル

```sql
-- メーカーテーブル
create table instrument_makers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- 機種名テーブル
create table instrument_models (
  id uuid primary key default gen_random_uuid(),
  maker_id uuid not null references instrument_makers(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique(maker_id, name)
);
```

初期データ（マイグレーションで投入）：

| メーカー       | 機種名                        |
| -------------- | ----------------------------- |
| Buffet Crampon | R13, E11, Prestige, RC, Tosca |
| Yamaha         | YCL-650, YCL-SEV, YCL-CSVR    |
| Selmer         | Series 10, Privilege          |

---

## ファイル構成

### 新規作成

| ファイル                            | 責務                                                          |
| ----------------------------------- | ------------------------------------------------------------- |
| `components/instrument-picker.tsx`  | メーカー→機種名チップ選択UI                                   |
| `store/instrument-catalog.ts`       | メーカー・機種名キャッシュ + Supabaseフェッチ・追加アクション |
| `forms/purchase-plan.ts`            | 購入計画zodスキーマ + `calcPurchaseDate` ヘルパー             |
| `store/purchase-plan.ts`            | 購入計画入力値の永続ストア                                    |
| `components/purchase-plan-form.tsx` | 購入計画フォームUI                                            |
| `app/(tabs)/purchase-plan.tsx`      | 購入計画タブ画面                                              |

### 変更

| ファイル                        | 変更内容                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `forms/equipment.ts`            | `instrument`スキーマに`makerId`・`modelId`（必須）・`purchasePrice`（任意）を追加。`name`フィールドを削除 |
| `components/equipment-form.tsx` | 楽器セクションで`InstrumentPicker`使用、購入金額フィールド追加                                            |
| `store/equipment.ts`            | `instrument`型を更新                                                                                      |
| `app/(tabs)/_layout.tsx`        | 💰 購入計画タブを追加                                                                                     |

---

## 詳細設計

### InstrumentPicker コンポーネント

```tsx
type InstrumentPickerValue = {
  makerId: string;
  makerName: string;
  modelId: string;
  modelName: string;
};

type Props = {
  value: InstrumentPickerValue | null;
  onChange: (value: InstrumentPickerValue) => void;
};
```

- `instrument-catalog` ストアからメーカーリストを取得して表示
- メーカーチップをタップすると選択状態になり、そのメーカーの機種名チップが展開
- 「＋追加」チップをタップするとAlertで名前入力→Supabaseにinsert→キャッシュ更新
- 選択済みチップはハイライト（青背景・白テキスト）、未選択は`$backgroundHover`

### instrument-catalog ストア

```ts
type InstrumentCatalogState = {
  makers: { id: string; name: string }[];
  models: { id: string; makerId: string; name: string }[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  addMaker: (name: string) => Promise<void>;
  addModel: (makerId: string, name: string) => Promise<void>;
};
```

- `persist` middleware + AsyncStorage でキャッシュ
- `fetchAll` は楽器情報タブ・購入計画タブのマウント時に `useFocusEffect`（expo-router）で呼ぶ。キャッシュがあれば即座に表示し、バックグラウンドで最新化
- Supabaseエラー時はキャッシュがあればそのまま使用、なければ空配列

### forms/equipment.ts の変更

```ts
// 変更前
instrument: z.object({ name: z.string().min(1), startDate: z.string()... })

// 変更後
instrument: z.object({
  makerId: z.string().min(1, 'メーカーを選択してください'),
  makerName: z.string().min(1),
  modelId: z.string().min(1, '機種名を選択してください'),
  modelName: z.string().min(1),
  purchasePrice: z.number().optional(),
  startDate: z.string()...,  // 既存のバリデーション維持
})
```

### forms/purchase-plan.ts

```ts
export const purchasePlanSchema = z.object({
  makerId: z.string().min(1, 'メーカーを選択してください'),
  makerName: z.string().min(1),
  modelId: z.string().min(1, '機種名を選択してください'),
  modelName: z.string().min(1),
  targetPrice: z.number({ required_error: '目標金額を入力してください' }).positive(),
  currentSavings: z.number({ required_error: '現在の貯蓄額を入力してください' }).min(0),
  monthlySavings: z.number({ required_error: '月あたりの貯蓄額を入力してください' }).positive(),
});

export type PurchasePlan = z.infer<typeof purchasePlanSchema>;

export function calcPurchaseDate(
  targetPrice: number,
  currentSavings: number,
  monthlySavings: number,
): { months: number; yearMonth: string } | null {
  if (monthlySavings <= 0) return null;
  const remaining = targetPrice - currentSavings;
  if (remaining <= 0) return { months: 0, yearMonth: '今すぐ購入可能' };
  const months = Math.ceil(remaining / monthlySavings);
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return { months, yearMonth: `${y}年${m}月ごろ` };
}
```

### purchase-plan ストア

```ts
type PurchasePlanState = {
  plan: PurchasePlan | null;
  setPlan: (plan: PurchasePlan) => void;
};
```

- `persist` + AsyncStorage
- ストア名: `'clarinet-practice-purchase-plan'`

### purchase-plan-form.tsx

- RHF `mode: 'onChange'`
- `watch()` で全フィールドを購読し `calcPurchaseDate` を呼ぶ
- `useEffect` で `watch` 値が変わったら `setPlan()` を呼びZustandに自動保存
- 金額フィールドは `Controller` + `Input` で文字列→数値変換（`Number(t) || undefined`）
- `InstrumentPicker` で欲しい楽器を選択

---

## テスト方針

### Unit テスト

| ファイル                                     | 内容                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `forms/__tests__/purchase-plan.test.ts`      | `calcPurchaseDate` の境界値（残額0・月貯蓄0・通常ケース・購入可能日の月計算精度） |
| `forms/__tests__/equipment.test.ts`          | 更新後スキーマの`makerId`/`modelId`必須・`purchasePrice`任意の valid/invalid      |
| `store/__tests__/instrument-catalog.test.ts` | `addMaker`/`addModel` のキャッシュ更新（Supabaseはjest.fn()モック）               |
| `store/__tests__/purchase-plan.test.ts`      | `setPlan` の状態遷移                                                              |

### Integration テスト

| ファイル                                                        | 内容                                                                                                          | 新規/更新                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `__tests__/integration/equipment-form.integration.test.tsx`     | `InstrumentPicker`でメーカー・機種名選択→保存できる経路（`instrument-catalog`ストアに初期データを直接セット） | **更新**（既存ファイル） |
| `__tests__/integration/purchase-plan-form.integration.test.tsx` | 金額入力→購入可能時期がリアルタイムで表示される経路                                                           | **新規**                 |

### 既存テストへの影響

- `forms/__tests__/equipment.test.ts` — `instrument.name` → `makerId`/`modelId`/`makerName`/`modelName` の変更に伴い、既存テストケースを全面更新する（**既存ファイルを更新**）
- `__tests__/integration/equipment-form.integration.test.tsx` — 同上。`name`フィールドのテストを`InstrumentPicker`経由の選択テストに置き換える

---

## 未対応スコープ（将来対応）

- 購入計画の履歴管理
- リード・リガチャー・マウスピースの機種選択UI（今回は楽器のみ）
- Supabase RLS（Row Level Security）設定
