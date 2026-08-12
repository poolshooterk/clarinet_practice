# クラリネット練習

クラリネットの練習を記録・管理するための Expo アプリ。日々の練習記録 (基礎練習・教本進捗・録音)、レッスン記録と宿題、年間目標とマイルストーン、所有楽器・消耗品・購入計画を扱う。

- アプリ名 / slug: `クラリネット練習` / `clarinet-practice` (`app.json`)
- Android package: `com.keikei.clarinetpractice`

## 主な機能

- **練習記録** — ロングトーン / タンギング (テンポ付き) / 教本ごとの進捗とページ・時間、その他練習。メニューごとのタイマーと練習時間帯のセッションタイマー。1 日あたり最大 3 回まで記録できる
- **録音** — 1 記録につき最大 3 本。再生・シーク・記録間の付け替えに対応
- **レッスン記録** — アドバイス・教本進捗・宿題。宿題の進捗ステータスはレッスンとは独立して更新する
- **年間目標** — 12 ヶ月のマイルストーンと当月分の進捗表示
- **楽器・消耗品・購入計画** — 所有楽器セットの使用開始日管理、リード等の消耗品、購入目標額に対する貯蓄実績

## 技術スタック

| 領域         | 採用                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| ルーティング | expo-router v6 (ファイルベース / typed routes)                                                       |
| UI           | Tamagui (`@tamagui/config/v5` の defaultConfig をそのまま採用)                                       |
| 状態管理     | Zustand v5 (selector 購読 + `persist` による AsyncStorage 永続化)                                    |
| フォーム     | React Hook Form + zod (`forms/` にスキーマ)                                                          |
| バックエンド | Supabase (Auth + Postgres + RLS)                                                                     |
| 録音         | expo-av + expo-file-system (legacy API)                                                              |
| テスト       | jest-expo + @testing-library/react-native、E2E は Maestro                                            |
| 静的解析     | ESLint (eslint-config-expo) / TypeScript strict / Prettier / husky + lint-staged / GitHub Actions CI |

New Architecture と React Compiler を有効化している (`app.json`)。

## セットアップ

```bash
npm install
```

`.env.local` に Supabase の接続情報を設定する (このファイルは gitignore 対象):

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

> EAS Build は `.env.local` を読まない。実機配布用のビルドを作る場合は
> `eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value ...` のように
> EAS シークレットへ登録しないと、起動時にクラッシュする。

## 開発

```bash
npm start              # Expo dev server を起動 (Expo Go / dev build 用の QR を表示)
npm run android        # Android エミュレータで開く
npm run ios            # iOS シミュレータで開く
npm run web            # ブラウザで開く
```

### コード品質チェック

コミット前に以下 4 つをすべて通す。`.husky/pre-commit` の lint-staged が変更ファイルに対して同等の処理を自動適用する。

```bash
npm run lint          # ESLint
npm run format:check  # Prettier (差分がある場合は npm run format)
npx tsc --noEmit      # 型チェック
npm test              # Jest
```

### テストを絞って実行する

```bash
npx jest <pattern>         # ファイル / ディレクトリで絞る (例: forms, __tests__/integration)
npx jest -t '<text>'       # describe / it 名の部分一致で絞る
npx jest --watch <pattern>
```

### 実機配布用ビルド (EAS)

```bash
eas build --platform android --profile preview  # dev server 不要の APK
```

`app.json` の permissions を変更した場合は OTA では反映されないため、APK の再ビルドが必要。

## テスト構成

| 種別 | 配置                                                   | 責務                                                              |
| ---- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| 単体 | 対象ディレクトリ直下の `__tests__/`                    | 純粋関数 / zod スキーマ / Zustand ストアの状態遷移                |
| 結合 | `__tests__/integration/<feature>.integration.test.tsx` | RHF + Zustand + Tamagui を貫通する画面挙動 (これらはモックしない) |
| E2E  | `.maestro/<flow>.yaml`                                 | 実機ネイティブ起動でしか検証できない経路                          |

詳細な方針は `CLAUDE.md` と各ディレクトリの `CLAUDE.md` (`forms/` `store/` `__tests__/` `supabase/` `.maestro/`) を参照。

## E2E テスト (Maestro)

実機 / シミュレータ上での起動とハッピーパスを Maestro で検証する。EAS は使わず Expo Go 経由でローカル実行する。フローは `.maestro/` 配下。

### 1. Maestro CLI のインストール (初回のみ)

