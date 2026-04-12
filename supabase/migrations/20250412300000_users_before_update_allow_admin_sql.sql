-- Fix: SQL Editor has no JWT → auth.uid() IS NULL → role updates were blocked.
-- Re-apply the same logic as 20250412100000_staff_users.sql (users_before_update).

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
