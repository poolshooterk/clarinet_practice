# テスト実装ガイド

テスト戦略の概要・30秒判断フローチャート・反パターンはルートの `CLAUDE.md` を参照。ここでは実装時の詳細を記載する。

## 単体テスト (unit)

- 配置: 対象ディレクトリ直下の `__tests__/` (`forms/__tests__/`, `components/form/__tests__/`, `store/__tests__/`)
- 検証対象: 純粋関数 (zod スキーマ / date ヘルパー)、単一コンポーネントの render、Zustand ストアの状態遷移
- 命名: `<name>.test.ts(x)`

## 結合テスト (integration)

- 配置: プロジェクトルートの `__tests__/integration/`
- 命名: `<feature>.integration.test.tsx` (拡張子で単体と区別する)
- 参照実装:
  - `profile-form.integration.test.tsx`: **RHF + zod + Tamagui Input/Switch + FieldError** の連携 (`fireEvent.changeText` / `fireEvent.press` でユーザ操作を再現し、エラー表示と `onSubmit` 呼び出しを検証)
  - `settings-card.integration.test.tsx`: **Tamagui UI + Zustand + persist + AsyncStorage** のラウンドトリップ (UI 操作 → store 更新 → AsyncStorage 書き込みの一連)
  - `textbook-progress-modal.integration.test.tsx`: **画面 + モーダル + Zustand + Supabase モック** を貫通する非自明な経路 (`@/lib/supabase` を `jest.mock` で個別差し替え、`from()` のチェーンを `mockResolvedValueOnce` でモック)。モーダル経由で外部 API を叩く UI を検証する時の参照
- 必ず `renderWithProviders` で `TamaguiProvider` をラップする
- `onSubmit` 等の副作用は **`jest.fn()` を prop 経由で注入**して検証する (本番コンポーネントは `Alert.alert` などのデフォルト動作を持つ)
- 結合テストでは Zustand ストアの状態をテスト間で持ち越さないよう `beforeEach` で `setState` リセット + `AsyncStorage.clear()` する

## 共通ガイドライン

- 要素の取得は **placeholder / 文字列 / aria-label** など利用者視点のクエリを優先し、`testID` は表示テキストを持たない要素 (Slider 等) や Maestro セレクタが衝突する箇所に絞る
- 非同期検証は `waitFor` を使う (RHF の zod 検証は async)。`act` は store の同期更新には不要だが、外部から `setState` する場合は警告抑止のため使う
- テスト失敗時の根本対応は実装/テスト両方を疑う — 「動かないからテストを消す」は禁止
- **当月フィルタ画面の fixture は固定日付を使わない**: 画面が `today()` で当月のレコードに絞り込む系 (`app/(tabs)/index.tsx` / `app/(tabs)/lesson.tsx` 等) の結合テストは、fixture の日付を `today()` から導出する (例: `` `${today().slice(0, 7)}-15T...` ``)。固定の過去日付にすると実時刻の経過で当月フィルタから外れ、ある月を境に突然落ちる時刻依存テストになる
