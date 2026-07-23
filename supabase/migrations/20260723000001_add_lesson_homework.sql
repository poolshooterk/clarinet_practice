create table lesson_homework (
  id                uuid        primary key default gen_random_uuid(),
  lesson_record_id  uuid        not null references lesson_records(id) on delete cascade,
  content           text        not null,
  due_date          date,
  textbook_id       uuid        references textbooks(id) on delete set null,
  review_note       text,
  status            text        not null default 'not_started'
                      check (status in ('not_started', 'in_progress', 'done')),
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index lesson_homework_lesson_idx on lesson_homework (lesson_record_id);

alter table lesson_homework enable row level security;

create policy "ユーザーは自分のレッスンの宿題を参照できる"
  on lesson_homework for select
  using (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_homework.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );

create policy "ユーザーは自分のレッスンに宿題を追加できる"
  on lesson_homework for insert
  with check (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_homework.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );

create policy "ユーザーは自分のレッスンの宿題を更新できる"
  on lesson_homework for update
  using (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_homework.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_homework.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );

create policy "ユーザーは自分のレッスンの宿題を削除できる"
  on lesson_homework for delete
  using (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_homework.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );
