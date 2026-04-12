-- Thumbnail URL per protein (Asada, Pollo, Pastor, Camarón) for menu / ordenar / staff.

INSERT INTO public.ai_settings (setting_key, setting_value, description)
VALUES (
  'public_proteina_imagenes',
  $json${
    "Asada": "/placeholder.svg",
    "Pollo": "/placeholder.svg",
    "Pastor": "/placeholder.svg",
    "Camarón": "/placeholder.svg"
  }$json$,
  'JSON: protein name -> image URL (selector de proteína)'
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
      'public_proteina_imagenes'
    )
  );
