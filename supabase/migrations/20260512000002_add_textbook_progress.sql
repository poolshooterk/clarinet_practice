create table textbook_progress (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  textbook_id  uuid        not null references textbooks(id) on delete cascade,
  current_page integer     not null default 0 check (current_page >= 0),
  updated_at   timestamptz default now(),
  unique(user_id, textbook_id)
);

alter table textbook_progress enable row level security;

create policy "自分の進捗を参照可能"
  on textbook_progress for select
  using (auth.uid() = user_id);

create policy "自分の進捗を追加可能"
  on textbook_progress for insert
  with check (auth.uid() = user_id);

create policy "自分の進捗を更新可能"
  on textbook_progress for update
  using (auth.uid() = user_id);

create policy "自分の進捗を削除可能"
  on textbook_progress for delete
  using (auth.uid() = user_id);
