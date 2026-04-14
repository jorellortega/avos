-- Para llevar (pickup): solo tarjeta; efectivo rechazado en intención y en confirmación de caja.

CREATE OR REPLACE FUNCTION public.record_customer_payment_intent(
  p_id uuid,
  p_payment_method text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ot text;
BEGIN
  IF p_payment_method NOT IN ('efectivo', 'tarjeta') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  SELECT o.order_type INTO ot FROM public.avos_orders o WHERE o.id = p_id;
  IF ot IS NULL THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  IF ot = 'pickup' AND p_payment_method = 'efectivo' THEN
    RAISE EXCEPTION 'Para llevar solo se acepta pago con tarjeta';
  END IF;

  UPDATE public.avos_orders
  SET
    payment_method = p_payment_method,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_id
    AND paid_at IS NULL
    AND status = 'pendiente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found or already paid';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_confirm_avos_order_payment(
  p_id uuid,
  p_payment_method text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ot text;
BEGIN
  IF NOT public.jwt_user_is_staff_like() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_payment_method NOT IN ('efectivo', 'tarjeta') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  SELECT o.order_type INTO ot FROM public.avos_orders o WHERE o.id = p_id;
  IF ot IS NULL THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  IF ot = 'pickup' AND p_payment_method = 'efectivo' THEN
    RAISE EXCEPTION 'Para llevar solo se acepta pago con tarjeta';
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
