-- Register change float (fondo en caja) + shift start for revenue summaries.

ALTER TABLE public.ordering_settings
  ADD COLUMN IF NOT EXISTS register_change_float numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shift_started_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());

COMMENT ON COLUMN public.ordering_settings.register_change_float IS
  'Cash left in register for making change; set by CEO, visible to staff.';
COMMENT ON COLUMN public.ordering_settings.shift_started_at IS
  'Start of current caja shift for revenue totals (reset by CEO).';

CREATE OR REPLACE FUNCTION public.ceo_set_register_change_float(p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.jwt_user_is_ceo() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 1000000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  UPDATE public.ordering_settings
  SET
    register_change_float = round(p_amount::numeric, 2),
    updated_at = timezone('utc'::text, now())
  WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ceo_start_caja_shift()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.jwt_user_is_ceo() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.ordering_settings
  SET
    shift_started_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  WHERE id = 1;
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
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ceo_set_register_change_float(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ceo_set_register_change_float(numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.ceo_start_caja_shift() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ceo_start_caja_shift() TO authenticated;

REVOKE ALL ON FUNCTION public.staff_get_caja_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_get_caja_summary() TO authenticated;
