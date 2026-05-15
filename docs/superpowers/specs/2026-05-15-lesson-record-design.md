# レッスン記録機能 設計ドキュメント

## 目的

クラリネットレッスンの日時・先生からのアドバイス・気づいたことを記録・管理する機能を追加する。

## 変更の背景

- 現状: 練習記録（練習セッション）のみ記録できる
- 課題: レッスンでのアドバイスや気づきを残す場所がない
- 方針: レッスン記録を練習記録とは完全に独立した別エンティティとして管理する

## 画面・操作フロー

### レッスン一覧画面（新規タブ）

- タブバーに「レッスン」タブを追加（練習記録の右隣）
- レッスン記録を日付の新しい順で一覧表示
- ヘッダー右に「＋ 追加」ボタン → 新規フォームへ遷移
- カードタップ → 編集フォームへ遷移
- カード長押し → 削除確認 Alert

### カード表示内容

- レッスン日時（`YYYY-MM-DD HH:MM` 形式）
- アドバイスの冒頭（1〜2行プレビュー、未入力なら非表示）
- 気づきの冒頭（1〜2行プレビュー、未入力なら非表示）

### レッスン記録フォーム（追加・編集共用）

| フィールド   | 入力方法                                 | 必須 |
| ------------ | ---------------------------------------- | ---- |
| 日付         | DateTimePicker（Web は Input）           | ✓    |
| 時刻         | DateTimePicker time mode（Web は Input） | ✓    |
| アドバイス   | 複数行テキスト                           | 任意 |
| 気づいたこと | 複数行テキスト                           | 任意 |

- 編集時は既存値を `defaultValues` に渡す
- 保存ボタン押下 → バリデーション → Supabase upsert
- 編集フォームには「このレッスン記録を削除」ボタンを表示（`onDelete` prop 経由）

## データモデル

### `lesson_records` テーブル

```sql
create table lesson_records (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  held_at    timestamptz not null,
  advice     text,
  notes      text,
  created_at timestamptz default now()
);
```

RLS ポリシー: 自分のレコードのみ SELECT / INSERT / UPDATE / DELETE 可能。

### 時刻の扱い

- フォーム内では日付（`YYYY-MM-DD`）と時刻（`HH:MM`）を別フィールドで保持
- 保存時は `${date}T${time}:00+09:00`（JST 固定）の文字列を Supabase に送る
- 表示時は `held_at`（UTC で返る）を `Date` オブジェクト経由で日本語ロケールの `YYYY-MM-DD HH:MM` にフォーマットする

## コード構成

| ファイル                                          | 役割                                   |
| ------------------------------------------------- | -------------------------------------- |
| `supabase/migrations/<ts>_add_lesson_records.sql` | テーブル作成 + RLS                     |
| `forms/lesson-record.ts`                          | zod スキーマ・日付ヘルパー             |
| `store/lesson-record.ts`                          | Zustand ストア（CRUD + Supabase 連携） |
| `components/lesson-record-form.tsx`               | フォーム UI（RHF + Tamagui）           |
| `app/(tabs)/lesson.tsx`                           | レッスン一覧画面                       |
| `app/lesson-record-form.tsx`                      | 追加・編集ルート画面                   |
| `app/(tabs)/_layout.tsx`                          | タブバーに「レッスン」追加             |

## テスト方針

| 対象                     | テスト種別  | 内容                                                                   |
| ------------------------ | ----------- | ---------------------------------------------------------------------- |
| `forms/lesson-record.ts` | unit        | zod スキーマのバリデーション網羅（必須チェック・時刻形式・組み合わせ） |
| `store/lesson-record.ts` | unit        | `getState()` 直叩きで add / remove / fetchAll の状態遷移               |
| フォーム + ストア連携    | integration | 入力 → 保存 → `router.push` 呼び出し、バリデーションエラー表示         |
| レッスン一覧画面         | integration | カードタップ → 編集フォーム遷移、空状態の表示                          |
