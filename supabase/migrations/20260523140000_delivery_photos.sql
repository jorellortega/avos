-- Street + house photos for domicilio orders (Supabase Storage + order columns).

ALTER TABLE public.avos_orders
  ADD COLUMN IF NOT EXISTS delivery_photo_street_url text,
  ADD COLUMN IF NOT EXISTS delivery_photo_house_url text;

COMMENT ON COLUMN public.avos_orders.delivery_photo_street_url IS
  'Customer photo of the street for delivery.';
COMMENT ON COLUMN public.avos_orders.delivery_photo_house_url IS
  'Customer photo of the house/facade for delivery.';

DROP POLICY IF EXISTS "Anyone insert delivery photos" ON storage.objects;
CREATE POLICY "Anyone insert delivery photos"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'files'
    AND (storage.foldername(name))[1] = 'delivery-photos'
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
  p_delivery_address text DEFAULT NULL,
  p_delivery_photo_street_url text DEFAULT NULL,
  p_delivery_photo_house_url text DEFAULT NULL
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
    delivery_address,
    delivery_photo_street_url,
    delivery_photo_house_url
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
    NULLIF(trim(COALESCE(p_delivery_photo_house_url, '')), '')
  );
END;
$$;
