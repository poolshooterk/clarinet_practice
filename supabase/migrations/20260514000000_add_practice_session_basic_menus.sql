CREATE TABLE practice_session_basic_menus (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  menu_type        VARCHAR NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes >= 1),
  UNIQUE (session_id, menu_type)
);

ALTER TABLE practice_session_basic_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own basic menus"
  ON practice_session_basic_menus FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = practice_session_basic_menus.session_id
        AND practice_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own basic menus"
  ON practice_session_basic_menus FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = practice_session_basic_menus.session_id
        AND practice_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own basic menus"
  ON practice_session_basic_menus FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = practice_session_basic_menus.session_id
        AND practice_sessions.user_id = auth.uid()
    )
  );
