-- Free-text purchase note on stock rows; copied to lista de compras on sync.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS buy_note text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.inventory_items.buy_note IS
  'Stock-only note for shopping (marca, proveedor, etc.); shown on linked lista de compras row.';
