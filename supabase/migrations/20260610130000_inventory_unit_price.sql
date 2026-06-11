-- Optional unit price or price range (MXN) for supplies that fluctuate.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS price_min numeric
    CHECK (price_min IS NULL OR price_min >= 0);

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS price_max numeric
    CHECK (price_max IS NULL OR price_max >= 0);

ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_price_range_check;

ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_price_range_check
    CHECK (
      price_min IS NULL
      OR price_max IS NULL
      OR price_max >= price_min
    );

COMMENT ON COLUMN public.inventory_items.price_min IS
  'Typical low unit price in MXN (per kg, bag, etc.).';
COMMENT ON COLUMN public.inventory_items.price_max IS
  'Typical high unit price in MXN; equals min for fixed price.';
