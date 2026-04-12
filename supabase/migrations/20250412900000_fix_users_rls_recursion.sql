-- Policies that did EXISTS (SELECT ... FROM public.users ...) caused 42P17
-- "infinite recursion detected in policy for relation users" — evaluating
-- policies on users re-entered RLS on the same table. Use SECURITY DEFINER instead.

CREATE OR REPLACE FUNCTION public.jwt_user_is_ceo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'ceo'::public.app_user_role
  );
$$;

REVOKE ALL ON FUNCTION public.jwt_user_is_ceo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jwt_user_is_ceo() TO authenticated;

DROP POLICY IF EXISTS "Users select own" ON public.users;
DROP POLICY IF EXISTS "Users select all CEO" ON public.users;
DROP POLICY IF EXISTS "Users update own or CEO" ON public.users;
DROP POLICY IF EXISTS "CEO can select ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "CEO can insert ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "CEO can update ai_settings" ON public.ai_settings;

CREATE POLICY "Users select own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users select all CEO"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.jwt_user_is_ceo());

CREATE POLICY "Users update own or CEO"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.jwt_user_is_ceo())
  WITH CHECK (public.jwt_user_is_ceo() OR auth.uid() = id);

CREATE POLICY "CEO can select ai_settings"
  ON public.ai_settings FOR SELECT
  TO authenticated
  USING (public.jwt_user_is_ceo());

CREATE POLICY "CEO can insert ai_settings"
  ON public.ai_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.jwt_user_is_ceo());

CREATE POLICY "CEO can update ai_settings"
  ON public.ai_settings FOR UPDATE
  TO authenticated
  USING (public.jwt_user_is_ceo())
  WITH CHECK (public.jwt_user_is_ceo());

COMMENT ON FUNCTION public.jwt_user_is_ceo() IS
  'True if JWT subject has role ceo in public.users; bypasses RLS to avoid policy recursion.';
