-- One-shot: TEXT role -> app_user_role ENUM.
-- Your DB may still have profiles_role_check + users_role_check — both must drop before ALTER.
-- USING (...) cannot mix enum/text in CASE; use a helper that only compares text.

DO $$
BEGIN
  CREATE TYPE public.app_user_role AS ENUM ('user', 'staff', 'manager', 'ceo');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Map plain text -> enum (no CASE enum=text in ALTER USING)
CREATE OR REPLACE FUNCTION public.text_to_app_user_role(t text)
RETURNS public.app_user_role
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  x text := lower(trim(COALESCE(t, '')));
BEGIN
  IF x IN ('', 'user') THEN
    RETURN 'user'::public.app_user_role;
  END IF;
  IF x = 'staff' THEN
    RETURN 'staff'::public.app_user_role;
  END IF;
  IF x = 'manager' THEN
    RETURN 'manager'::public.app_user_role;
  END IF;
  IF x = 'ceo' THEN
    RETURN 'ceo'::public.app_user_role;
  END IF;
  RETURN 'user'::public.app_user_role;
END;
$$;

DROP POLICY IF EXISTS "Users select own" ON public.users;
DROP POLICY IF EXISTS "Users select all CEO" ON public.users;
DROP POLICY IF EXISTS "Users update own or CEO" ON public.users;
DROP POLICY IF EXISTS "CEO can select ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "CEO can insert ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "CEO can update ai_settings" ON public.ai_settings;

-- Old table name leftovers + new check — all reference role as text
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

DROP TRIGGER IF EXISTS users_role_guard ON public.users;
DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;

DROP INDEX IF EXISTS public.users_role_idx;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
      AND udt_name = 'app_user_role'
  ) THEN
    RAISE NOTICE 'users.role is already app_user_role; skipping ALTER COLUMN';
  ELSE
    ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public.users
      ALTER COLUMN role TYPE public.app_user_role
      USING (public.text_to_app_user_role(role::text));
    ALTER TABLE public.users
      ALTER COLUMN role SET DEFAULT 'user'::public.app_user_role;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users USING btree (role);

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_public_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_role public.app_user_role;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'registration_channel', '') = 'staff' THEN
    new_role := 'staff'::public.app_user_role;
  ELSE
    new_role := 'user'::public.app_user_role;
  END IF;

  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    new_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- New signups only get a public.users row if this trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_public_user ON auth.users;
CREATE TRIGGER on_auth_user_created_public_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_public_user();

CREATE OR REPLACE FUNCTION public.users_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role public.app_user_role;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Unqualified CURRENT_USER: pg_catalog.current_user is parsed as table.column in PL/pgSQL
    IF CURRENT_USER::text NOT IN ('authenticated', 'anon') THEN
      RETURN NEW;
    END IF;
    IF COALESCE((SELECT auth.jwt()->>'role'), '') = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
    SELECT u.role INTO actor_role FROM public.users u WHERE u.id = auth.uid();
    IF actor_role IS DISTINCT FROM 'ceo'::public.app_user_role THEN
      RAISE EXCEPTION 'Only CEO can change roles' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_role_guard
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.users_before_update();

INSERT INTO public.users (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  public.text_to_app_user_role(
    CASE
      WHEN COALESCE(u.raw_user_meta_data->>'registration_channel', '') = 'staff' THEN 'staff'
      ELSE 'user'
    END
  )
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.users x WHERE x.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- CEO check must NOT subquery public.users inside policies (42P17 infinite recursion).
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

CREATE OR REPLACE VIEW public.app_user_role_values AS
SELECT unnest(enum_range(NULL::public.app_user_role))::text AS role;

COMMENT ON VIEW public.app_user_role_values IS 'Allowed values for public.users.role (public.app_user_role ENUM).';

GRANT SELECT ON public.app_user_role_values TO authenticated, anon;

COMMENT ON TYPE public.app_user_role IS 'user=cliente, staff=personal, manager, ceo';
