-- Homepage hero + menu imagery stored in ai_settings; public read for anon (marketing site).

INSERT INTO public.ai_settings (setting_key, setting_value, description)
VALUES
  (
    'public_hero_slides',
    $json$[{"id":"slide-1","src":"/placeholder.jpg","alt":"Comida mexicana en Avos"},{"id":"slide-2","src":"/placeholder-user.jpg","alt":"Especialidades de la casa"},{"id":"slide-3","src":"/placeholder.jpg","alt":"Tacos y platillos frescos"},{"id":"slide-4","src":"/placeholder-user.jpg","alt":"Sabor estilo California"}]$json$,
    'Homepage hero carousel JSON: [{id,src,alt}, ...]'
  ),
  (
    'public_menu_banner',
    'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png',
    'Background image URL for /menu hero section'
  ),
  (
    'public_menu_categoria_imagenes',
    $json${
      "tacos": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png",
      "tortas": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png",
      "burritos": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png",
      "quesadillas": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png",
      "platillos": "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/EF86E926-0FA5-43B4-9510-F5D519A6D85E-ucnuQ69jJ38YUSen21k9W930qGkzQO.png"
    }$json$,
    'JSON object: category id -> image URL (menu cards + category pages)'
  )
ON CONFLICT (setting_key) DO NOTHING;

-- public_proteina_imagenes added in 20250413200000_public_proteina_imagenes.sql

DROP POLICY IF EXISTS "Public read site media ai_settings" ON public.ai_settings;

CREATE POLICY "Public read site media ai_settings"
  ON public.ai_settings FOR SELECT
  TO anon, authenticated
  USING (
    setting_key IN (
      'public_hero_slides',
      'public_menu_banner',
      'public_menu_categoria_imagenes'
    )
  );
