# 練習記録の開始/終了時刻 + レッスン宿題の進捗管理 — 設計 spec

作成日: 2026-07-23

## 背景 (なぜやるか)

クラリネット練習アプリに 2 つの独立した機能を追加する。

1. **練習記録の開始時刻・終了時刻** — いま `practice_sessions` は日付 (`practiced_at`) のみで「何時から何時まで練習したか」が残らない。練習セッションの時間帯を記録したい。既存のメニュー別分数 (ロングトーン/タンギング等) や合計分数の計算には**影響させず**、純粋な記録用メタデータとして持つ。
2. **レッスンの宿題 (進捗管理付き)** — 先生から出る宿題を登録し、レッスン後に「未着手 → 進行中 → 完了」の 3 段階で進捗を随時更新したい。宿題は各レッスン記録に紐づく子項目。lesson タブに「直近レッスンの宿題」カードを置き、そこでステータスを切り替える。追加はレッスン記録フォーム側・カード側の両方から可能。

この 2 つは互いに独立しており、それぞれ別コミットで実装できる。

## 決定事項 (ユーザ確認済み)

- 練習の開始/終了は**任意入力・独立**。分数計算に不参入。
- 開始/終了は手入力ではなく**独立したセッションタイマーで自動算出**する。タイマー開始の壁時計時刻を開始時刻とし、計測した実練習時間 (一時停止/再開を跨いだ累積 elapsed) を開始時刻に足して終了時刻を算出 (壁時計の停止時刻ではない)。既存のメニュー別タイマー `TimerControl` とは別の独立タイマー。
- **開始時刻はタイマー開始と同時に即時セット・即時表示**する。理由: 練習開始時に「今何時か」を把握でき、仕事開始時刻を超えて練習し続けるのを防ぐため。開始・終了とも**手入力で修正可能**にする (押し忘れ/誤差補正、Web でも動作)。
- 宿題は**レッスン記録の子** (`lesson_record_id` NOT NULL)。ステータスはレッスン後に独立更新 = `monthly_milestones` と同型。
- ステータスは 3 段階 `not_started` / `in_progress` / `done`。
- 宿題 1 件の情報: 内容 (必須) / 期限 (任意) / 関連教本 (任意) / 振り返りメモ (任意)。
- 「今の宿題」カード = lesson タブ、**直近レッスンの宿題のみ**表示。
- 宿題追加はレッスン記録フォーム内 + カード側の両方 → 単一の `app/homework-form.tsx` に集約。

## 設計上の重要な含意

- **宿題はレッスン保存の delete-all-then-reinsert に含めない**。`store/lesson-record.ts` の `update` は textbook 子を全削除→再挿入する。宿題を同じ扱いにすると、独立更新したステータスが編集のたびに消える。よって宿題は `monthly_milestones` 同様に**専用フォーム + 専用ストアアクションで id 単位に CRUD** し、レッスン本体の保存とは切り離す。
- 新規レッスンは保存前に id が無い。宿題追加は**レッスン保存後 (編集モード) から**行う (annual-goal → milestone と同じ制約)。新規フォームでは宿題セクションに「レッスンを保存後に宿題を追加できます」を表示。
- 時刻の順序 refine は入れない (計測が日付を跨ぐと `23:30`→`00:20` で end < start となり誤検出するため。情報用メタデータなので format のみ検証)。

## 実装 1: 練習記録の開始/終了時刻 (独立セッションタイマー)

### store/timer.ts (最初の開始時刻を保持できるよう拡張)

- `TimerEntry` に `firstStartedAt: number | null` を追加。
  - `start`: `firstStartedAt: state.timers[key]?.firstStartedAt ?? Date.now()` (初回開始でのみセット、再開では保持)。
  - `pause` / `stop`: `firstStartedAt` を保持。
  - `reset` / `defaultEntry`: `firstStartedAt: null`。
