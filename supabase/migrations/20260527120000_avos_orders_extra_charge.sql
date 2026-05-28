-- Optional extra amount on portal/staff orders (tip, surcharge, etc.)

ALTER TABLE public.avos_orders
  ADD COLUMN IF NOT EXISTS extra_charge numeric(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.avos_orders.extra_charge IS
  'Optional additional charge added at register (not line items). Included in total.';

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
  p_delivery_address text DEFAULT NULL,
  p_delivery_photo_street_url text DEFAULT NULL,
  p_delivery_photo_house_url text DEFAULT NULL,
  p_extra_charge numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_enabled boolean;
  v_extra numeric;
BEGIN
  v_uid := auth.uid();
  v_extra := GREATEST(0, COALESCE(p_extra_charge, 0));

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
  IF v_extra > 10000 THEN
    RAISE EXCEPTION 'invalid extra charge';
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
    delivery_address,
    delivery_photo_street_url,
    delivery_photo_house_url,
    extra_charge
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
    NULLIF(trim(COALESCE(p_delivery_address, '')), ''),
    NULLIF(trim(COALESCE(p_delivery_photo_street_url, '')), ''),
    NULLIF(trim(COALESCE(p_delivery_photo_house_url, '')), ''),
    v_extra
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_update_avos_order_cart(
  p_id uuid,
  p_items jsonb,
  p_total numeric,
  p_extra_charge numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.avos_orders%ROWTYPE;
  items_sum numeric;
  fee numeric;
  extra numeric;
  expected numeric;
BEGIN
  SELECT * INTO o FROM public.avos_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF o.status IS DISTINCT FROM 'pendiente' OR o.paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'order not editable';
  END IF;

  IF o.customer_user_id IS NOT NULL THEN
    IF auth.uid() IS NULL OR o.customer_user_id IS DISTINCT FROM auth.uid() THEN
      IF public.jwt_user_is_staff_like() = false THEN
        RAISE EXCEPTION 'not allowed';
      END IF;
    END IF;
  END IF;

  IF p_total IS NULL OR p_total <= 0 OR p_total > 100000 THEN
    RAISE EXCEPTION 'invalid total';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'invalid items';
  END IF;

  SELECT COALESCE(
    SUM(
      COALESCE((line->>'precio')::numeric, 0)
        * GREATEST(1::numeric, FLOOR(COALESCE((line->>'cantidad')::numeric, 1)))
    ),
    0
  )
  INTO items_sum
  FROM (SELECT jsonb_array_elements(p_items) AS line) lines;

  IF EXISTS (
    SELECT 1
    FROM (SELECT jsonb_array_elements(p_items) AS line) lines
    WHERE COALESCE((line->>'precio')::numeric, 0) <= 0
       OR COALESCE((line->>'precio')::numeric, 0) > 25000
  ) THEN
    RAISE EXCEPTION 'invalid item price';
  END IF;

  fee := CASE
    WHEN o.order_type = 'domicilio' THEN GREATEST(0, COALESCE(o.delivery_fee, 0))
    ELSE 0
  END;

  extra := GREATEST(
    0,
    COALESCE(p_extra_charge, o.extra_charge, 0)
  );
  IF extra > 10000 THEN
    RAISE EXCEPTION 'invalid extra charge';
  END IF;

  expected := items_sum + fee + extra;

  IF ABS(expected - p_total) > 0.02 THEN
    RAISE EXCEPTION 'total mismatch';
  END IF;

  UPDATE public.avos_orders
  SET
    items = p_items,
    total = p_total,
    extra_charge = extra,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_update_avos_order_cart(uuid, jsonb, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_update_avos_order_cart(uuid, jsonb, numeric, numeric) TO anon, authenticated;

COMMENT ON FUNCTION public.customer_update_avos_order_cart(uuid, jsonb, numeric, numeric) IS
  'Updates pending order cart; total must equal items + delivery_fee (domicilio) + extra_charge.';
