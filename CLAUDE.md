# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## リポジトリの目的

クラリネット練習を記録・管理するための Expo アプリ。練習記録 (基礎練習: ロングトーン / タンギング、教則本進捗) と所有楽器・購入計画の管理を行う。

このリポジトリは Expo テンプレート (`expo-template` という package name と `reset-project` スクリプト) を起点に立ち上がっているが、現在はクラリネット練習アプリとして発展している。**新機能追加時はドメイン要件 (練習記録 / 教則本 / 楽器管理) を優先**し、テンプレート時代の「汎用性のために抽象化する」発想は基本適用しない。ただしテンプレート由来の品質基盤 (ESLint / Prettier / strict TS / 4 ステップ品質チェック / フォーム実装方針 / テスト方針) は維持する。

`reset-project` スクリプトはテンプレート由来のため残してあるが、本プロジェクトでは使用しない (実行するとドメインコードが `app-example/` に退避されてしまう)。

## Commands

```bash
npm start              # Start Expo dev server (opens QR for Expo Go / dev build)
npm run android        # Start and open on Android emulator
npm run ios            # Start and open on iOS simulator
npm run web            # Start and open in browser
npm run lint           # Run ESLint (eslint-config-expo + import sort + unused-imports)
npm run lint:fix       # Run ESLint with auto-fix
npm run format         # Run Prettier on the entire repo
npm run format:check   # Check Prettier formatting without writing
npm test               # Run Jest (jest-expo preset) once
npm run test:watch     # Run Jest in watch mode
npm run e2e:ios        # Run Maestro E2E flows on iOS Simulator (Expo Go / requires `npx expo start` running)
npm run e2e:android    # Run Maestro E2E flows on Android Emulator (Expo Go / requires `npx expo start` running)
npm run reset-project  # Move app/, components/, hooks/, constants/, scripts/ to app-example/ and recreate a blank app/ (store/ や assets/ は影響を受けない)
```

特定のテストだけ走らせる場合：

```bash
npx jest <pattern>         # ファイル / ディレクトリで絞る (例: forms, __tests__/integration/profile-form)
npx jest -t '<text>'       # describe / it 名 (部分一致) で絞る (例: -t 'rejects future dates')
npx jest --watch <pattern> # 上記を watch モードで
```

## 開発ワークフロー (新機能)

新機能追加・大きな変更をする際は、以下の 4 フェーズを順番に踏む。各フェーズは対応する superpowers スキルを Skill ツール経由で呼び出す。バグ修正・リファクタリングなど単発の小さな変更はこのフローに縛られず直接実装してよい。

| フェーズ | スキル                           | 入口条件                     | 出口条件                                                            |
| -------- | -------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| 設計     | `brainstorming`                  | 機能の追加・変更要求がある   | 設計 spec が `docs/superpowers/specs/` に保存され、ユーザが承認済み |
| 計画     | `writing-plans`                  | 設計 spec が承認済み         | 実装計画が `docs/superpowers/plans/` に保存され、ユーザが承認済み   |
| 実装     | `test-driven-development`        | 実装計画が承認済み           | すべてのタスクが完了、品質チェック 4 ステップを通過済み             |
| 完了     | `finishing-a-development-branch` | 実装が品質チェックを通過済み | PR 作成 or ブランチがレビュー待ち状態                               |

## コード品質チェック (毎回実施)

**作業完了時に必ず以下 4 ステップをすべて通してからコミットすること。**

```bash
npm run lint          # ESLint エラーが 0 件
npm run format:check  # Prettier 整形差分が 0 件
npx tsc --noEmit      # TypeScript 型エラーが 0 件
npm test              # Jest がすべてパス
```

差分があれば `npm run lint:fix` / `npm run format` で自動修正してから再実行。

## コミット運用

ユーザが「コミットしないで」と明示しない限り、各タスク完了時に Claude Code が自動でコミットする。手順:

