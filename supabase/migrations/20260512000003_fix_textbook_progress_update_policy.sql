drop policy "自分の進捗を更新可能" on textbook_progress;

create policy "自分の進捗を更新可能"
  on textbook_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
