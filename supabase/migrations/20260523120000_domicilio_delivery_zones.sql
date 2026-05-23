-- Home delivery (domicilio) for Pastor Ortiz: zones + fees in ai_settings; orders store zone/fee.

ALTER TABLE public.avos_orders
  ADD COLUMN IF NOT EXISTS delivery_zone_id text,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(12, 2),
  ADD COLUMN IF NOT EXISTS delivery_address text;

COMMENT ON COLUMN public.avos_orders.delivery_zone_id IS
  'Colonia/sector id when order_type = domicilio.';
COMMENT ON COLUMN public.avos_orders.delivery_fee IS
  'Delivery fee in MXN (included in total).';
COMMENT ON COLUMN public.avos_orders.delivery_address IS
  'Street address / references for domicilio.';

ALTER TABLE public.avos_orders DROP CONSTRAINT IF EXISTS avos_orders_order_type_check;
ALTER TABLE public.avos_orders ADD CONSTRAINT avos_orders_order_type_check CHECK (
  order_type IN ('mesa', 'pickup', 'domicilio')
);

INSERT INTO public.ai_settings (setting_key, setting_value, description)
VALUES (
  'public_delivery_zones',
  $json${
    "cityLabel": "Pastor Ortiz, Michoacán",
    "zones": [
      {
        "id": "centro",
        "label": "Centro",
        "hint": "Alrededor de la parroquia y plaza",
        "fee": 35,
        "enabled": true,
        "mapRow": 1,
        "mapCol": 2
      },
      {
        "id": "colonia-norte",
        "label": "Colonia (norte)",
        "hint": "Zona noreste, cerca de la unidad deportiva",
        "fee": 40,
        "enabled": true,
        "mapRow": 0,
        "mapCol": 2
      },
      {
        "id": "colonia-oeste",
        "label": "Colonia (oeste)",
        "hint": "Al oeste del río / arroyo",
        "fee": 45,
        "enabled": true,
        "mapRow": 1,
        "mapCol": 0
      },
      {
        "id": "la-planta",
        "label": "La Planta",
        "hint": "Sector suroeste",
        "fee": 50,
        "enabled": true,
        "mapRow": 2,
        "mapCol": 0
      },
      {
        "id": "la-herradura",
        "label": "La Herradura",
        "hint": "Sobre Av. Hidalgo",
        "fee": 40,
        "enabled": true,
        "mapRow": 1,
        "mapCol": 1
      },
      {
        "id": "los-vazquez",
        "label": "Los Vázquez",
        "hint": "Sur del centro",
        "fee": 45,
        "enabled": true,
        "mapRow": 2,
        "mapCol": 1
      },
      {
        "id": "lazaro-cardenas",
        "label": "Lázaro Cárdenas",
        "hint": "Zona sur",
        "fee": 55,
        "enabled": true,
        "mapRow": 2,
        "mapCol": 2
      }
    ]
  }$json$,
  'JSON: delivery zones for Pastor Ortiz (label, fee, map position)'
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
      'public_order_customizations',
      'public_delivery_zones'
    )
  );

DROP POLICY IF EXISTS "CEO can update delivery zones" ON public.ai_settings;
CREATE POLICY "CEO can update delivery zones"
  ON public.ai_settings FOR UPDATE
  TO authenticated
  USING (
    setting_key = 'public_delivery_zones'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'ceo'::public.app_user_role
    )
  )
  WITH CHECK (
    setting_key = 'public_delivery_zones'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'ceo'::public.app_user_role
    )
  );

CREATE OR REPLACE FUNCTION public.insert_avos_order(
  p_id uuid,
  p_numero integer,
  p_total numeric,
  p_status text,
  p_order_type text,
  p_mesa text,
  p_nombre_cliente text,
  p_items jsonb,
  p_customer_user_id uuid DEFAULT NULL,
  p_delivery_zone_id text DEFAULT NULL,
  p_delivery_fee numeric DEFAULT NULL,
  p_delivery_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_enabled boolean;
BEGIN
  v_uid := auth.uid();

  SELECT os.ordering_enabled
  INTO v_enabled
  FROM public.ordering_settings os
  WHERE os.id = 1;

  IF COALESCE(v_enabled, true) = false AND public.jwt_user_is_staff_like() = false THEN
    RAISE EXCEPTION 'ordering_disabled';
  END IF;

  IF p_customer_user_id IS NOT NULL THEN
    IF v_uid IS NULL OR v_uid IS DISTINCT FROM p_customer_user_id THEN
      RAISE EXCEPTION 'invalid customer user';
    END IF;
  END IF;

  IF p_total IS NULL OR p_total <= 0 OR p_total > 100000 THEN
    RAISE EXCEPTION 'invalid total';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'invalid items';
  END IF;
  IF p_status NOT IN ('pendiente', 'preparando', 'listo', 'entregado', 'pagado') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  IF p_order_type NOT IN ('mesa', 'pickup', 'domicilio') THEN
    RAISE EXCEPTION 'invalid order type';
  END IF;

  INSERT INTO public.avos_orders (
    id,
    numero,
    total,
    status,
    order_type,
    mesa,
    nombre_cliente,
    items,
    customer_user_id,
    delivery_zone_id,
    delivery_fee,
    delivery_address
  )
  VALUES (
    p_id,
    p_numero,
    p_total,
    p_status,
    p_order_type,
    NULLIF(trim(COALESCE(p_mesa, '')), ''),
    NULLIF(trim(COALESCE(p_nombre_cliente, '')), ''),
    p_items,
    p_customer_user_id,
    NULLIF(trim(COALESCE(p_delivery_zone_id, '')), ''),
    CASE WHEN p_delivery_fee IS NULL OR p_delivery_fee < 0 THEN NULL ELSE p_delivery_fee END,
    NULLIF(trim(COALESCE(p_delivery_address, '')), '')
  );
END;
$$;
