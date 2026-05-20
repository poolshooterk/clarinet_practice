-- 同日 (user_id, practiced_at) で 1 件のみとするための UNIQUE 制約
-- 既存重複が残っているとここで失敗する。残っていれば事前に手動で整理してから適用する
alter table practice_sessions
  add constraint practice_sessions_user_id_practiced_at_key
  unique (user_id, practiced_at);
