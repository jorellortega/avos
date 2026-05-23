-- Per-platillo order customization options (con todo, sin salsa, etc.) for public ordering UI.

INSERT INTO public.ai_settings (setting_key, setting_value, description)
VALUES (
  'public_order_customizations',
  $json${
    "global": {
      "defaultLabel": "Con todo",
      "defaultId": "con-todo",
      "options": [
        { "id": "sin-aguacate", "label": "Sin aguacate" },
        { "id": "sin-cebolla", "label": "Sin cebolla" },
        { "id": "sin-cilantro", "label": "Sin cilantro" },
        { "id": "sin-salsa", "label": "Sin salsa" },
        { "id": "sin-frijoles", "label": "Sin frijoles" },
        { "id": "sin-queso", "label": "Sin queso" },
        { "id": "sin-arroz", "label": "Sin arroz" },
        { "id": "extra-salsa", "label": "Extra salsa" }
      ]
    },
    "byPlatillo": {}
  }$json$,
  'JSON: global + byPlatillo customization chips per menu item'
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
      'public_menu_catalog',
      'public_order_customizations'
    )
  );

DROP POLICY IF EXISTS "Staff can update order customizations" ON public.ai_settings;

CREATE POLICY "Staff can update order customizations"
  ON public.ai_settings FOR UPDATE
  TO authenticated
  USING (
    setting_key = 'public_order_customizations'
    AND public.jwt_user_can_edit_menu_catalog()
  )
  WITH CHECK (
    setting_key = 'public_order_customizations'
    AND public.jwt_user_can_edit_menu_catalog()
  );
