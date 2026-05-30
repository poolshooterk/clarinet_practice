-- 年間目標
CREATE TABLE annual_goals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year                 INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  title                TEXT NOT NULL,
  numeric_target       INTEGER CHECK (numeric_target > 0),
  numeric_unit         TEXT,
  year_end_review_text TEXT,
  year_end_achievement TEXT CHECK (year_end_achievement IN ('achieved','partial','unachieved')),
  year_end_reviewed_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE annual_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY annual_goals_select ON annual_goals FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY annual_goals_insert ON annual_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY annual_goals_update ON annual_goals FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY annual_goals_delete ON annual_goals FOR DELETE
  USING (auth.uid() = user_id);

-- 月別マイルストーン (sparse)
CREATE TABLE monthly_milestones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_goal_id  UUID NOT NULL REFERENCES annual_goals(id) ON DELETE CASCADE,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  text            TEXT NOT NULL,
  numeric_target  INTEGER CHECK (numeric_target > 0),
  numeric_unit    TEXT,
  review_text     TEXT,
  achievement     TEXT CHECK (achievement IN ('achieved','partial','unachieved')),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (annual_goal_id, month)
);

ALTER TABLE monthly_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY monthly_milestones_select ON monthly_milestones FOR SELECT
  USING (EXISTS (SELECT 1 FROM annual_goals
                 WHERE id = monthly_milestones.annual_goal_id AND user_id = auth.uid()));
CREATE POLICY monthly_milestones_insert ON monthly_milestones FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM annual_goals
                      WHERE id = monthly_milestones.annual_goal_id AND user_id = auth.uid()));
CREATE POLICY monthly_milestones_update ON monthly_milestones FOR UPDATE
  USING (EXISTS (SELECT 1 FROM annual_goals
                 WHERE id = monthly_milestones.annual_goal_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM annual_goals
                      WHERE id = monthly_milestones.annual_goal_id AND user_id = auth.uid()));
CREATE POLICY monthly_milestones_delete ON monthly_milestones FOR DELETE
  USING (EXISTS (SELECT 1 FROM annual_goals
                 WHERE id = monthly_milestones.annual_goal_id AND user_id = auth.uid()));

CREATE INDEX monthly_milestones_goal_idx ON monthly_milestones (annual_goal_id);
