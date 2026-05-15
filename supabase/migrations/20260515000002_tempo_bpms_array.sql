ALTER TABLE practice_session_basic_menus
  ADD COLUMN tempo_bpms integer[];

UPDATE practice_session_basic_menus
  SET tempo_bpms = ARRAY[tempo_bpm]
  WHERE tempo_bpm IS NOT NULL;

ALTER TABLE practice_session_basic_menus
  DROP COLUMN tempo_bpm;
