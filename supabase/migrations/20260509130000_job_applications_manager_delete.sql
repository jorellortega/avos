-- Allow manager/CEO to delete job applications from /jobs-edit.

DROP POLICY IF EXISTS "Manager CEO delete job_applications" ON public.job_applications;
CREATE POLICY "Manager CEO delete job_applications"
  ON public.job_applications FOR DELETE
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo());

GRANT DELETE ON public.job_applications TO authenticated;
