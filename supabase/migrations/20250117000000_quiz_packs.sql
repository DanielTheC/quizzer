-- Quiz pack system: packs, rounds, questions (answer column replaced by quiz_answers in 20260402100000).
-- RLS: answers restricted to allowlisted host emails after that migration.

CREATE TABLE IF NOT EXISTS quiz_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_pack_id uuid NOT NULL REFERENCES quiz_packs(id) ON DELETE CASCADE,
  round_number int NOT NULL CHECK (round_number >= 1 AND round_number <= 9),
  title text NOT NULL,
  UNIQUE(quiz_pack_id, round_number)
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_round_id uuid NOT NULL REFERENCES quiz_rounds(id) ON DELETE CASCADE,
  question_number int NOT NULL CHECK (question_number >= 1 AND question_number <= 10),
  question_text text NOT NULL,
  host_notes text,
  answer text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_rounds_pack ON quiz_rounds(quiz_pack_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_round ON quiz_questions(quiz_round_id);

ALTER TABLE quiz_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read quiz_packs" ON quiz_packs FOR SELECT USING (true);
CREATE POLICY "Allow read quiz_rounds" ON quiz_rounds FOR SELECT USING (true);
CREATE POLICY "Allow read quiz_questions" ON quiz_questions FOR SELECT USING (true);

COMMENT ON TABLE quiz_packs IS 'Quiz pack (8 rounds + picture round)';
COMMENT ON COLUMN quiz_rounds.round_number IS '1-8 = normal rounds, 9 = picture round';
COMMENT ON COLUMN quiz_questions.answer IS 'Host-only answer; shown when host reveals';