- 既存のメニュー別タイマーは無視するだけで無影響 (加算のみの後方互換変更)。

### forms/practice-log.ts

- `practiceLogSchema` に `startTime` / `endTime` (`z.string().regex(/^\d{2}:\d{2}$/).nullable().optional()`) を追加。順序 refine なし。
- ヘルパー `formatClock(epochMs): string` (`HH:MM`, ローカル時刻) を追加。

### components/form/session-timer.tsx (新規)

- `store/timer.ts` を専用キー `'practice-session'` で駆動。`TimerControl` の表示/interval/AppState 復帰パターンを踏襲するが、`onTimesChange({ startTime, endTime })` を返す。
  - `startTime = formatClock(entry.firstStartedAt)` — タイマー開始と同時に即時セット・即時表示。
  - `endTime = formatClock(entry.firstStartedAt + getElapsedMs(entry))` — 停止/一時停止で確定、running 中は表示のみ。

### components/practice-log-form.tsx / app/practice-log-form.tsx

- `<SessionTimer />` を配置し、返った HH:MM を `startTime`/`endTime` の RHF フィールドへ `setValue`。開始時刻は常時可視の HH:MM `Input` (Controller) に即時表示。開始・終了とも手入力で修正可能。
- `defaultValues` に `startTime: null, endTime: null`。
- `onDirtyChange` の `timersActive` にセッションタイマー稼働を含める。保存成功時に `reset('practice-session')`。送信時 running なら endTime を再計算。
- 編集モードの `initialValues` に保存済み値をマップ。

### store/practice-log.ts

- `PracticeSession` / `SessionRow` に start/end を追加。select 文字列・snake→camel マップ・`add`/`update` の insert/update と optimistic に配線。`total_minutes`・`calcSessionTime` は不変。

### DB

- `supabase/migrations/<ts>_add_practice_sessions_start_end_time.sql`: `alter table practice_sessions add column start_time text; add column end_time text;` (列追加のみ、RLS 追加不要)。

### app/(tabs)/index.tsx

- セッションカードのヘッダ付近に `startTime`/`endTime` があれば `19:00–19:50` を表示。

## 実装 2: レッスン宿題 (進捗管理)

### DB

- `supabase/migrations/<ts>_add_lesson_homework.sql` (`monthly_milestones` 移植):
  ```sql
  create table lesson_homework (
    id                uuid primary key default gen_random_uuid(),
    lesson_record_id  uuid not null references lesson_records(id) on delete cascade,
    content           text not null,
    due_date          date,
    textbook_id       uuid references textbooks(id) on delete set null,
    review_note       text,
    status            text not null default 'not_started'
                        check (status in ('not_started','in_progress','done')),
    completed_at      timestamptz,
    created_at        timestamptz not null default now()
  );
  create index lesson_homework_lesson_idx on lesson_homework (lesson_record_id);
  ```
- RLS 有効化 + 4 ポリシーを親 `EXISTS` で:
  `exists (select 1 from lesson_records where id = lesson_homework.lesson_record_id and user_id = auth.uid())`。

### forms/homework.ts (新規)

```ts
export const HOMEWORK_STATUS_VALUES = ['not_started', 'in_progress', 'done'] as const;
export type HomeworkStatus = (typeof HOMEWORK_STATUS_VALUES)[number];
export const HOMEWORK_STATUS_LABELS: Record<HomeworkStatus, string> = {
  not_started: '未着手',
  in_progress: '進行中',
  done: '完了',
};
export const homeworkSchema = z.object({
  content: z.string().min(1, '入力してください'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください')
    .nullable()
    .optional(),
  textbookId: z.string().nullable().optional(),
  reviewNote: z.string().nullable().optional(),
  status: z.enum(HOMEWORK_STATUS_VALUES),
});
export type HomeworkInput = z.infer<typeof homeworkSchema>;
```

### store/lesson-record.ts (宿題を LessonRecord にネスト)

