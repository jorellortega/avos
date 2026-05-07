-- Global toggle for customer ordering (on/off) + optional message.

CREATE TABLE IF NOT EXISTS public.ordering_settings (
  id integer PRIMARY KEY,
  ordering_enabled boolean NOT NULL DEFAULT true,
  closed_message text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Singleton row
INSERT INTO public.ordering_settings (id, ordering_enabled, closed_message)
VALUES (1, true, '')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ordering_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read ordering_settings" ON public.ordering_settings;
CREATE POLICY "Public read ordering_settings"
  ON public.ordering_settings FOR SELECT
  TO anon, authenticated
  USING (id = 1);

DROP POLICY IF EXISTS "Manager CEO update ordering_settings" ON public.ordering_settings;
CREATE POLICY "Manager CEO update ordering_settings"
  ON public.ordering_settings FOR UPDATE
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo())
  WITH CHECK (public.jwt_user_is_manager_or_ceo());

COMMENT ON TABLE public.ordering_settings IS
  'Singleton table (id=1) controlling whether customer ordering is enabled.';

-- Enforce toggle at the DB level for customer order creation.
-- Staff/manager/CEO are allowed to create orders even when closed.
CREATE OR REPLACE FUNCTION public.insert_avos_order(
  p_id uuid,
  p_numero integer,
  p_total numeric,
  p_status text,
  p_order_type text,
  p_mesa text,
  p_nombre_cliente text,
  p_items jsonb,
  p_customer_user_id uuid DEFAULT NULL
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
  IF p_order_type NOT IN ('mesa', 'pickup') THEN
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
    customer_user_id
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
    p_customer_user_id
  );
END;
$$;

