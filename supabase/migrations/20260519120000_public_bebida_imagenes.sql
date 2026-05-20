-- Thumbnail URL per drink flavor (jamaica, pina, …) for menu / ordenar / staff.

INSERT INTO public.ai_settings (setting_key, setting_value, description)
VALUES (
  'public_bebida_imagenes',
  '{}',
  'JSON: bebida id -> image URL (per-drink thumbnails)'
)
ON CONFLICT (setting_key) DO NOTHING;

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
      'public_bebida_imagenes',
      'public_menu_catalog'
    )
  );
