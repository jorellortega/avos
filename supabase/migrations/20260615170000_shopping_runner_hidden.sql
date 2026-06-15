-- CEO/manager can hide shopping rows from the runner link; only they still see them.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS runner_hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.inventory_items.runner_hidden IS
  'When true, row is omitted from /lista-compras for runner and staff; CEO/manager still see it.';

CREATE OR REPLACE FUNCTION public.get_shopping_runner_public(
  p_token text,
  p_include_hidden boolean DEFAULT false
)
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
  v_show_hidden boolean;
BEGIN
  IF NOT public._shopping_runner_token_ok(p_token) THEN
    RAISE EXCEPTION 'invalid token';
  END IF;

  v_show_hidden := coalesce(p_include_hidden, false)
    AND public.jwt_user_is_manager_or_ceo();

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
        'sort_order', sub.sort_order,
        'runner_hidden', sub.runner_hidden
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
      i.sort_order,
      coalesce(i.runner_hidden, false) AS runner_hidden
    FROM public.inventory_items i
    LEFT JOIN public.inventory_items st
      ON st.list_kind = 'stock'
      AND lower(trim(st.name)) = lower(trim(i.name))
    LEFT JOIN public.shopping_runner_progress p
      ON p.inventory_item_id = i.id
    WHERE i.list_kind = 'shopping'
      AND i.purchased = false
      AND (
        NOT coalesce(i.runner_hidden, false)
        OR v_show_hidden
      )
  ) sub;

  SELECT coalesce(sum(p.paid_amount), 0)
  INTO v_spent
  FROM public.shopping_runner_progress p
  JOIN public.inventory_items i ON i.id = p.inventory_item_id
  WHERE i.list_kind = 'shopping'
    AND i.purchased = false
    AND NOT coalesce(i.runner_hidden, false)
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

CREATE OR REPLACE FUNCTION public.manager_set_shopping_runner_hidden(
  p_item_id uuid,
  p_hidden boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hidden boolean;
BEGIN
  IF NOT public.jwt_user_is_manager_or_ceo() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'item required';
  END IF;

  v_hidden := coalesce(p_hidden, false);

  UPDATE public.inventory_items
  SET
    runner_hidden = v_hidden,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_item_id
    AND list_kind = 'shopping'
    AND purchased = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not on list';
  END IF;

  RETURN jsonb_build_object(
    'id', p_item_id,
    'runner_hidden', v_hidden
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shopping_runner_public(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shopping_runner_public(text, boolean) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_shopping_runner_public(text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.manager_set_shopping_runner_hidden(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_set_shopping_runner_hidden(uuid, boolean) TO authenticated;
