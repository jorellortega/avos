-- If you already applied the older migration that created public.profiles,
-- run this once to rename to public.users and refresh functions/policies.
-- Skip if you only ever ran 20250412100000_staff_users.sql with public.users.

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL AND to_regclass('public.users') IS NULL THEN
    ALTER TABLE public.profiles RENAME TO users;
  END IF;
END $$;

-- Align index name (if it was still profiles_role_idx)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles_role_idx'
  ) THEN
    ALTER INDEX public.profiles_role_idx RENAME TO users_role_idx;
  END IF;
END $$;

-- Functions must reference public.users explicitly
CREATE OR REPLACE FUNCTION public.users_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF COALESCE((SELECT auth.jwt()->>'role'), '') = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
    SELECT u.role INTO actor_role FROM public.users u WHERE u.id = auth.uid();
    IF actor_role IS DISTINCT FROM 'ceo' THEN
      RAISE EXCEPTION 'Only CEO can change roles' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_public_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'staff'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Triggers: reattach names on public.users
DROP TRIGGER IF EXISTS profiles_role_guard ON public.users;
DROP TRIGGER IF EXISTS users_role_guard ON public.users;
CREATE TRIGGER users_role_guard
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.users_before_update();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.users;
DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_public_user ON auth.users;
CREATE TRIGGER on_auth_user_created_public_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_public_user();

-- Policies: drop old names (profiles or users) and recreate
DROP POLICY IF EXISTS "Profiles select own" ON public.users;
DROP POLICY IF EXISTS "Profiles select all CEO" ON public.users;
DROP POLICY IF EXISTS "Profiles update own or CEO" ON public.users;
DROP POLICY IF EXISTS "Users select own" ON public.users;
DROP POLICY IF EXISTS "Users select all CEO" ON public.users;
DROP POLICY IF EXISTS "Users update own or CEO" ON public.users;

CREATE POLICY "Users select own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users select all CEO"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users pr
      WHERE pr.id = auth.uid() AND pr.role = 'ceo'
    )
  );

CREATE POLICY "Users update own or CEO"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.users pr
      WHERE pr.id = auth.uid() AND pr.role = 'ceo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users pr
      WHERE pr.id = auth.uid() AND pr.role = 'ceo'
    )
    OR auth.uid() = id
  );

-- ai_settings policies (subqueries must say public.users)
DROP POLICY IF EXISTS "CEO can select ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "CEO can insert ai_settings" ON public.ai_settings;
DROP POLICY IF EXISTS "CEO can update ai_settings" ON public.ai_settings;

CREATE POLICY "CEO can select ai_settings"
  ON public.ai_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users pr
      WHERE pr.id = auth.uid() AND pr.role = 'ceo'
    )
  );

CREATE POLICY "CEO can insert ai_settings"
  ON public.ai_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users pr
      WHERE pr.id = auth.uid() AND pr.role = 'ceo'
    )
  );

CREATE POLICY "CEO can update ai_settings"
  ON public.ai_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users pr
      WHERE pr.id = auth.uid() AND pr.role = 'ceo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users pr
      WHERE pr.id = auth.uid() AND pr.role = 'ceo'
    )
  );
