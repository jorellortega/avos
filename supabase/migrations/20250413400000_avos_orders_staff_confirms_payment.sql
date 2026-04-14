-- Customer only records how they plan to pay; staff confirms cash/card in person.

DROP FUNCTION IF EXISTS public.record_avos_order_payment(uuid, text);

-- Guest: save payment method (intent) only — order stays pendiente until staff confirms.
CREATE OR REPLACE FUNCTION public.record_customer_payment_intent(
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
    updated_at = timezone('utc'::text, now())
  WHERE id = p_id
    AND paid_at IS NULL
    AND status = 'pendiente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found or already paid';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_customer_payment_intent(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_customer_payment_intent(uuid, text) TO anon, authenticated;

-- Staff: mark payment received (cash or card at register).
CREATE OR REPLACE FUNCTION public.staff_confirm_avos_order_payment(
  p_id uuid,
  p_payment_method text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.jwt_user_is_staff_like() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
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

REVOKE ALL ON FUNCTION public.staff_confirm_avos_order_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_confirm_avos_order_payment(uuid, text) TO authenticated;

COMMENT ON COLUMN public.avos_orders.payment_method IS
  'How the customer will pay (intent) or how staff received payment after confirm.';
COMMENT ON COLUMN public.avos_orders.paid_at IS
  'Set only when staff confirms payment in staff/ordenes.';