Maestro は npm パッケージではなく単体 CLI。**Maestro 2.0 以降は Java 17+ が必要**。

macOS / Linux:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
maestro --version
```

Windows: 公式ガイド <https://docs.maestro.dev/getting-started/installing-maestro/windows> 参照 (Scoop 経由が手軽: `scoop install openjdk17 maestro`)。

### 2. 実行前の準備

- iOS Simulator または Android Emulator を起動
- Expo Go をシミュレータ / エミュレータにインストール (App Store / Play Store)
- 別ターミナルで Metro を起動: `npx expo start` (デフォルトは `localhost:8081`)

### 3. テスト実行 (デフォルト: localhost 直結)

同一ホスト上で Metro と Maestro を動かす場合 (macOS / Linux / Windows ネイティブ):

```bash
npm run e2e:ios       # iOS Simulator 上の Expo Go で実行
npm run e2e:android   # Android Emulator 上の Expo Go で実行
```

スクリプトは `-e APP_ID=...` で Expo Go のバンドル ID を注入し、`.maestro/` 配下の全フローを順に実行する。フロー側 `openLink` は `${DEEPLINK || 'exp://localhost:8081'}` 形になっており、デフォルトでは `exp://localhost:8081` が使われる。

> `APP_ID=host.exp.exponent` は **Expo Go 専用**。preview ビルドをインストールした実機に対して実行する場合は `APP_ID=com.keikei.clarinetpractice` を指定する。

### 4. 別ホストから実行する場合 (例: WSL2 上の Metro + Windows AVD)

`localhost` で繋がらない構成では `--tunnel` モードで Metro を起動し、tunnel URL を `DEEPLINK` 経由で渡す。

```bash
# (WSL 等) Metro を tunnel で起動
npm install -g @expo/ngrok                          # 初回のみ
NODE_PATH="$(npm root -g)" npx expo start --tunnel  # tunnel ready が出るまで待つ

# 別ターミナルで tunnel URL を取得
curl -s http://127.0.0.1:4040/api/tunnels | grep -oE 'https://[^"]+\.exp\.direct'
```

得られた `https://xxxx.exp.direct` を `exp://xxxx.exp.direct` (スキームのみ差し替え) として、Maestro 実行時に `-e DEEPLINK=...` で渡す:

```powershell
maestro test -e APP_ID=host.exp.exponent -e DEEPLINK=exp://xxxx.exp.direct .maestro
```

### フロー追加時の指針

- 既存の単体 / 結合テストでカバー済みの内容 (バリデーションエラーや AsyncStorage への書き込み単体) は E2E に含めず、**実機ネイティブ起動でしか検証できない経路** に絞る
- セレクタは可視テキスト / `placeholder` / `aria-label` を最優先。同一文字列が複数要素に存在して衝突する場合のみ `testID` を追加する
- フローは `appId: ${APP_ID}` ヘッダから始め、`openLink: ${DEEPLINK || 'exp://localhost:8081'}` で Expo Go を起動する形に揃える
- 画面下にある要素は `scrollUntilVisible` でスクロールしながら確認する (デフォルト viewport の外は `assertVisible` だけでは見えない)
- 初回 cold bundle build (特に tunnel 経由) は数分かかるため、初手の待機は `extendedWaitUntil ... timeout: 180000` で長めに取る
- **`inputText` は ASCII 限定** (Maestro が adb の Unicode 入力非対応のため)。日本語フィールドのテストデータは英数字に置き換える
- React Native の `Alert.alert` 本文 (message) は UiAutomator hierarchy に露出しないことがあるため、タイトルだけ `assertVisible` する

## リポジトリの由来について

このリポジトリは汎用 Expo テンプレートを起点に立ち上がっており、以下はドメイン機能から参照されていないテンプレート時代の残骸。**新規実装のお手本にしないこと**。

- `store/counter.ts` / `store/settings.ts` / `components/profile-form.tsx` / `forms/profile.ts` と各テスト、`.maestro/profile-form.yaml`
- `package.json` の `name` は `expo-template` のまま (アプリ名は `app.json` が実体)
- `npm run reset-project` は package.json に残っているが `scripts/reset-project.js` が存在せず**実行できない**。同様に `app-example/` も生成されない

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [expo-router](https://docs.expo.dev/router/introduction)
- [Tamagui](https://tamagui.dev/)
- [Supabase](https://supabase.com/docs)
