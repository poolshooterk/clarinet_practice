# Supabase

## 環境変数

`.env.local` に以下を設定する (`.gitignore` 対象のため commit しない):

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## 認証フロー

`app/_layout.tsx` の `supabase.auth.onAuthStateChange` がセッション変化を監視し、セッションなしなら `/(auth)/sign-in`、ありなら `/(tabs)/` へ自動遷移する。コンポーネント側で手動ルーティングは行わない。

## DB アクセスパターン

- `supabase.from('<table>').select/insert/update/delete` を Zustand ストアのアクション内で呼ぶ (コンポーネントから直接呼ばない)
- Supabase が返すスネークケース列 (`maker_id`) はストア内でキャメルケース (`makerId`) に変換してから state に格納する
- マイグレーションは `supabase/migrations/<timestamp>_<name>.sql` に追加。Claude Code から適用する場合は `mcp__supabase__apply_migration` ツールを使う。CLI 使用の場合: `supabase db push` (リモート) または `supabase db reset` (ローカル)

## RLS ポリシー

ユーザデータを持つテーブルは **SELECT / INSERT / UPDATE / DELETE の 4 つをすべて定義する**こと。Supabase/PostgREST は UPDATE ポリシーが存在しない場合、エラーを返さず 0 行更新で終了する。Zustand のオプティミスティック更新で画面上は変化したように見えるが、次回 `fetchAll` で DB の旧値に上書きされる。新しいユーザデータテーブルを追加したら必ず 4 ポリシーセットを作成する。

```sql
create policy "..." on <table> for select using (auth.uid() = user_id);
create policy "..." on <table> for insert with check (auth.uid() = user_id);
create policy "..." on <table> for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "..." on <table> for delete using (auth.uid() = user_id);
```

## DB スキーマ概要

主要テーブルと関係 (詳細は `supabase/migrations/` を参照):

- `profiles` — ユーザプロフィール (1:1 with `auth.users`)
- `practice_sessions` — 練習記録ヘッダー。`user_id` / `practiced_at` / `session_no` / `duration_minutes` / `other_minutes` / `other_memo` / `total_minutes` / `memo` / `reed_number` / `start_time` / `end_time`。`session_no smallint not null default 1` + `CHECK (between 1 and 3)` + `UNIQUE (user_id, practiced_at, session_no)` で**同日 最大 3 件**。`start_time`/`end_time` は `HH:MM` 文字列で、セッションタイマー由来の記録用メタデータのため分数計算に不参入
- `practice_session_basic_menus` — 基礎練習エントリ (ロングトーン / タンギング)。`menu_type` / `duration_minutes` / `tempo_bpms integer[]`。`UNIQUE (session_id, menu_type)`。テンポは**子テーブルではなく配列カラム** (`20260515000002_tempo_bpms_array.sql` でスカラー `tempo_bpm` から移行済み)
- `practice_session_textbooks` — 教本進捗エントリ。`textbook_id` / `current_page` / `duration_minutes` / `tempo_bpm`
- `textbooks` — 教本カタログ (カタログストア `store/textbook-catalog.ts` が管理)
- `user_equipment` — 所有楽器セット (PK = `user_id`、ユーザごとに1行)。`instrument` (`instrument_maker_id` / `instrument_model_id` で `instrument_makers` / `instrument_models` を参照、`instrument_purchase_price` / `instrument_start_date` / `instrument_photo_uri`) + `reed` / `ligature` / `mouthpiece` の `*_name` / `*_start_date` カラムを 1 行に格納。書き込みは `upsert` (`user_id` 衝突時 UPDATE)
- `instrument_makers` — メーカーマスタ (カタログストア `store/instrument-catalog.ts` が管理)
- `lesson_records` — レッスン記録
- `lesson_homework` — レッスンの宿題。`lesson_record_id` / `content` / `due_date` / `textbook_id` / `review_note` / `status('not_started'|'in_progress'|'done')` / `completed_at`。RLS は親 `lesson_records.user_id` を EXISTS で検証。進捗ステータスはレッスン後に独立更新するため、`store/lesson-record.ts` の id 単位 CRUD で扱いレッスン保存の delete-all-reinsert には含めない
- `practice_session_recordings` — 練習セッション録音 (最大3本/セッション)。`session_id` / `index(1-3)` / `local_uri` / `memo`。`UNIQUE(session_id, index)`
- `lesson_record_recordings` — レッスン録音 (最大3本/レッスン)。`lesson_record_id` / `index(1-3)` / `local_uri` / `memo`。`UNIQUE(lesson_record_id, index)`
- `purchase_plans` — 購入計画 (PK = `id`、`user_id` に UNIQUE 制約でユーザごとに1行)。`maker_id` / `maker_name` / `model_id` / `model_name` / `target_price` / `monthly_savings_target`
- `purchase_plan_savings` — 貯蓄実績 (`purchase_plan_id` 外部キー)。`year_month` / `amount` / `memo`。RLS は `purchase_plans` の `user_id` を JOIN で検証

## トラブルシューティング

- **無料枠プロジェクトの自動 pause**: 約1週間アクセスがないと Supabase プロジェクトが pause され、その間は DB / Auth がオフラインになる。症状は「正しい認証情報でもログインできない」「MCP / クライアントからの全 SQL が `Connection terminated due to connection timeout`」「auth ログが直近0件」。一方で管理 API (`mcp__supabase__get_project_url` 等) は応答するのが特徴。切り分けの第一歩は Supabase ダッシュボードのステータス (Active / Paused) 確認。Paused なら "Restore project" で数分待てば復旧する (pause 解除は MCP からは不可でダッシュボード操作が必要)

## テストでのモック

`jest.setup.ts` で `@/lib/supabase` がグローバルモックされており、`supabase.auth.*` の各メソッドは `jest.fn()` になっている。結合テストでは `mockResolvedValueOnce` で戻り値を上書きして使う:

```ts
(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({ data: {}, error: null });
```
