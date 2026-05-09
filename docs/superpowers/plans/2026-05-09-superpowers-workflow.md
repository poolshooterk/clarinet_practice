# Superpowers ワークフロー実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CLAUDE.md に「開発ワークフロー (新機能)」セクションを追加し、新機能開発時に brainstorming → writing-plans → TDD → finishing-a-development-branch の 4 フェーズを踏むことを明文化する。

**Architecture:** CLAUDE.md の `## Commands` セクションと `## コード品質チェック` セクションの間に新セクションを挿入する。既存セクションへの変更はなし。

**Tech Stack:** Markdown (CLAUDE.md 直接編集)

---

### Task 1: CLAUDE.md に開発ワークフローセクションを追加する

**Files:**

- Modify: `CLAUDE.md` (line 34 付近 — `## コード品質チェック` の直前)

- [ ] **Step 1: CLAUDE.md の現在の状態を確認する**

```bash
grep -n "## コード品質チェック" CLAUDE.md
```

期待出力: `35:## コード品質チェック (毎回実施)` (行番号は多少ずれる場合あり)

- [ ] **Step 2: `## コード品質チェック` の直前に新セクションを挿入する**

`## Commands` ブロックの末尾 (空行 `\n` が 1 行あるところ) と `## コード品質チェック` の間に以下を追加する。Edit ツールで `old_string` に `## コード品質チェック (毎回実施)` を含む直前の空行を含めた文字列を指定し、`new_string` に新セクション + 元の文字列を返す形で挿入する。

挿入する内容:

```markdown
## 開発ワークフロー (新機能)

新機能追加・大きな変更をする際は、以下の 4 フェーズを順番に踏む。各フェーズは対応する superpowers スキルを Skill ツール経由で呼び出す。バグ修正・リファクタリングなど単発の小さな変更はこのフローに縛られず直接実装してよい。

| フェーズ | スキル                                       | 入口条件                     | 出口条件                                                            |
| -------- | -------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| 設計     | `superpowers:brainstorming`                  | 機能の追加・変更要求がある   | 設計 spec が `docs/superpowers/specs/` に保存され、ユーザが承認済み |
| 計画     | `superpowers:writing-plans`                  | 設計 spec が承認済み         | 実装計画が `docs/superpowers/plans/` に保存され、ユーザが承認済み   |
| 実装     | `superpowers:test-driven-development`        | 実装計画が承認済み           | すべてのタスクが完了、品質チェック 4 ステップを通過済み             |
| 完了     | `superpowers:finishing-a-development-branch` | 実装が品質チェックを通過済み | PR 作成 or ブランチがレビュー待ち状態                               |
```

Edit ツールの `old_string`:

```
## コード品質チェック (毎回実施)
```

Edit ツールの `new_string`:

```
## 開発ワークフロー (新機能)

新機能追加・大きな変更をする際は、以下の 4 フェーズを順番に踏む。各フェーズは対応する superpowers スキルを Skill ツール経由で呼び出す。バグ修正・リファクタリングなど単発の小さな変更はこのフローに縛られず直接実装してよい。

| フェーズ | スキル | 入口条件 | 出口条件 |
| -------- | ------ | -------- | -------- |
| 設計 | `superpowers:brainstorming` | 機能の追加・変更要求がある | 設計 spec が `docs/superpowers/specs/` に保存され、ユーザが承認済み |
| 計画 | `superpowers:writing-plans` | 設計 spec が承認済み | 実装計画が `docs/superpowers/plans/` に保存され、ユーザが承認済み |
| 実装 | `superpowers:test-driven-development` | 実装計画が承認済み | すべてのタスクが完了、品質チェック 4 ステップを通過済み |
| 完了 | `superpowers:finishing-a-development-branch` | 実装が品質チェックを通過済み | PR 作成 or ブランチがレビュー待ち状態 |

## コード品質チェック (毎回実施)
```

- [ ] **Step 3: 挿入結果を目視確認する**

```bash
grep -n "## 開発ワークフロー\|## コード品質チェック\|## Commands\|## コミット運用" CLAUDE.md
```

期待出力 (行番号は参考値):

```
9:## Commands
35:## 開発ワークフロー (新機能)
48:## コード品質チェック (毎回実施)
58:## コミット運用
```

`## Commands` → `## 開発ワークフロー` → `## コード品質チェック` の順になっていれば OK。

- [ ] **Step 4: Prettier フォーマットチェックを通す**

```bash
npm run format:check
```

期待出力: `All matched files use Prettier code style!`
差分がある場合は `npm run format` で自動修正してから再実行する。

- [ ] **Step 5: コミットする**

```bash
git add CLAUDE.md
git commit -m "CLAUDE.md に新機能開発ワークフローセクションを追加"
```

---

## セルフレビューメモ

- **Spec カバレッジ**: 設計 spec の「フェーズ定義」テーブルをそのまま CLAUDE.md に反映。対象範囲の説明 (適用する/しない) はスキルの calling convention と重複するため CLAUDE.md には含めない (YAGNI)
- **Placeholder なし**: コードブロックはすべて具体的な文字列で記述済み
- **型一貫性**: Markdown 編集のため型の問題なし
