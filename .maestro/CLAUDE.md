# E2E テスト (Maestro)

実機 / シミュレータでの起動とハッピーパスのみ。EAS は使わず Expo Go 経由でローカル実行する。**ユーザ向け実行手順 (CLI 導入 / Java 17+ / tunnel + DEEPLINK 注入) は README.md を参照**。

## 追加判断基準

- 単体・結合テストでカバー済みの内容 (バリデーション網羅、AsyncStorage への書き込み単独) は E2E に含めない
- **実機ネイティブ起動でしか検証できない経路**のみ追加 (ネイティブ Alert 表示、実 AsyncStorage の永続化ラウンドトリップ等)
- セレクタは可視テキスト / `placeholder` / `aria-label` を最優先。同じ文字列が複数要素にある場合のみ `testID` を追加
- フローは `appId: ${APP_ID}` ヘッダ + `openLink: ${DEEPLINK || 'exp://localhost:8081'}` で揃える
- CI 連携はスコープ外 (シミュレータ起動コストが大きいため。コード品質チェック 4 ステップだけ CI で担保)

## Maestro 落とし穴 (Claude が知らないと事故る)

- **`inputText` は ASCII 限定**: Maestro が adb の Unicode 入力に非対応。日本語のテストデータは `Test Taro` 等に置き換える
- **`pressKey: Back` は使わない**: keyboard が閉じている時に Expo Go から抜けてしまう。キーボードが残ったままでも次の `scrollUntilVisible` / `tapOn` で問題ない
- **`Alert.alert` 本文は UiAutomator hierarchy に出ないことがある**: タイトルだけ `assertVisible` する (本文の値検証は単体／結合側で担保)
- **画面下要素は `assertVisible` 単独では見えない**: `scrollUntilVisible` で都度スクロールする
- **初回 cold bundle build (特に tunnel 経由) で 1〜3 分かかる**: 最初のアサートは `extendedWaitUntil ... timeout: 180000` で長めに
- **連続フローでスクロール位置が残る**: 必要なら冒頭で `swipe` を `repeat` して上端に戻す
