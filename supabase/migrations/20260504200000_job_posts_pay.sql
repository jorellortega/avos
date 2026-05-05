-- Optional compensation text shown on public job listings and admin cards.

ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS pay text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.job_posts.pay IS
  'Compensation shown to applicants (e.g. $/hr, rango, or "Según experiencia").';
