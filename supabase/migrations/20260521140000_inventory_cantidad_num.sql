-- Plain count 1–50 (separate from kilos and bolsas).

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS cantidad_num numeric
    CHECK (cantidad_num IS NULL OR (cantidad_num >= 1 AND cantidad_num <= 50));

COMMENT ON COLUMN public.inventory_items.cantidad_num IS 'Simple quantity 1–50; stock at /inventario-edit.';
