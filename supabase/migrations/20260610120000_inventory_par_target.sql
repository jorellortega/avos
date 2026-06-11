-- Target stock level: how much should be on hand per day or per week.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS par_period text
    CHECK (par_period IS NULL OR par_period IN ('day', 'week'));

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS par_unit text
    CHECK (par_unit IS NULL OR par_unit IN ('kg', 'pza', 'bolsas'));

COMMENT ON COLUMN public.inventory_items.par_level IS
  'Target quantity (paired with par_period and par_unit).';
COMMENT ON COLUMN public.inventory_items.par_period IS
  'day = target for one day; week = target for the week.';
COMMENT ON COLUMN public.inventory_items.par_unit IS
  'Unit for par_level: kg, pza (count), or bolsas.';
