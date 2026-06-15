-- Public runner shopping list at /lista-compras?t=TOKEN (no account).

CREATE TABLE IF NOT EXISTS public.shopping_runner_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  share_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  cash_budget numeric(10, 2) NOT NULL DEFAULT 0 CHECK (cash_budget >= 0),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.shopping_runner_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.shopping_runner_progress (
  inventory_item_id uuid PRIMARY KEY REFERENCES public.inventory_items (id) ON DELETE CASCADE,
  checked boolean NOT NULL DEFAULT false,
  paid_amount numeric(10, 2) CHECK (paid_amount IS NULL OR paid_amount >= 0),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS shopping_runner_progress_checked_idx
  ON public.shopping_runner_progress (checked);

COMMENT ON TABLE public.shopping_runner_settings IS
  'Singleton: share token + cash given to runner for /lista-compras.';
COMMENT ON TABLE public.shopping_runner_progress IS
  'Runner checkoffs and paid amounts keyed by shopping-list inventory row.';

ALTER TABLE public.shopping_runner_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_runner_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read shopping_runner_settings" ON public.shopping_runner_settings;
CREATE POLICY "Staff read shopping_runner_settings"
  ON public.shopping_runner_settings FOR SELECT
  TO authenticated
  USING (public.jwt_user_is_staff_like());

DROP POLICY IF EXISTS "Staff read shopping_runner_progress" ON public.shopping_runner_progress;
CREATE POLICY "Staff read shopping_runner_progress"
  ON public.shopping_runner_progress FOR SELECT
  TO authenticated
  USING (public.jwt_user_is_staff_like());

CREATE OR REPLACE FUNCTION public._shopping_runner_token_ok(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shopping_runner_settings s
    WHERE s.id = 1
      AND trim(coalesce(p_token, '')) <> ''
      AND s.share_token = trim(p_token)
  );
$$;

CREATE OR REPLACE FUNCTION public._shopping_runner_item_detail(
  p_notes text,
  p_buy_note text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(
    trim(
      coalesce(
        nullif(trim(coalesce(p_buy_note, '')), ''),
        nullif(trim(coalesce(p_notes, '')), '')
      )
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public._shopping_runner_buy_label(
  p_quantity numeric,
  p_unit text,
  p_cantidad_num numeric,
  p_bolsas numeric
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts text[] := ARRAY[]::text[];
  kg numeric;
  cantidad numeric;
  bolsas numeric;
BEGIN
  kg := coalesce(p_quantity, 0);
  IF kg > 0 AND lower(coalesce(p_unit, 'kg')) = 'kg' THEN
    parts := array_append(parts, trim(to_char(kg, 'FM999990.##')) || ' kg');
  END IF;
  cantidad := coalesce(p_cantidad_num, 0);
  IF cantidad > 0 THEN
    parts := array_append(parts, trim(to_char(cantidad, 'FM999990.##')) || ' pza');
  END IF;
  bolsas := coalesce(p_bolsas, 0);
  IF bolsas > 0 THEN
    parts := array_append(
      parts,
      trim(to_char(bolsas, 'FM999990')) || CASE WHEN bolsas = 1 THEN ' bolsa' ELSE ' bolsas' END
    );
  END IF;
  IF array_length(parts, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN array_to_string(parts, ' · ');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shopping_runner_public(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget numeric;
  v_spent numeric;
  v_items jsonb;
BEGIN
  IF NOT public._shopping_runner_token_ok(p_token) THEN
    RAISE EXCEPTION 'invalid token';
  END IF;

  SELECT s.cash_budget
  INTO v_budget
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
    'items', coalesce(v_items, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.runner_patch_shopping_item(
  p_token text,
  p_item_id uuid,
  p_checked boolean,
  p_paid_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid numeric;
BEGIN
  IF NOT public._shopping_runner_token_ok(p_token) THEN
    RAISE EXCEPTION 'invalid token';
  END IF;

  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'item required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.inventory_items i
    WHERE i.id = p_item_id
      AND i.list_kind = 'shopping'
      AND i.purchased = false
  ) THEN
    RAISE EXCEPTION 'item not on list';
  END IF;

  v_paid := p_paid_amount;
  IF v_paid IS NOT NULL AND v_paid < 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  INSERT INTO public.shopping_runner_progress (
    inventory_item_id,
    checked,
    paid_amount,
    updated_at
  )
  VALUES (
    p_item_id,
    coalesce(p_checked, false),
    v_paid,
    timezone('utc'::text, now())
  )
  ON CONFLICT (inventory_item_id) DO UPDATE
  SET
    checked = coalesce(p_checked, false),
    paid_amount = v_paid,
    updated_at = timezone('utc'::text, now());

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
    updated_at = timezone('utc'::text, now())
  WHERE id = 1;

  RETURN jsonb_build_object(
    'cash_budget', v_amount,
    'share_token', (SELECT share_token FROM public.shopping_runner_settings WHERE id = 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_get_shopping_runner_share()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.jwt_user_is_staff_like() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN jsonb_build_object(
    'share_token', s.share_token,
    'cash_budget', s.cash_budget
  )
  FROM public.shopping_runner_settings s
  WHERE s.id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_regenerate_shopping_runner_token()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT public.jwt_user_is_staff_like() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_token := encode(gen_random_bytes(16), 'hex');

  UPDATE public.shopping_runner_settings
  SET
    share_token = v_token,
    updated_at = timezone('utc'::text, now())
  WHERE id = 1;

  RETURN jsonb_build_object(
    'share_token', v_token,
    'cash_budget', (SELECT cash_budget FROM public.shopping_runner_settings WHERE id = 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shopping_runner_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shopping_runner_public(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.runner_patch_shopping_item(text, uuid, boolean, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.runner_patch_shopping_item(text, uuid, boolean, numeric) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.staff_set_shopping_runner_budget(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_set_shopping_runner_budget(numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.staff_get_shopping_runner_share() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_get_shopping_runner_share() TO authenticated;

REVOKE ALL ON FUNCTION public.staff_regenerate_shopping_runner_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_regenerate_shopping_runner_token() TO authenticated;

REVOKE ALL ON FUNCTION public._shopping_runner_token_ok(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._shopping_runner_item_detail(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._shopping_runner_buy_label(numeric, text, numeric, numeric) FROM PUBLIC;
