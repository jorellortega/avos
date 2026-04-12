-- 1) Enum for roles (replaces TEXT + CHECK)
-- 2) Backfill public.users for auth users missing a row (fixes "Sin perfil público")
-- 3) Trigger: allow role changes from SQL Editor (runs as postgres / supabase_admin), not only auth.uid() IS NULL

DO $$
BEGIN
  CREATE TYPE public.app_user_role AS ENUM ('user', 'staff', 'manager', 'ceo');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE public.users
  ALTER COLUMN role TYPE public.app_user_role
    USING (
      CASE COALESCE(role::text, 'user')
        WHEN 'user' THEN 'user'::public.app_user_role
        WHEN 'staff' THEN 'staff'::public.app_user_role
        WHEN 'manager' THEN 'manager'::public.app_user_role
        WHEN 'ceo' THEN 'ceo'::public.app_user_role
        ELSE 'user'::public.app_user_role
      END
    );

ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'user'::public.app_user_role;

-- Signup trigger (enum-safe)
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

-- Role guard: app users cannot self-promote; CEOs can change anyone; DB dashboard sessions can.
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
    -- SQL Editor / Dashboard scripts (superuser-style session)
    IF CURRENT_USER::text IN ('postgres', 'supabase_admin') THEN
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

-- Anyone in auth without a public.users row gets one
INSERT INTO public.users (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  CASE
    WHEN COALESCE(u.raw_user_meta_data->>'registration_channel', '') = 'staff' THEN 'staff'::public.app_user_role
    ELSE 'user'::public.app_user_role
  END
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.users x WHERE x.id = u.id)
ON CONFLICT (id) DO NOTHING;