1. **品質チェック 4 ステップを通す** (上記)
2. 関連ファイルだけを個別 `git add` する (`git add -A` / `git add .` は避ける)
3. 簡潔な日本語コミットメッセージで `git commit`
4. `pre-commit` フック (lint-staged) が `eslint --fix` / `prettier --write` / `jest --bail --findRelatedTests --passWithNoTests` を対象ファイルに自動適用する
5. push が必要かはユーザに確認してから実行する (無断で push しない)

## メタ規約

- コメント / コミットメッセージ / ドキュメントは**日本語が標準**。外部パッケージ由来の英語コメント／識別子はそのまま引用して構わない
- `app-example/` は `reset-project` が旧 `app/` を退避するための **gitignore 済み**ディレクトリ。fresh clone には存在しない (CLAUDE.md / README.md などで参照しないこと)

## Architecture

expo-router v6 のファイルベースルーティング。`app/_layout.tsx` が `<TamaguiProvider>` で `<Stack />` をラップし、`supabase.auth.onAuthStateChange` でセッション有無に応じて `(auth)/sign-in` または `(tabs)/` へリダイレクトする。`useColorScheme` で OS テーマに追従する。

ルートグループ:

- `app/(auth)/` — 認証フロー (sign-in / sign-up / forgot-password)。未認証時に遷移
- `app/(tabs)/` — メインタブ (index / equipment / purchase-plan / settings)。認証済み時に遷移

### Where do I add X

| 追加対象                  | 配置場所                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------- |
| 新しいフォーム            | `forms/<name>.ts` (zod + 純粋ヘルパー) + `components/<name>-form.tsx` (UI)              |
| 共通フォーム部品          | `components/form/` (テストは `components/form/__tests__/`)                              |
| 新しい Zustand ストア     | `store/<name>.ts` (1ファイル1ストア)                                                    |
| 認証フロー画面            | `app/(auth)/<route>.tsx`                                                                |
| メインタブ画面            | `app/(tabs)/<route>.tsx`                                                                |
| ユーティリティ / lib      | `lib/<name>.ts` (Supabase クライアントなど UI 非依存のモジュール)                       |
| 単体テスト                | 対象ディレクトリ直下の `__tests__/<name>.test.ts(x)` (forms/store/components/form 配下) |
| 結合テスト                | プロジェクトルートの `__tests__/integration/<feature>.integration.test.tsx`             |
| テスト共通ユーティリティ  | `test-utils/<name>.tsx` (例: `renderWithProviders` は `test-utils/render.tsx`)          |
| E2E (Maestro)             | `.maestro/<flow>.yaml`                                                                  |
| Tamagui token / theme     | `tamagui.config.ts`                                                                     |
| Supabase マイグレーション | `supabase/migrations/<timestamp>_<name>.sql`                                            |

### Key configuration

| Setting          | Value                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| New Architecture | enabled (`newArchEnabled: true` in app.json)                            |
| React Compiler   | enabled (`reactCompiler: true` in app.json)                             |
| Typed routes     | enabled (`typedRoutes: true` in app.json) — routes are statically typed |
| Web output       | static (`"output": "static"`)                                           |
| Path alias       | `@/*` → project root (e.g. `import Foo from "@/components/Foo"`)        |
| TypeScript       | strict mode                                                             |

### 重要な設計判断 (configファイルからは読み取れないもの)

- **Tamagui は最小構成**: `@tamagui/babel-plugin` / `@tamagui/metro-plugin` を意図的に未導入。React Compiler との両立とテンプレートの軽量性を優先。Web 静的出力の CSS 抽出最適化や production パフォーマンスが必要になった時点で追加検討
- **Tamagui shorthand only**: `tamagui.config.ts` の `onlyAllowShorthands: true` により `items` / `justify` / `text` / `bg` / `p` 等の shorthand を使う (`alignItems` / `justifyContent` 等は型エラー)。`flex` / `color` のように shorthand 未定義のものは full name で書く
- **`@testing-library/jest-native` は導入しない**: RNTL v12.4+ で組み込み matcher 化されているため
- **`@types/jest` は明示ロード**: `tsconfig.json` の `compilerOptions.types: ["jest"]` で型を取り込む
- **`tsc --noEmit` はそのまま通る**: `tsconfig.json` の `exclude` で `app-example/` を除外しているため、ワークアラウンド (`grep -v ...`) は不要
- **CI = ローカル品質チェック 4 ステップと同等**: `.github/workflows/ci.yml` で Node 20 環境の `npm ci` → lint → format:check → tsc → test を順に走らせる

