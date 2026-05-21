CREATE TABLE practice_session_recordings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  index       INTEGER NOT NULL CHECK (index BETWEEN 1 AND 3),
  local_uri   TEXT NOT NULL,
  memo        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, index)
);
ALTER TABLE practice_session_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_practice_recordings"
  ON practice_session_recordings FOR ALL
  USING (session_id IN (SELECT id FROM practice_sessions WHERE user_id = auth.uid()));
