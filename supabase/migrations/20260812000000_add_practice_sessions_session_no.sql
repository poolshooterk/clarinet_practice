-- 1 日に複数回 (最大 3 回) の練習記録を残せるようにする
-- 既存行はすべて session_no = 1 になるため、新しい UNIQUE 制約は既存データのまま通る
alter table practice_sessions
  add column session_no smallint not null default 1;

alter table practice_sessions
  add constraint practice_sessions_session_no_check
  check (session_no between 1 and 3);

alter table practice_sessions
  drop constraint practice_sessions_user_id_practiced_at_key;

alter table practice_sessions
  add constraint practice_sessions_user_id_practiced_at_session_no_key
  unique (user_id, practiced_at, session_no);
