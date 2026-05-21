-- Bottles/bags count (1–10), separate from quantity in kilos.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS bolsas numeric
    CHECK (bolsas IS NULL OR (bolsas >= 0 AND bolsas <= 10));

COMMENT ON COLUMN public.inventory_items.bolsas IS 'Bottle/bag count (1–10); stock items at /inventario-edit.';