- `LessonRecord` 型に `homework: Homework[]`。`Homework` = `{ id, content, dueDate, textbookId, textbookTitle, reviewNote, status, completedAt }`。
- `fetchAll` の select に `lesson_homework ( id, content, due_date, textbook_id, review_note, status, completed_at, textbooks ( title ) )` を join + マップ。
- 新アクション (recordings の `insertRecording`/`deleteRecordingRow` と同型):
  - `addHomework(lessonRecordId, input): Promise<MutationResult>`
  - `updateHomework(id, input): Promise<MutationResult>`
  - `updateHomeworkStatus(id, status)` — status + `completed_at` (done 時 ISO, それ以外 null)。`reviewMilestone` 同型。
  - `removeHomework(id)`
- `MutationResult` は `store/practice-log.ts` を踏襲。

### app/homework-form.tsx (新規, monthly-milestone-form.tsx 型)

- params: `lessonRecordId` (追加時), `id` (編集時)。`snapshotRef` パターンでモード固定 (保存時のヘッダ書換クラッシュ回避)。
- フィールド: 内容 / 期限 (日付ピッカー web/native 分岐) / 関連教本 (`Select`) / 振り返りメモ / ステータス (Button トグル)。
- 保存: 新規=`addHomework`、編集=`updateHomework`。削除 (編集時)=`removeHomework`。
- route を `app/_layout.tsx` Stack に追加。

### components/latest-lesson-homework-card.tsx (新規)

- `records[0]` (held_at desc で最新) の `homework` を表示。各宿題: 内容 + 期限バッジ + 3 段階トグル (`updateHomeworkStatus`)。行タップで編集フォームへ。「＋宿題」→ `homework-form?lessonRecordId=records[0].id`。最新レッスン無しなら非表示。

### app/(tabs)/lesson.tsx

- 月ナビ下・一覧上に `<LatestLessonHomeworkCard />`。各レッスンカードに宿題件数バッジ (任意)。

### components/lesson-record-form.tsx

- 編集モードで宿題セクション表示 (一覧 + 行タップ編集 + 「＋宿題」→ homework-form)。新規モードは「保存後に追加できます」。宿題はレッスン本体 submit に含めない。

## テスト (テスト戦略マトリクス準拠)

- **unit**
  - `forms/__tests__/practice-log.test.ts`: startTime/endTime regex (valid/invalid、片方だけ/両方空 OK)、`formatClock` round-trip。
  - `store/__tests__/timer.test.ts`: `firstStartedAt` の初回セット/保持/クリア、end = firstStart+elapsed 導出 (`Date.now` 固定)。
  - `forms/__tests__/homework.test.ts`: `homeworkSchema` 各 path、status enum。
  - `store/__tests__/lesson-record.test.ts`: `addHomework`/`updateHomeworkStatus`(done で completedAt, 戻しで null)/`removeHomework` を `getState()` 直叩き。
  - `store/__tests__/practice-log.test.ts`: add/update で start/end 保存 & total_minutes 非影響。
- **integration**
  - practice-log-form: 手入力 HH:MM Input に `fireEvent.changeText` → 保存スモーク。
  - homework-form: 追加/編集スモーク。
- **component**
  - `components/form/__tests__/session-timer.test.tsx`: start→startTime、stop→endTime (`Date.now` 固定、fake timers)。
  - `components/__tests__/latest-lesson-homework-card.test.tsx`: トグルで `updateHomeworkStatus` 呼び出し。

## ドキュメント更新

- `supabase/CLAUDE.md`: `practice_sessions` に start/end、新規 `lesson_homework` を追記。
- `CLAUDE.md` (ルート): ルート一覧に `app/homework-form.tsx`、設計判断に「宿題は delete-all-reinsert に含めず id 単位 CRUD」を追記。

## 実装順 (2 独立ストリーム, 別コミット)

1. 練習記録の開始/終了時刻。
2. レッスン宿題。
