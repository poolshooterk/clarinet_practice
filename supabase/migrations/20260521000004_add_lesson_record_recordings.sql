CREATE TABLE lesson_record_recordings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_record_id UUID NOT NULL REFERENCES lesson_records(id) ON DELETE CASCADE,
  index            INTEGER NOT NULL CHECK (index BETWEEN 1 AND 3),
  local_uri        TEXT NOT NULL,
  memo             TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lesson_record_id, index)
);
ALTER TABLE lesson_record_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_lesson_recordings"
  ON lesson_record_recordings FOR ALL
  USING (lesson_record_id IN (SELECT id FROM lesson_records WHERE user_id = auth.uid()));
