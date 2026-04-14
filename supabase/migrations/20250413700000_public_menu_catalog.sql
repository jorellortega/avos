-- Live menu prices + out-of-stock flags (JSON in ai_settings). Public read for ordering UI.

INSERT INTO public.ai_settings (setting_key, setting_value, description)
VALUES (
  'public_menu_catalog',
  $json${
    "categoriaPrecios": {},
    "bebidaPrecios": {},
    "camarónExtra": null,
    "outCategorias": [],
    "outProteinas": [],
    "outBebidas": []
  }$json$,
  'JSON: categoriaPrecios, bebidaPrecios, camarónExtra, outCategorias, outProteinas, outBebidas'
)
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.jwt_user_can_edit_menu_catalog()
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
      AND u.role IN (
        'staff'::public.app_user_role,
        'manager'::public.app_user_role,
        'ceo'::public.app_user_role
      )
  );
$$;

REVOKE ALL ON FUNCTION public.jwt_user_can_edit_menu_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jwt_user_can_edit_menu_catalog() TO authenticated;

DROP POLICY IF EXISTS "Public read site media ai_settings" ON public.ai_settings;

CREATE POLICY "Public read site media ai_settings"
  ON public.ai_settings FOR SELECT
  TO anon, authenticated
  USING (
    setting_key IN (
      'public_hero_slides',
      'public_menu_banner',
      'public_menu_categoria_imagenes',
      'public_proteina_imagenes',
      'public_menu_catalog'
    )
  );

DROP POLICY IF EXISTS "Staff can update menu catalog" ON public.ai_settings;

CREATE POLICY "Staff can update menu catalog"
  ON public.ai_settings FOR UPDATE
  TO authenticated
  USING (
    setting_key = 'public_menu_catalog'
    AND public.jwt_user_can_edit_menu_catalog()
  )
  WITH CHECK (
    setting_key = 'public_menu_catalog'
    AND public.jwt_user_can_edit_menu_catalog()
  );

COMMENT ON FUNCTION public.jwt_user_can_edit_menu_catalog() IS
  'True if auth user is staff, manager, or ceo; used to update public_menu_catalog without users RLS recursion.';
