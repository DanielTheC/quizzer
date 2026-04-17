ALTER TABLE public.quiz_events ADD COLUMN IF NOT EXISTS prize_1st text;
ALTER TABLE public.quiz_events ADD COLUMN IF NOT EXISTS prize_2nd text;
ALTER TABLE public.quiz_events ADD COLUMN IF NOT EXISTS prize_3rd text;

COMMENT ON COLUMN public.quiz_events.prize_1st IS '1st place prize description, shown on host leaderboard';
COMMENT ON COLUMN public.quiz_events.prize_2nd IS '2nd place prize description';
COMMENT ON COLUMN public.quiz_events.prize_3rd IS '3rd place prize description';
