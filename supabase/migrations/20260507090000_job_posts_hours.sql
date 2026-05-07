-- Optional hours shown on public job listings and admin cards.

ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS hours text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.job_posts.hours IS
  'Hours for the position (e.g. 20-30 hrs/semana, 30+ hrs, turnos).';

