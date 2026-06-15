-- Log +/- adjustments to register change float (fondo caja) from portal.

CREATE TABLE IF NOT EXISTS public.register_float_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric(10, 2) NOT NULL CHECK (amount <> 0),
  note text NOT NULL CHECK (char_length(trim(note)) >= 2),
  balance_after numeric(10, 2) NOT NULL CHECK (balance_after >= 0),
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS register_float_adjustments_created_at_idx
  ON public.register_float_adjustments (created_at DESC);

COMMENT ON TABLE public.register_float_adjustments IS
  'Portal fondo caja entries: supplier payout, payroll deduction, top-up, etc.';

ALTER TABLE public.register_float_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read register_float_adjustments" ON public.register_float_adjustments;
CREATE POLICY "Staff read register_float_adjustments"
  ON public.register_float_adjustments FOR SELECT
  TO authenticated
  USING (public.jwt_user_is_staff_like());

CREATE OR REPLACE FUNCTION public.staff_apply_register_float_adjustment(
  p_amount numeric,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current numeric;
  v_new numeric;
  v_id uuid;
  v_note text;
BEGIN
  IF NOT public.jwt_user_is_staff_like() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_amount IS NULL OR p_amount = 0 OR abs(p_amount) > 1000000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  v_note := trim(coalesce(p_note, ''));
  IF char_length(v_note) < 2 THEN
    RAISE EXCEPTION 'note required';
  END IF;

  SELECT os.register_change_float
  INTO v_current
  FROM public.ordering_settings os
  WHERE os.id = 1
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'ordering settings missing';
  END IF;

  v_new := round((v_current + p_amount)::numeric, 2);

  IF v_new < 0 THEN
    RAISE EXCEPTION 'insufficient float';
  END IF;

  UPDATE public.ordering_settings
  SET
    register_change_float = v_new,
    updated_at = timezone('utc'::text, now())
  WHERE id = 1;

  INSERT INTO public.register_float_adjustments (
    amount,
    note,
    balance_after,
    created_by
  )
  VALUES (
    round(p_amount::numeric, 2),
    left(v_note, 500),
    v_new,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'register_change_float', v_new,
    'adjustment_id', v_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_get_caja_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_float numeric;
  v_shift timestamptz;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_today_efectivo numeric := 0;
  v_today_tarjeta numeric := 0;
  v_shift_efectivo numeric := 0;
  v_shift_tarjeta numeric := 0;
  v_recent jsonb;
BEGIN
  IF NOT public.jwt_user_is_staff_like() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT os.register_change_float, os.shift_started_at
  INTO v_float, v_shift
  FROM public.ordering_settings os
  WHERE os.id = 1;

  v_day_start :=
    (date_trunc('day', now() AT TIME ZONE 'America/Mexico_City')
      AT TIME ZONE 'America/Mexico_City');
  v_day_end := v_day_start + interval '1 day';

  SELECT
    COALESCE(sum(o.total) FILTER (WHERE o.payment_method = 'efectivo'), 0),
    COALESCE(sum(o.total) FILTER (WHERE o.payment_method = 'tarjeta'), 0)
  INTO v_today_efectivo, v_today_tarjeta
  FROM public.avos_orders o
  WHERE o.paid_at IS NOT NULL
    AND o.paid_at >= v_day_start
    AND o.paid_at < v_day_end;

  SELECT
    COALESCE(sum(o.total) FILTER (WHERE o.payment_method = 'efectivo'), 0),
    COALESCE(sum(o.total) FILTER (WHERE o.payment_method = 'tarjeta'), 0)
  INTO v_shift_efectivo, v_shift_tarjeta
  FROM public.avos_orders o
  WHERE o.paid_at IS NOT NULL
    AND o.paid_at >= v_shift;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sub.id,
        'amount', sub.amount,
        'note', sub.note,
        'balance_after', sub.balance_after,
        'created_at', sub.created_at,
        'created_by_name', sub.created_by_name
      )
      ORDER BY sub.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_recent
  FROM (
    SELECT
      a.id,
      a.amount,
      a.note,
      a.balance_after,
      a.created_at,
      u.full_name AS created_by_name
    FROM public.register_float_adjustments a
    LEFT JOIN public.users u ON u.id = a.created_by
    ORDER BY a.created_at DESC
    LIMIT 15
  ) sub;

  RETURN jsonb_build_object(
    'register_change_float', COALESCE(v_float, 0),
    'shift_started_at', v_shift,
    'today', jsonb_build_object(
      'efectivo', v_today_efectivo,
      'tarjeta', v_today_tarjeta,
      'total', v_today_efectivo + v_today_tarjeta
    ),
    'shift', jsonb_build_object(
      'efectivo', v_shift_efectivo,
      'tarjeta', v_shift_tarjeta,
      'total', v_shift_efectivo + v_shift_tarjeta
    ),
    'recent_adjustments', COALESCE(v_recent, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_apply_register_float_adjustment(numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_apply_register_float_adjustment(numeric, text) TO authenticated;
