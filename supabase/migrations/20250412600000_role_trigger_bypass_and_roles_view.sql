-- Fix: SQL Editor sessions may use DB roles other than postgres/supabase_admin.
-- Allow role changes whenever the session is NOT the API roles (authenticated/anon).
-- PostgREST from the app uses "authenticated" → CEO check still applies there.

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
    -- Dashboard SQL, migrations, extensions: not the anon/authenticated API role
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

-- Optional: browse allowed roles (enum is not a table; this view lists values)
CREATE OR REPLACE VIEW public.app_user_role_values AS
SELECT unnest(enum_range(NULL::public.app_user_role))::text AS role;

COMMENT ON VIEW public.app_user_role_values IS 'Allowed values for public.users.role (public.app_user_role ENUM).';

GRANT SELECT ON public.app_user_role_values TO authenticated, anon;

COMMENT ON TYPE public.app_user_role IS 'user=cliente, staff=personal, manager, ceo';
