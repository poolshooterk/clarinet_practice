ALTER TABLE practice_session_basic_menus
  ADD COLUMN tempo_bpm INT CHECK (tempo_bpm BETWEEN 40 AND 240);
