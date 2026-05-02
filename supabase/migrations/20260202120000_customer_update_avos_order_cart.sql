-- Let customers sync cart edits to avos_orders before Stripe checkout (was local-only).

CREATE OR REPLACE FUNCTION public.customer_update_avos_order_cart(
  p_id uuid,
  p_items jsonb,
  p_total numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.avos_orders%ROWTYPE;
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
      RAISE EXCEPTION 'not allowed';
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
  INTO expected
  FROM (SELECT jsonb_array_elements(p_items) AS line) lines;

  IF EXISTS (
    SELECT 1
    FROM (SELECT jsonb_array_elements(p_items) AS line) lines
    WHERE COALESCE((line->>'precio')::numeric, 0) <= 0
       OR COALESCE((line->>'precio')::numeric, 0) > 25000
  ) THEN
    RAISE EXCEPTION 'invalid item price';
  END IF;

  IF ABS(expected - p_total) > 0.02 THEN
    RAISE EXCEPTION 'total mismatch';
  END IF;

  UPDATE public.avos_orders
  SET
    items = p_items,
    total = p_total,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_update_avos_order_cart(uuid, jsonb, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_update_avos_order_cart(uuid, jsonb, numeric) TO anon, authenticated;

COMMENT ON FUNCTION public.customer_update_avos_order_cart(uuid, jsonb, numeric) IS
  'Customer updates pending order lines + total (e.g. after Modificar pedido) so checkout matches the screen.';
