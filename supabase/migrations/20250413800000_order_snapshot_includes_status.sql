-- Customer poll: include kitchen workflow status (preparando, listo, etc.)
CREATE OR REPLACE FUNCTION public.get_avos_order_public_snapshot(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT jsonb_build_object(
      'paid_at', o.paid_at,
      'payment_method', o.payment_method,
      'status', o.status
    )
    FROM public.avos_orders o
    WHERE o.id = p_id
  );
$$;

REVOKE ALL ON FUNCTION public.get_avos_order_public_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_avos_order_public_snapshot(uuid) TO anon, authenticated;
