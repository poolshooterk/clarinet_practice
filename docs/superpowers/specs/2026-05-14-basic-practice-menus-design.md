# 基礎練習メニュー追加 設計ドキュメント

## 概要

練習記録フォームにロングトーン・タンギングの基礎練習メニューを追加し、
各メニューの練習時間（分）を記録できるようにする。

## 設計決定

- メニューはフォームに常時表示（追加・削除操作なし）
- `durationMinutes` 手動入力を廃止し、基礎練習合計を自動計算
- DB: 専用テーブル `practice_session_basic_menus` (Approach B) で将来の拡張に対応
- アプリ定数 `BASIC_MENUS` でメニュー種別を管理し、追加時はこの配列に追記するだけでよい

## データモデル

```
practice_sessions
  id, user_id, practiced_at, duration_minutes (合計), memo, created_at

practice_session_basic_menus
  id, session_id (→ practice_sessions), menu_type VARCHAR, duration_minutes INT
  UNIQUE (session_id, menu_type)
```

## フォームスキーマ変更

変更前: { practicedAt, durationMinutes?, memo, textbookEntries }
変更後: { practicedAt, longToneMinutes?, tonguingMinutes?, memo, textbookEntries }

## UI 変更

- 「練習時間（分）任意」フィールドを削除
- 「基礎練習」セクションを追加（ロングトーン・タンギングの分数入力）
- 合計 > 0 の場合「合計: X分」を表示
- 一覧画面のセッションカードに基礎練習時間を表示
