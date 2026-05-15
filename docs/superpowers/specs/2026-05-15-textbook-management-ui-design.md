# 教本管理画面 UI 改修 設計ドキュメント

## 目的

教本管理画面（`app/textbooks.tsx`）から進捗入力機能を取り除き、教本の閲覧・編集・削除に特化したシンプルな画面にする。進捗の入力は練習記録フォームからのみ行う。

## 変更の背景

- 現状: カードタップ → 進捗入力モーダル、`›` ボタン → 編集フォーム という二重の操作動線
- 課題: 進捗入力の責務が「教本管理」と「練習記録」の両方に分散している
- 方針: 教本管理画面の責務を「カタログの閲覧・CRUD」に絞り、進捗入力は練習記録フォームに一本化する

## 画面動作の変更

| 操作             | 変更前                                                | 変更後                                   |
| ---------------- | ----------------------------------------------------- | ---------------------------------------- |
| カード本体タップ | 進捗入力モーダルを開く（totalPages 未設定なら Alert） | 編集フォームへ遷移                       |
| `›` ボタンタップ | 編集フォームへ遷移                                    | **廃止**（カードタップと重複のため削除） |
| カード長押し     | 削除確認 Alert                                        | 変更なし                                 |
| 進捗バー表示     | 読み取り表示あり                                      | **維持**（練習記録から入れた進捗を表示） |
| 進捗入力モーダル | あり                                                  | **削除**                                 |

## コード変更

### `app/textbooks.tsx`

削除するもの:

- `useState` の `modalTextbook`, `modalPage`
- `handleRowPress`, `handleModalSave` 関数
- `useTextbookProgressStore` からの `upsert` import
- `<Modal>` コンポーネント全体
- `›` ボタンの `<Pressable>` 全体

変更するもの:

- カード本体 `Pressable` の `onPress` を `router.push(\`/textbook-form?id=${item.id}\`)` に変更
- `aria-label` を `${item.title}を編集` に変更

維持するもの:

- `progress`, `fetchAllProgress`（進捗バーの読み取り表示に使用）
- 長押し削除 (`handleLongPress`)
- 進捗バー UI

### `__tests__/integration/textbook-progress-modal.integration.test.tsx`

削除するテスト:

- 「行をタップするとモーダルが開く」
- 「モーダルでページを入力して保存すると upsert が呼ばれる」
- 「totalPages が未設定の教本をタップすると Alert が表示される」

追加するテスト:

- 「カードをタップすると編集フォームへ遷移する (`router.push` が呼ばれる)」

維持するテスト:

- 「totalPages がある教本に進捗テキストが表示される」
- 「進捗がある教本には現在ページが表示される」

## テスト方針

結合テスト (`textbook-progress-modal.integration.test.tsx`) を上記の通り更新する。モーダル関連テストを削除し、タップ → `router.push` 呼び出しを検証するテストに置き換える。
