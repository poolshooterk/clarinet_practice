# 練習タイマー自動開始 + 1日複数回 (最大3回) の練習記録 — 設計

作成日: 2026-08-12

## 背景と課題

1. **タイマーの起動忘れ**
   練習記録フォームの「練習時間帯」にある `SessionTimer` (練習開始) を押しても、ロングトーン / タンギング / 教本 / その他の `TimerControl` は個別に手動起動する必要がある。実際の運用では「練習開始」だけ押して、最初のメニューのタイマーを押し忘れることが頻発する。

2. **1日1件しか記録できない**
   `practice_sessions` に `UNIQUE (user_id, practiced_at)` があり、同じ日に 2 回目の練習を記録できない。1 日に複数回練習するのは稀だが、記録できないと欠測になる。

## ゴール

- 設定で選んだ「初めの練習」のタイマーが、練習開始と同時に自動で走る
- 同じ日に最大 3 回まで練習記録を残せる

## 非ゴール

- 「その他」を複数エントリ化する (スカラー列のまま)
- 練習メニューの並び替え・任意メニューの追加
- 設定の端末間同期

## 設計判断

| 論点                             | 決定                                                                                     | 理由                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 自動開始設定の置き場             | 設定タブ → 新規「練習設定」画面                                                          | 設定タブは現状ナビゲーションメニューのみ。今後練習まわりの設定が増える受け皿にする                          |
| 設定の保存先                     | 端末ローカル (Zustand `persist` + AsyncStorage)                                          | 単一端末の UI 挙動の好みであり、DB マイグレーション + RLS のコストに見合わない                              |
| 「教本」選択時の対象             | 教本フィールド配列の **1 行目**                                                          | フォームは前回記録の教本行を自動プレフィルするため、1 行目が事実上「いつもの教本」。行が 0 件なら何もしない |
| 自動開始のトリガー               | 初回「練習開始」(`idle → running`) のみ                                                  | 一時停止からの「再開」で毎回起動すると、意図的に止めたメニューが復活してしまう                              |
| 対象タイマーが既に動いている場合 | 何もしない                                                                               | 手動で開始済みの計測を上書きしない                                                                          |
| 同日複数回の DB 表現             | `session_no smallint` 列 + `UNIQUE (user_id, practiced_at, session_no)` + `CHECK (1..3)` | 上限を DB で保証できる。既存行は `default 1` で無変換に移行でき、`23505` ベースの既存エラー処理も生きる     |
| 回数の採番                       | ストア側で「その日の 1〜3 の最小の空き番号」を採番                                       | ユーザに回数を入力させない。削除で空いた番号を再利用できる                                                  |
| 一覧の見せ方                     | 日付ヘッダーでグループ化し、配下に回ごとのカード                                         | 日単位の合計が読み取りやすい。回バッジは 2 件以上の日だけ表示して通常時のノイズを増やさない                 |
| 月サマリ                         | 「N日 / M回 / 平均: X分/日」                                                             | 「平均: X分/日」の分母が記録件数のままだと、同日 2 回の日で 1 日あたり平均が不当に下がる                    |

## アーキテクチャ

### Part A: 自動開始

```
forms/practice-log.ts          AUTO_START_MENUS / AutoStartMenu / resolveAutoStartTimerKey
        ↓                      (純粋ヘルパー。forms は store に依存しない)
store/practice-preference.ts   autoStartMenu
        │ (persist / AsyncStorage: clarinet-practice-preference)
        ↓
app/practice-settings.tsx      5 択の選択 UI (設定タブから push)
        ↓ 購読
components/practice-log-form.tsx
        │  resolveAutoStartTimerKey(menu, fields[0]?.id) → タイマーキー | null
        ↓
components/form/session-timer.tsx   onFirstStart? (idle → running の初回だけ発火)
        ↓
store/timer.ts  start(key)
```

キー解決は既存のタイマーキー規約 (`'long_tone'` / `'tonguing'` / `'other'` / `` `textbook-${fieldId}` ``) をそのまま使う。`forms/` は `store/` を import しない既存の依存方向を保つため、選択肢の定義とキー解決は `forms/practice-log.ts` (`BASIC_MENUS` と同居) に置き、ストアは型だけ import する。

### Part B: 同日複数回

```
practice_sessions
  + session_no smallint not null default 1  CHECK (between 1 and 3)
  UNIQUE (user_id, practiced_at)  →  UNIQUE (user_id, practiced_at, session_no)

store/practice-log.ts
  PracticeSession.sessionNo
  nextSessionNo(sessions, date, excludeId?) → 1|2|3|null      ← 採番
  groupSessionsByDate(sessions) → { date, sessions }[]        ← 一覧のグループ化
  MutationResult reason: 'duplicate' | 'limit' | 'unknown'
  order: practiced_at desc, session_no desc                    ← sessions[0] = 直近の回
```

- `add` は採番して insert。空きが無ければ DB に触らず `'limit'`
- `update` は日付が変わったときだけ移動先の日で再採番 (自分自身は除外)。空きが無ければ `'limit'`
- 端末間競合で `23505` が返った場合は従来どおり `'duplicate'`

## エラーハンドリング

| ケース                                        | 挙動                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| その日に既に 3 件ある状態で保存               | `'limit'` → Alert「1日に記録できるのは3回までです。」                         |
| 日付を編集して 3 件ある日へ移動               | 同上 (DB に触らない)                                                          |
| 競合で `23505`                                | `'duplicate'` → Alert「保存に失敗しました。時間をおいて再度お試しください。」 |
| 教本 1 行目が無い状態で自動開始 (教本設定)    | 何もしない (エラーにしない)                                                   |
| 対象タイマーが既に running / paused / stopped | 何もしない                                                                    |

## 影響範囲

- `components/practice-chart.tsx` の `buildDayMap` は既に日ごとに加算しているため変更不要
- `store/recording-transfer.ts` の移動先ラベル `練習 YYYY-MM-DD` は同日複数だと区別できないため、同日 2 件以上のときだけ `N回目` を付ける
- `app/practice-log-form.tsx` の編集タイトルは、その日に複数記録があるときだけ `練習記録を編集（N回目）`

## テスト戦略

- unit (`store/__tests__/`): `nextSessionNo` / `groupSessionsByDate` / `resolveAutoStartTimerKey` の網羅、`practice-preference` の persist ラウンドトリップ、`add`/`update` の採番と `'limit'`
- integration (`__tests__/integration/`): 設定=ロングトーンで「練習開始」→ ロングトーンのタイマーも走る経路 1 件、一覧の日付グループ + 回バッジ + 月サマリ
- E2E: 追加しない (実機確認で代替)
