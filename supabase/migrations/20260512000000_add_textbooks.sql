create table textbooks (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  publisher  text,
  difficulty text        check (difficulty in ('初心者', '初中級', '中級', '上級')),
  created_at timestamptz default now()
);

alter table textbooks enable row level security;

create policy "認証済みユーザーは教本を参照可能"
  on textbooks for select
  using (auth.role() = 'authenticated');

create policy "認証済みユーザーは教本を追加可能"
  on textbooks for insert
  with check (auth.role() = 'authenticated');

create policy "認証済みユーザーは教本を更新可能"
  on textbooks for update
  using (auth.role() = 'authenticated');

create policy "認証済みユーザーは教本を削除可能"
  on textbooks for delete
  using (auth.role() = 'authenticated');
