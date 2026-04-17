-- Operator CRUD on quiz pack tables for admin tools.
-- Public SELECT policies remain unchanged.

-- quiz_packs
DROP POLICY IF EXISTS "Operators insert quiz_packs" ON public.quiz_packs;
CREATE POLICY "Operators insert quiz_packs"
  ON public.quiz_packs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators update quiz_packs" ON public.quiz_packs;
CREATE POLICY "Operators update quiz_packs"
  ON public.quiz_packs
  FOR UPDATE
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators delete quiz_packs" ON public.quiz_packs;
CREATE POLICY "Operators delete quiz_packs"
  ON public.quiz_packs
  FOR DELETE
  TO authenticated
  USING (public.is_operator());

-- quiz_rounds
DROP POLICY IF EXISTS "Operators insert quiz_rounds" ON public.quiz_rounds;
CREATE POLICY "Operators insert quiz_rounds"
  ON public.quiz_rounds
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators update quiz_rounds" ON public.quiz_rounds;
CREATE POLICY "Operators update quiz_rounds"
  ON public.quiz_rounds
  FOR UPDATE
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators delete quiz_rounds" ON public.quiz_rounds;
CREATE POLICY "Operators delete quiz_rounds"
  ON public.quiz_rounds
  FOR DELETE
  TO authenticated
  USING (public.is_operator());

-- quiz_questions
DROP POLICY IF EXISTS "Operators insert quiz_questions" ON public.quiz_questions;
CREATE POLICY "Operators insert quiz_questions"
  ON public.quiz_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators update quiz_questions" ON public.quiz_questions;
CREATE POLICY "Operators update quiz_questions"
  ON public.quiz_questions
  FOR UPDATE
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators delete quiz_questions" ON public.quiz_questions;
CREATE POLICY "Operators delete quiz_questions"
  ON public.quiz_questions
  FOR DELETE
  TO authenticated
  USING (public.is_operator());

-- quiz_answers
DROP POLICY IF EXISTS "Operators insert quiz_answers" ON public.quiz_answers;
CREATE POLICY "Operators insert quiz_answers"
  ON public.quiz_answers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators update quiz_answers" ON public.quiz_answers;
CREATE POLICY "Operators update quiz_answers"
  ON public.quiz_answers
  FOR UPDATE
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators delete quiz_answers" ON public.quiz_answers;
CREATE POLICY "Operators delete quiz_answers"
  ON public.quiz_answers
  FOR DELETE
  TO authenticated
  USING (public.is_operator());