### Notable dependencies (意思決定が含まれるもの)

- **`tamagui` / `@tamagui/config`** — クロスプラットフォーム UI。`@tamagui/config/v5` の `defaultConfig` をそのまま `createTamagui` に渡す
- **`react-hook-form` / `zod` / `@hookform/resolvers`** — フォーム + 検証。React Native では `Controller` 経由で Tamagui の `Input` / `Switch` をラップ (詳細は「フォームの実装方針」)
- **`zustand` v5** — グローバル状態 (詳細は「状態管理」)
- **`@react-native-async-storage/async-storage`** — Zustand `persist` のバックエンド。**`npx expo install` 経由**で SDK 互換版を導入する (`npm install` 直叩きしない)
- **`@react-native-community/datetimepicker`** — 日付ピッカー。**Web 非対応**のため `Platform.OS` で分岐し、Web では Tamagui `Input` への直接入力にフォールバック
- **`@supabase/supabase-js`** — 認証 + DB クライアント。シングルトンは `lib/supabase.ts`。認証エラーの日本語マッピングは `lib/auth-errors.ts`

## Supabase

### 環境変数

`.env.local` に以下を設定する (`.gitignore` 対象のため commit しない):

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

### 認証フロー

`app/_layout.tsx` の `supabase.auth.onAuthStateChange` がセッション変化を監視し、セッションなしなら `/(auth)/sign-in`、ありなら `/(tabs)/` へ自動遷移する。コンポーネント側で手動ルーティングは行わない。

### DB アクセスパターン

- `supabase.from('<table>').select/insert/update/delete` を Zustand ストアのアクション内で呼ぶ (コンポーネントから直接呼ばない)
- Supabase が返すスネークケース列 (`maker_id`) はストア内でキャメルケース (`makerId`) に変換してから state に格納する
- マイグレーションは `supabase/migrations/<timestamp>_<name>.sql` に追加。適用: `supabase db push` (リモート) または `supabase db reset` (ローカル)

### テストでのモック

`jest.setup.ts` で `@/lib/supabase` がグローバルモックされており、`supabase.auth.*` の各メソッドは `jest.fn()` になっている。結合テストでは `mockResolvedValueOnce` で戻り値を上書きして使う:

```ts
(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({ data: {}, error: null });
```

## フォームの実装方針

このテンプレートではフォームを **React Hook Form + zod + Tamagui** の組み合わせで実装する。

