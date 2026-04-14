-- Guest orders + payment tracking for staff reporting (efectivo / tarjeta).

CREATE TABLE IF NOT EXISTS public.avos_orders (
  id uuid PRIMARY KEY,
  numero integer NOT NULL,
  total numeric(12, 2) NOT NULL,
  status text NOT NULL CHECK (
    status IN ('pendiente', 'preparando', 'listo', 'entregado', 'pagado')
  ),
  order_type text NOT NULL CHECK (order_type IN ('mesa', 'pickup')),
  mesa text,
  nombre_cliente text,
  items jsonb NOT NULL,
  payment_method text CHECK (
    payment_method IS NULL OR payment_method IN ('efectivo', 'tarjeta')
  ),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS avos_orders_created_at_idx
  ON public.avos_orders (created_at DESC);

CREATE INDEX IF NOT EXISTS avos_orders_numero_idx
  ON public.avos_orders (numero);

DROP TRIGGER IF EXISTS set_avos_orders_updated_at ON public.avos_orders;
CREATE TRIGGER set_avos_orders_updated_at
  BEFORE UPDATE ON public.avos_orders
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

COMMENT ON TABLE public.avos_orders IS
  'Orders mirrored from POS flow; payment_method set when customer pays on /orden/[n].';

-- Staff / manager / CEO can list orders (bypasses RLS recursion via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.jwt_user_is_staff_like()
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

REVOKE ALL ON FUNCTION public.jwt_user_is_staff_like() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jwt_user_is_staff_like() TO authenticated;

ALTER TABLE public.avos_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff-like can select avos_orders" ON public.avos_orders;
CREATE POLICY "Staff-like can select avos_orders"
  ON public.avos_orders FOR SELECT
  TO authenticated
  USING (public.jwt_user_is_staff_like());

-- No direct INSERT/UPDATE for clients; use RPCs below.

CREATE OR REPLACE FUNCTION public.insert_avos_order(
  p_id uuid,
  p_numero integer,
  p_total numeric,
  p_status text,
  p_order_type text,
  p_mesa text,
  p_nombre_cliente text,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    items
  )
  VALUES (
    p_id,
    p_numero,
    p_total,
    p_status,
    p_order_type,
    NULLIF(trim(COALESCE(p_mesa, '')), ''),
    NULLIF(trim(COALESCE(p_nombre_cliente, '')), ''),
    p_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.insert_avos_order(
  uuid, integer, numeric, text, text, text, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_avos_order(
  uuid, integer, numeric, text, text, text, text, jsonb
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_avos_order_payment(
  p_id uuid,
  p_payment_method text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_payment_method NOT IN ('efectivo', 'tarjeta') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  UPDATE public.avos_orders
  SET
    payment_method = p_payment_method,
    paid_at = timezone('utc'::text, now()),
    status = 'pagado',
    updated_at = timezone('utc'::text, now())
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_avos_order_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_avos_order_payment(uuid, text) TO anon, authenticated;
