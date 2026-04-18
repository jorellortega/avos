-- Cliente en mesa: solo registra "caja" (un clic); personal elige efectivo/tarjeta al cobrar.

ALTER TABLE public.avos_orders DROP CONSTRAINT IF EXISTS avos_orders_payment_method_check;
ALTER TABLE public.avos_orders ADD CONSTRAINT avos_orders_payment_method_check CHECK (
  payment_method IS NULL OR payment_method IN ('efectivo', 'tarjeta', 'caja')
);

COMMENT ON COLUMN public.avos_orders.payment_method IS
  'Intent: caja (cliente pagará en caja), efectivo/tarjeta (tras confirmar staff o Stripe).';

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
  IF p_payment_method NOT IN ('efectivo', 'tarjeta', 'caja') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  SELECT o.order_type INTO ot FROM public.avos_orders o WHERE o.id = p_id;
  IF ot IS NULL THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  -- En mesa el cliente solo indica que pagará en caja; no elige efectivo/tarjeta.
  IF ot = 'mesa' AND p_payment_method <> 'caja' THEN
    RAISE EXCEPTION 'En mesa solo se registra pago en caja; el personal anota efectivo o tarjeta';
  END IF;

  IF ot = 'pickup' AND p_payment_method = 'efectivo' THEN
    RAISE EXCEPTION 'Para llevar solo se acepta pago con tarjeta';
  END IF;
  IF ot = 'pickup' AND p_payment_method = 'caja' THEN
    RAISE EXCEPTION 'Para llevar usa pago en línea';
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
