# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## リポジトリの目的

クラリネット練習を記録・管理するための Expo アプリ。練習記録 (基礎練習: ロングトーン / タンギング、教則本進捗) と所有楽器・購入計画の管理を行う。

このリポジトリは Expo テンプレート (`reset-project` スクリプト) を起点に立ち上がっているが、現在はクラリネット練習アプリとして発展している。**新機能追加時はドメイン要件 (練習記録 / 教則本 / 楽器管理) を優先**し、テンプレート時代の「汎用性のために抽象化する」発想は基本適用しない。ただしテンプレート由来の品質基盤 (ESLint / Prettier / strict TS / 4 ステップ品質チェック / フォーム実装方針 / テスト方針) は維持する。

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

EAS Build (dev server 不要の実機配布用 APK):

```bash
eas build --platform android --profile preview  # クラウドで APK をビルド
eas secret:list                                  # 登録済み EAS シークレット一覧
eas secret:create --scope project --name KEY --value VALUE  # シークレット追加
```

特定のテストだけ走らせる場合：

```bash
npx jest <pattern>         # ファイル / ディレクトリで絞る (例: forms, __tests__/integration/profile-form)
npx jest -t '<text>'       # describe / it 名 (部分一致) で絞る (例: -t 'rejects future dates')
npx jest --watch <pattern> # 上記を watch モードで
```

WSL2 環境での既知の caveat:

- `npm run lint` (= `expo lint`) はハングすることがある。変更ファイルだけ確認したい場合は `npx eslint <files>` を直接呼ぶのが確実
- `npx jest` の並列実行は WSL2 のリソース競合で integration テスト (`__tests__/integration/`) が flaky に落ちる。確実に通したいときは `npx jest --runInBand` を使う (時間はかかるが CI と同等の信頼性)
- `.husky/pre-commit` の実行属性が落ちると `git commit` 時に `The '.husky/pre-commit' hook was ignored because it's not set as executable.` の warning と共に lint-staged がスキップされる (= コミット運用 手順 4 のセーフティネットが効かない)。`git update-index --chmod=+x .husky/pre-commit` で復元する

## ビジュアルコンパニオン (WSL2 環境)

`brainstorming` スキルのビジュアル画面を WSL2 から Windows ブラウザで開く手順:

```bash
# WSL2 の IP を取得してサーバーを起動する
WSL_IP=$(ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d/ -f1)
~/.claude/skills/brainstorming/scripts/start-server.sh \
  --project-dir /home/kasahara/expo/clarinet_practice \
  --host 0.0.0.0 \
  --url-host "$WSL_IP"
```

起動後に表示される `url` (例: `http://172.x.x.x:PORT`) を Windows ブラウザで開く。`localhost` では接続できないため必ず WSL2 IP を使うこと。

## 開発ワークフロー (新機能)

新機能追加・大きな変更をする際は、以下の 4 フェーズを順番に踏む。各フェーズは対応する superpowers スキルを Skill ツール経由で呼び出す。バグ修正・リファクタリングなど単発の小さな変更はこのフローに縛られず直接実装してよい。

| フェーズ | スキル                           | 入口条件                     | 出口条件                                                            |
| -------- | -------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| 設計     | `brainstorming`                  | 機能の追加・変更要求がある   | 設計 spec が `docs/superpowers/specs/` に保存され、ユーザが承認済み |
| 計画     | `writing-plans`                  | 設計 spec が承認済み         | 実装計画が `docs/superpowers/plans/` に保存され、ユーザが承認済み   |
| 実装     | `test-driven-development`        | 実装計画が承認済み           | すべてのタスクが完了、品質チェック 4 ステップを通過済み             |
| 完了     | `finishing-a-development-branch` | 実装が品質チェックを通過済み | `main` 直コミット (個人開発の標準). PR は公開時など必要に応じて作成 |

`docs/superpowers/` 配下は spec / plan の保管庫。命名規約はそれぞれ:

