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
- `practice_sessions` — 練習記録ヘッダー。`user_id` / `practiced_at` / `other_minutes` / `other_memo` / `total_minutes` / `memo`
- `practice_session_basic_menus` — 基礎練習エントリ (ロングトーン / タンギング)。`menu_type` / `duration_minutes`
- `practice_session_basic_menu_tempos` — タンギングテンポ。`tempo_bpm`
- `practice_session_textbooks` — 教本進捗エントリ。`textbook_id` / `current_page` / `duration_minutes` / `tempo_bpm`
- `textbooks` — 教本カタログ (カタログストア `store/textbook-catalog.ts` が管理)
- `instruments` — 所有楽器。`photo_uri` を持つ
- `instrument_makers` — メーカーマスタ (カタログストア `store/instrument-catalog.ts` が管理)
- `lesson_records` — レッスン記録

## テストでのモック

`jest.setup.ts` で `@/lib/supabase` がグローバルモックされており、`supabase.auth.*` の各メソッドは `jest.fn()` になっている。結合テストでは `mockResolvedValueOnce` で戻り値を上書きして使う:

```ts
(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({ data: {}, error: null });
```
