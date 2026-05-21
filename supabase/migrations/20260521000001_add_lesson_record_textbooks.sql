create table lesson_record_textbooks (
  lesson_record_id  uuid    not null references lesson_records(id) on delete cascade,
  textbook_id       uuid    not null references textbooks(id) on delete cascade,
  current_page      integer not null,
  duration_minutes  integer,
  tempo_bpm         integer,
  primary key (lesson_record_id, textbook_id)
);

alter table lesson_record_textbooks enable row level security;

create policy "ユーザーは自分のレッスン記録の教本を参照できる"
  on lesson_record_textbooks for select
  using (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_record_textbooks.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );

create policy "ユーザーは自分のレッスン記録に教本を追加できる"
  on lesson_record_textbooks for insert
  with check (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_record_textbooks.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );

create policy "ユーザーは自分のレッスン記録の教本を削除できる"
  on lesson_record_textbooks for delete
  using (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_record_textbooks.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );

create policy "ユーザーは自分のレッスン記録の教本を更新できる"
  on lesson_record_textbooks for update
  using (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_record_textbooks.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from lesson_records
      where lesson_records.id = lesson_record_textbooks.lesson_record_id
        and lesson_records.user_id = auth.uid()
    )
  );