- `docs/superpowers/specs/<YYYY-MM-DD>-<slug>-design.md` (設計フェーズの成果物)
- `docs/superpowers/plans/<YYYY-MM-DD>-<slug>.md` (計画フェーズの成果物)

同一機能の spec / plan は同じ `<slug>` で対応する (`practice-log-design.md` ↔ `practice-log.md` 等)。過去の機能追加経緯を把握したい場合はここを `grep` する。

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

## ブランチ運用 (本リポジトリ固有)

本リポジトリは個人開発のため `main` 単一ブランチ運用。リモートにも `main` のみが存在する。

- グローバル `~/.claude/CLAUDE.md` の「develop ブランチから feature ブランチを切る」ルールは本リポジトリでは**適用しない**
- 指示がない限り `main` 上で直接作業・コミットして構わない (`git pull origin develop` も不要)
- feature ブランチを切るかどうかは作業規模に応じてユーザが都度指示する

## メタ規約

- コメント / コミットメッセージ / ドキュメントは**日本語が標準**。外部パッケージ由来の英語コメント／識別子はそのまま引用して構わない
- `app-example/` は `reset-project` が旧 `app/` を退避するための **gitignore 済み**ディレクトリ。fresh clone には存在しない (CLAUDE.md / README.md などで参照しないこと)

## Architecture

expo-router v6 のファイルベースルーティング。`app/_layout.tsx` が `<TamaguiProvider>` で `<Stack />` をラップし、`supabase.auth.onAuthStateChange` でセッション有無に応じて `(auth)/sign-in` または `(tabs)/` へリダイレクトする。`useColorScheme` で OS テーマに追従する。

ルートグループ:

- `app/(auth)/` — 認証フロー (sign-in / sign-up / forgot-password / reset-password-otp / reset-password)。未認証時に遷移
- `app/(tabs)/` — メインタブ (index / lesson / equipment / annual-goals / purchase-plan / settings)。認証済み時に遷移
- `app/practice-log-form.tsx` — 練習記録フォーム画面 (スタック遷移)
- `app/lesson-record-form.tsx` — レッスン記録フォーム画面 (スタック遷移)
- `app/textbook-form.tsx` — 教本登録/編集フォーム画面 (スタック遷移)
- `app/textbooks.tsx` — 教本一覧画面 (スタック遷移)
- `app/accessories.tsx` — 消耗品管理画面 (スタック遷移)
- `app/purchase-plan-savings-form.tsx` — 貯蓄実績追加/編集/削除フォーム画面 (スタック遷移)
- `app/annual-goal-form.tsx` — 年間目標 登録/編集フォーム画面 (スタック遷移)
- `app/annual-goal-detail.tsx` — 年間目標詳細 (12ヶ月マイルストーン一覧) 画面 (スタック遷移)
- `app/monthly-milestone-form.tsx` — 月別マイルストーン編集フォーム画面 (スタック遷移)

### Where do I add X

| 追加対象                  | 配置場所                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| 新しいフォーム            | `forms/<name>.ts` (zod + 純粋ヘルパー) + `components/<name>-form.tsx` (UI)                  |
| 共通フォーム部品          | `components/form/` (テストは `components/form/__tests__/`)                                  |
| 新しい Zustand ストア     | `store/<name>.ts` (1ファイル1ストア)                                                        |
| 認証フロー画面            | `app/(auth)/<route>.tsx`                                                                    |
| メインタブ画面            | `app/(tabs)/<route>.tsx`                                                                    |
| ユーティリティ / lib      | `lib/<name>.ts` (Supabase クライアントなど UI 非依存のモジュール)                           |
| 単体テスト                | 対象ディレクトリ直下の `__tests__/<name>.test.ts(x)` (forms/store/components/form/app 配下) |
| 結合テスト                | プロジェクトルートの `__tests__/integration/<feature>.integration.test.tsx`                 |
| テスト共通ユーティリティ  | `test-utils/<name>.tsx` (例: `renderWithProviders` は `test-utils/render.tsx`)              |
| E2E (Maestro)             | `.maestro/<flow>.yaml`                                                                      |
| Tamagui token / theme     | `tamagui.config.ts`                                                                         |
| Supabase マイグレーション | `supabase/migrations/<timestamp>_<name>.sql`                                                |

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
- **`<Theme name="blue">` でデフォルト Button がブルーアクセントになる**: `app/_layout.tsx` の `<TamaguiProvider>` 直下で `<Stack>` を `<Theme name="blue">` でラップしている。`theme="red"` など明示指定されたものは変更されない
- **EAS Build は `.env.local` を読まない**: `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` は開発時 `.env.local` 経由で参照されるが、EAS Build ではこのファイルが無視される。`eas secret:create --scope project` で EAS シークレットに登録しないとビルドされた APK が起動時にクラッシュする
- **E2E の APP_ID は環境依存**: `e2e:android` スクリプトの `APP_ID=host.exp.exponent` は Expo Go 専用。preview ビルドをインストールした実機に対して Maestro を実行する場合は `APP_ID=com.keikei.clarinetpractice` を指定する
- **練習記録は `(user_id, practiced_at)` で同日 1 件のみ**: DB 側に UNIQUE 制約 `practice_sessions_user_id_practiced_at_key`。新規 vs 編集モードは `app/practice-log-form.tsx` で URL params `?id=` の有無により 1:1 に確定し、フォーム内での日付変更や同日既存検出による自動切替は **行わない**。新規モードでの未来日 (`practicedAt > today()`) は zod schema が弾く。新規モードで既存日付と被るデータを submit した場合は Postgres `23505` を `classifyError` (`store/practice-log.ts`) が `'duplicate'` reason に変換し、Alert で「一覧から該当の記録を選んで編集してください」と案内する。新機能で別経路から `practice_sessions` へ INSERT を増やす場合はこの不変条件を踏まえる
- **練習記録フォーム表示時は教本カタログ・練習記録を必ず再フェッチ**: `app/practice-log-form.tsx` の `useFocusEffect` で `useTextbookCatalogStore.getState().fetchAll()` / `usePracticeLogStore.getState().fetchAll()` を呼ぶ。教本カタログが空のまま `<Select>` を render すると、選択中 textbook の UUID がトリガーにそのまま露出する (Tamagui `Select.Value` は `Select.Item` の `ItemText` 解決に失敗すると value 文字列を表示するため)
- **録音は 3 点セットで成立する**: ① `lib/recording.ts` の `Audio.setAudioModeAsync` は Android キー (`interruptionModeAndroid: DoNotMix` / `staysActiveInBackground` / `shouldDuckAndroid: false` 等) を必ず渡す ② `components/form/recording-section.tsx` の `RecordingSection` は録音中だけ `activateKeepAwakeAsync('clarinet-recording')` で画面スリープを抑止し pause / stop / unmount で `deactivateKeepAwake('clarinet-recording')` ③ `app.json` の Android `permissions` に `WAKE_LOCK` / `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_MICROPHONE` を含める。どれかを欠くと Android で 2 分前後で録音内容が無音になる回帰が再発する。`app.json` permission 変更は OTA 不可なので `eas build --platform android --profile preview` で APK を再ビルドする必要がある
- **録音の再生は同時に 1 つだけ**: `components/form/recording-section.tsx` の `RecordingSectionNative` が `playingKey: string | null` を保持して「いま再生中のカード」を 1 つだけ追跡する。各 `RecordingCard` は再生開始時に `onPlayStart(recordingKey)` で親 state を上書きし、`isActive=false` への遷移を `useEffect` で検知して自分の `Sound.pauseAsync()` を呼ぶ。これは同一 `RecordingSection` インスタンス内の排他であり、別画面の `RecordingSection` とは独立 (グローバル単一インスタンスではない)。別経路で録音を再生する UI を増やす場合は、同じく親側で `playingKey` を持って `RecordingCard` に `isActive` / `onPlayStart` / `onPlayEnd` を渡す配線を踏襲する
- **マイルストーンフォームは新規/編集モードを開いた時点で固定する**: `app/monthly-milestone-form.tsx` は `useRef` で初回 (goal 取得時) に `existing` を一度だけスナップショットし、`isEdit` / `defaultValues` / `<Stack.Screen>` の `title` をそれに紐付ける。`useMemo` で `goals` から `existing` を毎レンダー再解決すると、新規保存 (`upsertMilestone`) でストアに milestone が追加された瞬間に月一致で `existing` が解決され `isEdit` が false→true へ反転し、ヘッダータイトルが `router.back()` の最中に書き換わって New Architecture + react-native-screens で**保存時に即クラッシュ (エラー画面なしの即終了)** する。フォームのモード判定はストア更新で反転しないよう固定し続けること
- **`ThisMonthMilestonesCard` は表示する月を prop で受ける**: `components/this-month-milestones-card.tsx` は `new Date()` ではなく練習記録画面 (`app/(tabs)/index.tsx`) の `selectedMonth` (`"YYYY-MM"`) を受け取り、その年月でマイルストーンをフィルタする。月送りで別月を表示しても当月分が出ないようにするため