- バリデーションは zod スキーマで宣言 (`z.email()` などのトップレベル v4 構文)
- `useForm({ resolver: zodResolver(schema) })` がエントリポイント (resolver の import は `@hookform/resolvers/zod`)
- React Native では `register` は使えない。**必ず `Controller` で Tamagui の `Input` / `Switch` をラップ**する
- `mode: 'onTouched'` を初期値として推奨 (タッチ後はリアルタイム再検証)
- 数値入力は Input が string を返すため、Controller の `onChange` 側で `Number(t)` 化 (空文字 / NaN は `undefined` に正規化)。スキーマ側は `z.number().optional()` のままにする (`z.preprocess` を使うと `z.infer` の入力型が `unknown` になり `defaultValues` と型衝突するため避ける)
- 範囲チェックは zod の `.min()` / `.max()` を直接使う (`z.number().min(0).max(100)`)。連動する UI には Tamagui `Slider` を Controller でラップして value/onChange を配列で扱う
- 日付フィールドは **Tamagui `Input` を主体**として `YYYY-MM-DD` 文字列を保持する。スキーマは `z.string()` + `regex(/^\d{4}-\d{2}-\d{2}$/)` + `refine` で範囲チェック (`z.date()` を使うと Input の text と Date オブジェクトの二重管理になり煩雑)。範囲チェックの refine 内で文字列を Date に変換するヘルパー (`parseYmd`) を定義して再利用する
- 入力補助として `@react-native-community/datetimepicker` の `DateTimePicker` を使用。`showPicker` state を `Controller` の外で持ち、ボタン押下で表示。ピッカー結果は `formatDate(d)` で `YYYY-MM-DD` 文字列に整形してから `onChange` に渡す (タイムゾーン依存を避けるため `Date` 文字列の直接結合は使わない)
- `Platform.OS === 'web'` ではピッカー起動ボタンと `<DateTimePicker>` を描画しない (ライブラリが Web 非対応のため)
- 「true 必須」のチェックは `z.boolean().refine((v) => v === true, ...)` を使う (`z.literal(true)` だと推論型が `true` 固定になり `defaultValues` で `false` を渡せなくなる)
- **zod スキーマと date ヘルパー (`parseYmd` / `formatDate` / `today`) は `forms/` 配下にモジュールとして切り出す** (例: `forms/profile.ts`)。UI 非依存にして単体テスト可能にする。route ファイルからは `import { profileSchema, parseYmd, formatDate } from '@/forms/profile'`
- フォーム共通コンポーネント (例: 必須エラー表示) は **`components/form/` に配置**。シンプルなものはテスト容易性と再利用のために早めに切り出して構わない (`FieldError` がその例)
- 参照実装: `components/profile-form.tsx` + `forms/profile.ts` + `components/form/field-error.tsx`。route ファイル (例: `app/practice-log-form.tsx`) からは対応するフォームコンポーネントを貼るだけにする (page と form の責務分離)

## 状態管理 (Zustand)

グローバル状態は **Zustand v5** で管理。Redux 系の boilerplate を避け、selector ベースで必要な値だけを購読する方針。

- ストアはプロジェクトルートの `store/` に **1 ストア = 1 ファイル**で配置 (`store/counter.ts`, `store/settings.ts` など)。import は `@/store/<name>`
- 型は curried 形 `create<State>()((set, get) => ({...}))` を使う (公式 v5 の TypeScript 推奨形)。型注釈ファースト
- 利用側は **selector を 1 つずつ呼ぶ** (`const x = useFooStore((s) => s.x)`)。オブジェクト分割代入は不要な再レンダーを生むため避ける
- アクションは状態と同じストア内に同梱する (`set` / `get` を閉じ込める)。コンポーネント側からはセレクタ経由で関数を取り出して呼ぶ
- 永続化が必要なストアは `persist` middleware + `createJSONStorage(() => AsyncStorage)` を使う。`name` はプロジェクト固有のプレフィックス付きで重複を避ける (例: `expo-template-settings`)
- middleware は `persist` のみ採用。`devtools` / `immer` / `subscribeWithSelector` 等は必要になった時点で個別検討
- 参照実装: `store/counter.ts` (非永続) / `store/settings.ts` (永続化 + UI 連携) / `store/practice-log.ts` (Supabase 連携、スネークケース → キャメルケース変換、CRUD アクション)
- ストアが小さいうちはスライス分割やラッパーを作らない (過剰抽象化を避ける)
- 単体テストは `store/__tests__/` に配置し、`useFooStore.getState()` を直接叩いて状態遷移を検証する (UI レンダリング不要のため `renderHook` 不使用)。`persist` を使うストアは `jest.setup.ts` の AsyncStorage 公式モックが自動適用されるため追加設定不要

## テスト方針

### テスト戦略マトリクス

このプロジェクトは **Tamagui をモックしない** (`jest.setup.ts` でモックするのは AsyncStorage のみ) ため、UI を含む結合テストが実物の Tamagui + RHF + zod + Zustand を貫通する。結果として「結合テストの信頼性が高い」「単体は純粋ロジック専用に絞れる」という非対称が生まれる。以下の責務分担はこの前提に立つ。

#### ライブラリ別の検証責務

