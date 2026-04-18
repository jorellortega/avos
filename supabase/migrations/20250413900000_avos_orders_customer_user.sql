-- Link guest orders to auth user when cliente está logueado (Mi cuenta / pedidos).

ALTER TABLE public.avos_orders
  ADD COLUMN IF NOT EXISTS customer_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS avos_orders_customer_user_id_idx
  ON public.avos_orders (customer_user_id)
  WHERE customer_user_id IS NOT NULL;

COMMENT ON COLUMN public.avos_orders.customer_user_id IS
  'auth user who placed the order (cliente); NULL for invitados.';

-- Replace insert RPC with optional customer id (must match auth.uid() when set).
DROP FUNCTION IF EXISTS public.insert_avos_order(
  uuid, integer, numeric, text, text, text, text, jsonb
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
  p_customer_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
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

REVOKE ALL ON FUNCTION public.insert_avos_order(
  uuid, integer, numeric, text, text, text, text, jsonb, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_avos_order(
  uuid, integer, numeric, text, text, text, text, jsonb, uuid
) TO anon, authenticated;

-- Clientes: solo sus pedidos (además del acceso staff existente).
DROP POLICY IF EXISTS "Customers read own avos_orders" ON public.avos_orders;
CREATE POLICY "Customers read own avos_orders"
  ON public.avos_orders FOR SELECT
  TO authenticated
  USING (
    customer_user_id IS NOT NULL
    AND customer_user_id = auth.uid()
  );
