-- Public job listings + applications; manager/CEO manage posts and review submissions.

CREATE TABLE IF NOT EXISTS public.job_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  employment_type text NOT NULL DEFAULT 'Tiempo completo',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS job_posts_active_sort_idx
  ON public.job_posts (is_active, sort_order, id);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id uuid NOT NULL REFERENCES public.job_posts (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'interview', 'hired', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS job_applications_job_post_idx
  ON public.job_applications (job_post_id, created_at DESC);

DROP TRIGGER IF EXISTS set_job_posts_updated_at ON public.job_posts;
CREATE TRIGGER set_job_posts_updated_at
  BEFORE UPDATE ON public.job_posts
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active job_posts" ON public.job_posts;
CREATE POLICY "Public read active job_posts"
  ON public.job_posts FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Manager CEO read all job_posts" ON public.job_posts;
CREATE POLICY "Manager CEO read all job_posts"
  ON public.job_posts FOR SELECT
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo());

DROP POLICY IF EXISTS "Manager CEO insert job_posts" ON public.job_posts;
CREATE POLICY "Manager CEO insert job_posts"
  ON public.job_posts FOR INSERT
  TO authenticated
  WITH CHECK (public.jwt_user_is_manager_or_ceo());

DROP POLICY IF EXISTS "Manager CEO update job_posts" ON public.job_posts;
CREATE POLICY "Manager CEO update job_posts"
  ON public.job_posts FOR UPDATE
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo())
  WITH CHECK (public.jwt_user_is_manager_or_ceo());

DROP POLICY IF EXISTS "Manager CEO delete job_posts" ON public.job_posts;
CREATE POLICY "Manager CEO delete job_posts"
  ON public.job_posts FOR DELETE
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo());

DROP POLICY IF EXISTS "Anyone insert application to active job" ON public.job_applications;
CREATE POLICY "Anyone insert application to active job"
  ON public.job_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.job_posts jp
      WHERE jp.id = job_post_id
        AND jp.is_active = true
    )
  );

DROP POLICY IF EXISTS "Manager CEO select job_applications" ON public.job_applications;
CREATE POLICY "Manager CEO select job_applications"
  ON public.job_applications FOR SELECT
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo());

DROP POLICY IF EXISTS "Manager CEO update job_applications" ON public.job_applications;
CREATE POLICY "Manager CEO update job_applications"
  ON public.job_applications FOR UPDATE
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo())
  WITH CHECK (public.jwt_user_is_manager_or_ceo());

GRANT SELECT ON public.job_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.job_posts TO authenticated;

GRANT INSERT ON public.job_applications TO anon, authenticated;
GRANT SELECT, UPDATE ON public.job_applications TO authenticated;

COMMENT ON TABLE public.job_posts IS 'Hiring listings; public sees active rows; manager/CEO CRUD at /jobs-edit.';
COMMENT ON TABLE public.job_applications IS 'Job applications; public insert for active jobs; manager/CEO read/update at /jobs-edit.';
