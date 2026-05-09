# expo-template

Expo アプリ開発のための汎用テンプレートリポジトリです。新規プロジェクトの起点として使用することを想定しており、コード品質基準とテスト環境が整備された状態を維持することを目標としています。

## テンプレートについて

- **目的**: Expo 開発における汎用テンプレートとして継続的に整備・管理する
- **コード品質**: ESLint (eslint-config-expo) + TypeScript strict モード + Prettier + husky/lint-staged + GitHub Actions CI による静的解析
- **テスト環境**: jest-expo + @testing-library/react-native による単体／結合テスト基盤を整備済み (`npm test`)
- **ルーティング**: expo-router v6 によるファイルベースルーティング
- **状態管理**: Zustand v5 (selector 購読 + persist middleware による AsyncStorage 永続化)
- **UI**: Tamagui (`@tamagui/config/v5` の defaultConfig をそのまま採用)
- **フォーム**: React Hook Form + zod (`forms/` 配下にスキーマ、`components/profile-form.tsx` に実装本体)

新規プロジェクトを開始する際は、このリポジトリをベースにして `npm run reset-project` を実行することでクリーンな状態から開発を始めることができます。

---

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## E2E テスト (Maestro)

実機 / シミュレータ上での起動とハッピーパスを Maestro で検証します。EAS は使わず、Expo Go 経由でローカル実行します。フローは `.maestro/` 配下:

- `.maestro/smoke.yaml` — 起動 + 主要見出しの可視性
- `.maestro/profile-form.yaml` — ProfileForm に必須項目を入力 → 送信 → ネイティブ Alert 確認

### 1. Maestro CLI のインストール (初回のみ)

Maestro は npm パッケージではなく単体 CLI です。**Maestro 2.0 以降は Java 17+ が必要**。

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

スクリプトは `-e APP_ID=...` で Expo Go のバンドル ID を注入し、`.maestro/` 配下の全フローを順に実行します。フロー側 `openLink` は `${DEEPLINK || 'exp://localhost:8081'}` 形になっており、デフォルトでは `exp://localhost:8081` が使われます。

### 4. 別ホストから実行する場合 (例: WSL2 上の Metro + Windows AVD)

`localhost` で繋がらない構成では `--tunnel` モードで Metro を起動し、tunnel URL を `DEEPLINK` 経由で渡します。

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

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
