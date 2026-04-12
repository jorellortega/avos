-- Four roles: user (clientes), staff, manager, ceo.
-- Nuevas cuentas → 'user' salvo que raw_user_meta_data.registration_channel = 'staff' (registro personal).

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'staff', 'manager', 'ceo'));

ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'user';

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
