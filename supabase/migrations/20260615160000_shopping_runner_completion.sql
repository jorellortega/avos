-- Runner reports actual change left + completion notes at end of trip.

ALTER TABLE public.shopping_runner_settings
  ADD COLUMN IF NOT EXISTS change_left numeric(10, 2)
    CHECK (change_left IS NULL OR change_left >= 0),
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS completion_updated_at timestamptz;

COMMENT ON COLUMN public.shopping_runner_settings.change_left IS
  'Cash runner actually brings back; may differ from budget minus list total.';
COMMENT ON COLUMN public.shopping_runner_settings.completion_notes IS
  'Runner notes when finishing the shopping trip.';

CREATE OR REPLACE FUNCTION public.get_shopping_runner_public(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget numeric;
  v_change_left numeric;
  v_completion_notes text;
  v_spent numeric;
  v_items jsonb;
BEGIN
  IF NOT public._shopping_runner_token_ok(p_token) THEN
    RAISE EXCEPTION 'invalid token';
  END IF;

  SELECT s.cash_budget, s.change_left, s.completion_notes
  INTO v_budget, v_change_left, v_completion_notes
  FROM public.shopping_runner_settings s
  WHERE s.id = 1;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sub.id,
        'name', sub.name,
        'detail', sub.detail,
        'buy_label', sub.buy_label,
        'checked', sub.checked,
        'paid_amount', sub.paid_amount,
        'sort_order', sub.sort_order
      )
      ORDER BY sub.sort_order, sub.name
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM (
    SELECT
      i.id,
      i.name,
      public._shopping_runner_item_detail(i.notes, st.buy_note) AS detail,
      public._shopping_runner_buy_label(
        i.quantity,
        i.unit,
        i.cantidad_num,
        i.bolsas
      ) AS buy_label,
      coalesce(p.checked, false) AS checked,
      p.paid_amount,
      i.sort_order
    FROM public.inventory_items i
    LEFT JOIN public.inventory_items st
      ON st.list_kind = 'stock'
      AND lower(trim(st.name)) = lower(trim(i.name))
    LEFT JOIN public.shopping_runner_progress p
      ON p.inventory_item_id = i.id
    WHERE i.list_kind = 'shopping'
      AND i.purchased = false
  ) sub;

  SELECT coalesce(sum(p.paid_amount), 0)
  INTO v_spent
  FROM public.shopping_runner_progress p
  JOIN public.inventory_items i ON i.id = p.inventory_item_id
  WHERE i.list_kind = 'shopping'
    AND i.purchased = false
    AND p.checked = true
    AND p.paid_amount IS NOT NULL;

  RETURN jsonb_build_object(
    'cash_budget', coalesce(v_budget, 0),
    'spent_total', coalesce(v_spent, 0),
    'change_left', v_change_left,
    'completion_notes', v_completion_notes,
    'items', coalesce(v_items, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.runner_patch_shopping_completion(
  p_token text,
  p_change_left numeric,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_change numeric;
  v_notes text;
BEGIN
  IF NOT public._shopping_runner_token_ok(p_token) THEN
    RAISE EXCEPTION 'invalid token';
  END IF;

  v_change := p_change_left;
  IF v_change IS NOT NULL AND v_change < 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF v_change IS NOT NULL THEN
    v_change := round(v_change, 2);
  END IF;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');

  UPDATE public.shopping_runner_settings
  SET
    change_left = v_change,
    completion_notes = v_notes,
    completion_updated_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  WHERE id = 1;

  RETURN public.get_shopping_runner_public(p_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_set_shopping_runner_budget(p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric;
BEGIN
  IF NOT public.jwt_user_is_staff_like() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_amount := round(coalesce(p_amount, 0)::numeric, 2);
  IF v_amount < 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  UPDATE public.shopping_runner_settings
  SET
    cash_budget = v_amount,
    change_left = NULL,
    completion_notes = NULL,
    completion_updated_at = NULL,
    updated_at = timezone('utc'::text, now())
  WHERE id = 1;

  RETURN jsonb_build_object(
    'cash_budget', v_amount,
    'share_token', (SELECT share_token FROM public.shopping_runner_settings WHERE id = 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.runner_patch_shopping_completion(text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.runner_patch_shopping_completion(text, numeric, text) TO anon, authenticated;
