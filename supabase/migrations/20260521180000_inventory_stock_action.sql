-- Procurement / reorder action for stock items (buy now, reserves, etc.).

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS stock_action text;

COMMENT ON COLUMN public.inventory_items.stock_action IS 'Acción de compra/reabasto: Comprar ahora, Tener reservas, etc.';
