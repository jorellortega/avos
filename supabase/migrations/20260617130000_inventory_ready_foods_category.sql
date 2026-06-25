-- Ready-to-serve prep items on /inventario-edit (separate tab; see 20260617140000).

ALTER TABLE public.inventory_stock_categories
  ADD COLUMN IF NOT EXISTS show_quantity_kg boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.inventory_stock_categories.show_quantity_kg IS
  'When false, hide kilos column for items in this category (count-only sections).';
