-- Publicans can see host-claim status for quiz events at their venue (portal dashboard).

CREATE POLICY "Publicans read claims for own venue quiz events"
  ON public.quiz_claims FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_events qe
      JOIN public.publican_profiles pp ON pp.venue_id = qe.venue_id
      WHERE qe.id = quiz_claims.quiz_event_id
        AND pp.id = auth.uid()
    )
  );
