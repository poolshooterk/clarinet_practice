# 練習タイマー自動開始 + 1日複数回 (最大3回) の練習記録 — 実装計画

設計: `docs/superpowers/specs/2026-08-12-practice-session-auto-timer-design.md`

TDD (`superpowers:test-driven-development`) で各タスクとも失敗するテストを先に書く。

---

## Part A: 初めの練習タイマーの自動開始

### A-1. 練習設定ストア

- テスト: `store/__tests__/practice-preference.test.ts`
  既定値 `'none'` / `setAutoStartMenu` / AsyncStorage ラウンドトリップ + rehydrate + 壊れた JSON
- 実装: `store/practice-preference.ts`
  ```ts
  export type AutoStartMenu = 'none' | 'long_tone' | 'tonguing' | 'textbook' | 'other';
  ```
  `persist` の `name` は `clarinet-practice-preference`

### A-2. 練習設定画面と導線

- 実装: `app/practice-settings.tsx`
  `<Stack.Screen options={{ headerShown: true, title: '練習設定' }} />` + 5 択の選択 UI
- 実装: `app/(tabs)/settings.tsx` に `⏱ 練習設定` 行を追加 (既存 2 行と同じ `Pressable` + `XStack` パターン)

### A-3. SessionTimer の onFirstStart

- テスト: `components/form/__tests__/session-timer.test.tsx` (追記)
  「練習開始」で 1 回発火 / 一時停止 → 「再開」では発火しない / 「停止」→「リセット」後の再開始で再度発火
- 実装: `components/form/session-timer.tsx` に `onFirstStart?: () => void` を追加。
  `handleStart()` で押下前の `entry.status === 'idle'` のときだけ発火

### A-4. フォーム側の配線

- テスト: `__tests__/integration/practice-log-form-timer.integration.test.tsx` (追記)
  設定=ロングトーンで「練習開始」→ `useTimerStore.getState().timers['long_tone'].status === 'running'`
- 実装: `components/practice-log-form.tsx`
  - `resolveAutoStartTimerKey(menu, firstTextbookFieldId)` を純粋関数としてエクスポート
  - `usePracticePreferenceStore((s) => s.autoStartMenu)` を購読し `<SessionTimer onFirstStart={...} />`
  - 対象タイマーの status が `undefined` / `'idle'` のときだけ `start(key)`
- テスト: `components/__tests__/` に `resolveAutoStartTimerKey` の unit (5 択 × 教本行あり/なし)

**コミット 1**: `feat: 練習開始時に設定したメニューのタイマーを自動開始`

---

## Part B: 1日最大3回の練習記録

### B-1. マイグレーション

- `supabase/migrations/20260812000000_add_practice_sessions_session_no.sql`
  ```sql
  alter table practice_sessions add column session_no smallint not null default 1;
  alter table practice_sessions
    add constraint practice_sessions_session_no_check check (session_no between 1 and 3);
  alter table practice_sessions drop constraint practice_sessions_user_id_practiced_at_key;
  alter table practice_sessions
    add constraint practice_sessions_user_id_practiced_at_session_no_key
    unique (user_id, practiced_at, session_no);
  ```
- **本番適用前に必ずユーザ確認**。適用後 `select practiced_at, session_no from practice_sessions order by practiced_at desc limit 10;` で検証

### B-2. ストア

- テスト: `store/__tests__/practice-log.test.ts` (追記)
  - `nextSessionNo`: 空 → 1 / `[1]` → 2 / `[1,2,3]` → null / `[1,3]` → 2 / `excludeId` で自分を除外 / 別日は無関係
  - `groupSessionsByDate`: 日付降順・グループ内 `sessionNo` 昇順・空配列
  - `add`: 2 件目に `session_no: 2` が渡る / 3 件ある日は DB に触らず `'limit'`
  - `update`: 同日なら `session_no` を送らない / 日付変更で再採番 / 移動先が満杯なら `'limit'`
- 実装: `store/practice-log.ts`
  - `PracticeSession.sessionNo: number`、select に `session_no`、`.order('session_no', { ascending: false })` を追加
  - `MutationResult` の reason に `'limit'`
  - `nextSessionNo` / `groupSessionsByDate` をエクスポート

### B-3. 一覧画面

- テスト: `__tests__/integration/practice-log-screen.integration.test.tsx` (追記)
  同日 2 件が日付ヘッダー配下に `1回目` / `2回目` で並ぶ / 月サマリが `2日 / 3回 / 平均: N分/日`
- 実装: `app/(tabs)/index.tsx`
  - `data` を `groupSessionsByDate(monthSessions)` に、`keyExtractor` を日付に
  - `renderItem` = 日付ヘッダー (日付・曜日・その日の合計分) + 回ごとカード
  - 回バッジはグループが 2 件以上のときだけ
  - 月サマリの分母を `new Set(...).size` に変更

### B-4. フォーム画面

- 実装: `app/practice-log-form.tsx`
  - 編集タイトル: その日に複数記録があるとき `練習記録を編集（N回目）`
  - Alert 分岐に `'limit'` → 「1日に記録できるのは3回までです。」、`'duplicate'` の文言を差し替え

### B-5. 録音移動シート

- テスト: `store/__tests__/recording-transfer.test.ts` (追記) — 同日 2 件のとき候補ラベルに `N回目` が付く
- 実装: `store/recording-transfer.ts` の `buildMoveCandidates`

**コミット 2**: `feat: 1日に最大3回まで練習記録を登録できるようにする`

---

## 仕上げ

- `CLAUDE.md` の「練習記録は `(user_id, practiced_at)` で同日 1 件のみ」の記述を新しい不変条件に更新
- 品質チェック 4 ステップ: `npm run lint` / `npm run format:check` / `npx tsc --noEmit` / `npx jest --runInBand`
- 実機確認: 設定の永続化 / 自動開始 / 同日 3 件保存 / 4 件目の Alert / 一覧表示
