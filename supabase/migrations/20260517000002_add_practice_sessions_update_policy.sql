create policy "自分の練習記録を編集可能"
  on practice_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
