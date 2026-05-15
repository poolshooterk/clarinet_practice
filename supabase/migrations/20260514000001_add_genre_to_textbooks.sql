ALTER TABLE textbooks
  ADD COLUMN genre text NOT NULL DEFAULT 'その他'
    CHECK (genre IN ('スケール', 'エチュード', 'ソナタ', 'コンチェルト', 'アンサンブル', 'その他'));