### ドメインヘルパー

コードベース固有の計算関数。追加実装時に車輪の再発明をしないよう把握しておく。

- **`calcSessionTime(session)`** (`store/practice-log.ts`) — 練習セッションの合計時間を `{ basic: number; nonBasic: number }` で返す。`add`/`update` 時に `total_minutes` の計算に使う
- **`calcUsagePeriod(startDate)`** (`forms/equipment.ts`) — 機材の使用開始日から現在までの期間を「X年Yヶ月」形式の文字列 (または `null`) で返す
- **`BASIC_GENRES`** (`forms/practice-log.ts`) — 基礎練習扱いとみなす教本ジャンル定数 (`['スケール', 'エチュード']`)。このジャンルの教本練習時間は `calcSessionTime` の `basic` に算入される

### Notable dependencies (意思決定が含まれるもの)

- **`tamagui` / `@tamagui/config`** — クロスプラットフォーム UI。`@tamagui/config/v5` の `defaultConfig` をそのまま `createTamagui` に渡す
- **`react-hook-form` / `zod` / `@hookform/resolvers`** — フォーム + 検証。React Native では `Controller` 経由で Tamagui の `Input` / `Switch` をラップ (詳細は「フォームの実装方針」)
- **`zustand` v5** — グローバル状態 (詳細は「状態管理」)
- **`@react-native-async-storage/async-storage`** — Zustand `persist` のバックエンド。**`npx expo install` 経由**で SDK 互換版を導入する (`npm install` 直叩きしない)
- **`@react-native-community/datetimepicker`** — 日付ピッカー。**Web 非対応**のため `Platform.OS` で分岐し、Web では Tamagui `Input` への直接入力にフォールバック
- **`@supabase/supabase-js`** — 認証 + DB クライアント。シングルトンは `lib/supabase.ts`。認証エラーの日本語マッピングは `lib/auth-errors.ts`
- **`expo-file-system/legacy`** — 録音ファイル管理 (`lib/recording.ts`)。新 API への移行は未完了で legacy を継続使用。テストでは `jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn().mockResolvedValue({ exists: false }) }))` でモックする (`lib/__tests__/recording.test.ts` / `__tests__/integration/practice-log-form.integration.test.tsx` 参照)

## Supabase

詳細は `supabase/CLAUDE.md` を参照 (環境変数 / 認証フロー / DB アクセスパターン / RLS ポリシー / DB スキーマ / テストモック)。

## フォームの実装方針

詳細は `forms/CLAUDE.md` を参照 (React Hook Form + zod + Tamagui の実装パターン)。

## 状態管理 (Zustand)

詳細は `store/CLAUDE.md` を参照 (ストア設計方針 / persist / カタログストア / テスト方法)。

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

単体テスト・結合テストの実装詳細・参照実装は `__tests__/CLAUDE.md` を参照。E2E / Maestro の詳細は `.maestro/CLAUDE.md` を参照。
