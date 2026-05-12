-- practice_sessions: 練習セッション本体
create table practice_sessions (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  practiced_at      date        not null default current_date,
  duration_minutes  integer     check (duration_minutes > 0),
  memo              text,
  created_at        timestamptz default now()
);

alter table practice_sessions enable row level security;

create policy "自分の練習記録を参照可能"
  on practice_sessions for select
  using (auth.uid() = user_id);

create policy "自分の練習記録を追加可能"
  on practice_sessions for insert
  with check (auth.uid() = user_id);

create policy "自分の練習記録を削除可能"
  on practice_sessions for delete
  using (auth.uid() = user_id);

-- practice_session_textbooks: セッションに紐づく教本進捗
create table practice_session_textbooks (
  id           uuid     primary key default gen_random_uuid(),
  session_id   uuid     not null references practice_sessions(id) on delete cascade,
  textbook_id  uuid     not null references textbooks(id) on delete cascade,
  current_page integer  not null check (current_page >= 0),
  unique(session_id, textbook_id)
);

alter table practice_session_textbooks enable row level security;

create policy "自分のセッションの教本進捗を参照可能"
  on practice_session_textbooks for select
  using (
    exists (
      select 1 from practice_sessions
      where id = practice_session_textbooks.session_id
        and user_id = auth.uid()
    )
  );

create policy "自分のセッションの教本進捗を追加可能"
  on practice_session_textbooks for insert
  with check (
    exists (
      select 1 from practice_sessions
      where id = practice_session_textbooks.session_id
        and user_id = auth.uid()
    )
  );

create policy "自分のセッションの教本進捗を削除可能"
  on practice_session_textbooks for delete
  using (
    exists (
      select 1 from practice_sessions
      where id = practice_session_textbooks.session_id
        and user_id = auth.uid()
    )
  );
