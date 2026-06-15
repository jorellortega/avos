-- Fix: cantidad_num and bolsas are numeric on inventory_items, not integer.

DROP FUNCTION IF EXISTS public._shopping_runner_buy_label(numeric, text, integer, integer);

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

REVOKE ALL ON FUNCTION public._shopping_runner_buy_label(numeric, text, numeric, numeric) FROM PUBLIC;
