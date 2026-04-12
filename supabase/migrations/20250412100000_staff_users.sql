-- Public app users (public.users) linked to auth.users + auto-insert on signup.
-- Roles: user (clientes), staff (registro personal), manager, ceo.
-- Note: This is NOT auth.users — it is public.users for app profile + role.
--
-- First CEO: run in SQL Editor (Dashboard → SQL). No JWT there, so trigger allows it after 20250412300000 fix:
--   UPDATE public.users SET role = 'ceo' WHERE email = 'you@example.com';

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT DEFAULT '' NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'staff', 'manager', 'ceo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);

DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- Role changes: CEO in-app, service_role JWT, or no JWT (SQL Editor / dashboard SQL has no auth.uid()).
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
    -- Supabase SQL Editor / psql: no JWT → auth.uid() is NULL; allow trusted admin updates.
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

DROP TRIGGER IF EXISTS users_role_guard ON public.users;
CREATE TRIGGER users_role_guard
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.users_before_update();

CREATE OR REPLACE FUNCTION public.handle_new_public_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_role text;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'registration_channel', '') = 'staff' THEN
    new_role := 'staff';
  ELSE
    new_role := 'user';
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

DROP TRIGGER IF EXISTS on_auth_user_created_public_user ON auth.users;
CREATE TRIGGER on_auth_user_created_public_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_public_user();

-- Backfill existing auth users (e.g. created before this migration)
INSERT INTO public.users (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  CASE
    WHEN COALESCE(u.raw_user_meta_data->>'registration_channel', '') = 'staff' THEN 'staff'
    ELSE 'user'
  END
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.users x WHERE x.id = u.id)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own" ON public.users;
CREATE POLICY "Users select own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users select all CEO" ON public.users;
CREATE POLICY "Users select all CEO"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users pr
      WHERE pr.id = auth.uid() AND pr.role = 'ceo'
    )
  );

DROP POLICY IF EXISTS "Users update own or CEO" ON public.users;
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

-- ai_settings: CEO via public.users.role (replaces JWT-only checks)
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