| ライブラリ / 関心事          | unit (`__tests__/`)                              | integration (`__tests__/integration/`)                               | E2E (`.maestro/`)                |
| ---------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------- |
| zod スキーマ                 | **網羅** (各 path × valid/invalid、境界値、複合) | スモーク 1 件 (空送信でエラーが画面表示される)                       | やらない                         |
| 日付ヘルパー (`parseYmd` 等) | **網羅** (round-trip / malformed)                | やらない                                                             | やらない                         |
| RHF + Controller の配線      | やらない                                         | **担当** (`onTouched` 挙動 / reset / `onSubmit` 引数の最終形)        | やらない                         |
| Tamagui Input/Switch/Slider  | コンポーネント単体の見た目だけ (例: FieldError)  | **担当** (`fireEvent.changeText` / `press` で実 Tamagui を経由)      | やらない                         |
| Zustand ストアの状態遷移     | **担当** (`getState()` 直叩き)                   | UI 起点の更新 1 経路のみ (副作用確認)                                | やらない                         |
| `persist` + AsyncStorage     | ラウンドトリップ + rehydrate + 異常系を **網羅** | UI 操作後に 1 件だけ書き込み確認 (経路の生存確認)                    | 実機でのみ (cold start 後の復元) |
| ネイティブ `Alert.alert`     | やらない                                         | `jest.fn()` を `onSubmit` prop に注入して**副作用を分離**            | タイトル `assertVisible` のみ    |
| `Platform.OS === 'web'` 分岐 | ロジック側で純粋関数化していれば unit            | やらない (jest 環境は native を想定)                                 | やらない                         |
| DateTimePicker 起動 UI       | やらない (ライブラリ自体はテスト対象外)          | やらない (Web では描画されない / native では実 OS picker のため不可) | 必要なら native E2E              |

#### unit と integration の使い分け基準

- **`getState()` 直叩き unit を選ぶ**: 状態遷移・persist 異常系・rehydrate のように UI を介在させると本質がぼやける検証。`renderHook` は使わない
- **UI 経由 integration を選ぶ**: ユーザ操作 → state → UI 反映の**経路全体**を 1 つでも踏むと意味がある検証 (= 配線ミスが本番でだけ起きるリスクがある経路)
- 同じアサーション (例: `volume=63` の格納) を unit と integration で**両方書かない**。integration は「経路が生きていること」を 1 件示せばよく、値の網羅は unit に任せる

#### 30 秒判断フローチャート

新機能のテスト配置で迷ったら上から順に当てはめる:

1. **純粋関数 / zod スキーマ / 日付ヘルパー** → `<dir>/__tests__/<name>.test.ts` に unit (網羅)
2. **Zustand ストアのアクション・persist 単体** → `store/__tests__/<name>.test.ts` で `getState()` 直叩き
3. **共通 UI 部品 (props だけで自己完結)** → `components/<area>/__tests__/<name>.test.tsx` で `renderWithProviders`
4. **RHF / Zustand / Tamagui のうち 2 つ以上が連携する画面の挙動** → `__tests__/integration/<feature>.integration.test.tsx`
5. **ネイティブ Alert / 実 AsyncStorage の cold start 復元 / 実機タップで初めて再現する経路** → `.maestro/<flow>.yaml`
6. 上のいずれにも当てはまらない場合は**テストを増やさない** (重複の兆候)

#### よくある反パターン

- zod の境界値網羅を integration で `fireEvent.changeText` を使って書く (unit で十分。再実行コストだけ増える)
- ストアの `setVolume(75)` を unit と integration の両方で値検証する (integration は経路確認のみで十分)
- `Alert.alert` の本文文字列を E2E で検証する (UiAutomator hierarchy に出ないことがある。本文は unit / integration 側で確認)
- `renderHook` で Zustand を駆動する (このテンプレートでは `getState()` で足りるため不要)

### 単体テスト (unit) — 対象モジュールを 1 つだけ呼ぶ

- 配置: 対象ディレクトリ直下の `__tests__/` (`forms/__tests__/`, `components/form/__tests__/`, `store/__tests__/`)
- 検証対象: 純粋関数 (zod スキーマ / date ヘルパー)、単一コンポーネントの render、Zustand ストアの状態遷移
- 命名: `<name>.test.ts(x)`

