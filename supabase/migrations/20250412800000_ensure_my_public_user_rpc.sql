-- Self-heal: if auth.users exists but public.users row is missing (trigger skipped / failed),
-- the app can call this once per session; runs as definer so it can read auth.users.

CREATE OR REPLACE FUNCTION public.ensure_my_public_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = uid) THEN
    RETURN;
  END IF;

  INSERT INTO public.users (id, email, full_name, role)
  SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', ''),
    public.text_to_app_user_role(
      CASE
        WHEN COALESCE(au.raw_user_meta_data->>'registration_channel', '') = 'staff' THEN 'staff'
        ELSE 'user'
      END
    )
  FROM auth.users au
  WHERE au.id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_public_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_public_user() TO authenticated;

COMMENT ON FUNCTION public.ensure_my_public_user() IS
  'Creates public.users row for auth.uid() if missing (signup trigger gap).';
