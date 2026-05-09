-- Applicant city (municipality), not street address; required for new applications via app.

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '';

ALTER TABLE public.job_applications
  ALTER COLUMN city DROP DEFAULT;

COMMENT ON COLUMN public.job_applications.city IS 'Applicant city or town only; not full street address.';