### 結合テスト (integration) — 複数モジュールが連携する経路

- 配置: プロジェクトルートの `__tests__/integration/`
- 命名: `<feature>.integration.test.tsx` (拡張子で単体と区別する)
- 参照実装:
  - `profile-form.integration.test.tsx`: **RHF + zod + Tamagui Input/Switch + FieldError** の連携 (`fireEvent.changeText` / `fireEvent.press` でユーザ操作を再現し、エラー表示と `onSubmit` 呼び出しを検証)
  - `settings-card.integration.test.tsx`: **Tamagui UI + Zustand + persist + AsyncStorage** のラウンドトリップ (UI 操作 → store 更新 → AsyncStorage 書き込みの一連)
  - `textbook-progress-modal.integration.test.tsx`: **画面 + モーダル + Zustand + Supabase モック** を貫通する非自明な経路 (`@/lib/supabase` を `jest.mock` で個別差し替え、`from()` のチェーンを `mockResolvedValueOnce` でモック)。モーダル経由で外部 API を叩く UI を検証する時の参照
- 必ず `renderWithProviders` で `TamaguiProvider` をラップする
- `onSubmit` 等の副作用は **`jest.fn()` を prop 経由で注入**して検証する (本番コンポーネントは `Alert.alert` などのデフォルト動作を持つ)
- 結合テストでは Zustand ストアの状態をテスト間で持ち越さないよう `beforeEach` で `setState` リセット + `AsyncStorage.clear()` する

### E2E テスト (Maestro)

実機 / シミュレータでの起動とハッピーパスのみ。EAS は使わず Expo Go 経由でローカル実行する。**ユーザ向け実行手順 (CLI 導入 / Java 17+ / tunnel + DEEPLINK 注入) は README.md を参照**。

#### 追加判断基準

- 単体・結合テストでカバー済みの内容 (バリデーション網羅、AsyncStorage への書き込み単独) は E2E に含めない
- **実機ネイティブ起動でしか検証できない経路**のみ追加 (ネイティブ Alert 表示、実 AsyncStorage の永続化ラウンドトリップ等)
- セレクタは可視テキスト / `placeholder` / `aria-label` を最優先。同じ文字列が複数要素にある場合のみ `testID` を追加
- フローは `appId: ${APP_ID}` ヘッダ + `openLink: ${DEEPLINK || 'exp://localhost:8081'}` で揃える
- CI 連携はスコープ外 (シミュレータ起動コストが大きいため。コード品質チェック 4 ステップだけ CI で担保)

#### Maestro 落とし穴 (Claude が知らないと事故る)

- **`inputText` は ASCII 限定**: Maestro が adb の Unicode 入力に非対応。日本語のテストデータは `Test Taro` 等に置き換える
- **`pressKey: Back` は使わない**: keyboard が閉じている時に Expo Go から抜けてしまう。キーボードが残ったままでも次の `scrollUntilVisible` / `tapOn` で問題ない
- **`Alert.alert` 本文は UiAutomator hierarchy に出ないことがある**: タイトルだけ `assertVisible` する (本文の値検証は単体／結合側で担保)
- **画面下要素は `assertVisible` 単独では見えない**: `scrollUntilVisible` で都度スクロールする
- **初回 cold bundle build (特に tunnel 経由) で 1〜3 分かかる**: 最初のアサートは `extendedWaitUntil ... timeout: 180000` で長めに
- **連続フローでスクロール位置が残る**: 必要なら冒頭で `swipe` を `repeat` して上端に戻す

### 共通ガイドライン

- 要素の取得は **placeholder / 文字列 / aria-label** など利用者視点のクエリを優先し、`testID` は表示テキストを持たない要素 (Slider 等) や Maestro セレクタが衝突する箇所に絞る
- 非同期検証は `waitFor` を使う (RHF の zod 検証は async)。`act` は store の同期更新には不要だが、外部から `setState` する場合は警告抑止のため使う
- テスト失敗時の根本対応は実装/テスト両方を疑う — 「動かないからテストを消す」は禁止
