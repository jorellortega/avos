-- Kitchen status for /preparados: listo, se acabó, hacer más, etc.

ALTER TABLE public.prep_ready_items
  ADD COLUMN IF NOT EXISTS prep_status text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.prep_ready_items.prep_status IS
  'Kitchen status slug: ready | out | need_more | in_prep | low | (empty = unset).';
