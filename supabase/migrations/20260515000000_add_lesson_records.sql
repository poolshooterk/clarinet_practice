create table lesson_records (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  held_at    timestamptz not null,
  advice     text,
  notes      text,
  created_at timestamptz default now()
);

alter table lesson_records enable row level security;

create policy "ユーザーは自分のレッスン記録を参照できる"
  on lesson_records for select
  using (auth.uid() = user_id);

create policy "ユーザーは自分のレッスン記録を追加できる"
  on lesson_records for insert
  with check (auth.uid() = user_id);

create policy "ユーザーは自分のレッスン記録を更新できる"
  on lesson_records for update
  using (auth.uid() = user_id);

create policy "ユーザーは自分のレッスン記録を削除できる"
  on lesson_records for delete
  using (auth.uid() = user_id);
