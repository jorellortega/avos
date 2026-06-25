-- Ready-to-serve prep items as their own list_kind (separate tab on /inventario-edit).

ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_list_kind_check;

ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_list_kind_check
  CHECK (list_kind IN ('stock', 'shopping', 'ready'));

COMMENT ON COLUMN public.inventory_items.list_kind IS
  'stock = on hand; shopping = need to buy; ready = prepared items (pico, guacamole, arroz…).';

-- Move any rows seeded under stock category into the ready tab.
UPDATE public.inventory_items
SET list_kind = 'ready', category = ''
WHERE list_kind = 'stock'
  AND lower(trim(category)) = lower('Preparados listos');

UPDATE public.inventory_items
SET list_kind = 'ready', category = ''
WHERE list_kind = 'stock'
  AND lower(trim(name)) IN (
    lower('Pico de gallo'),
    lower('Guacamole'),
    lower('Salsa roja'),
    lower('Salsa verde'),
    lower('Lechuga (cortada)'),
    lower('Arroz (listo)'),
    lower('Frijoles (listos)'),
    lower('Otras salsas')
  );

INSERT INTO public.inventory_items (
  name, category, list_kind, sort_order, unit, quantity, par_unit
)
SELECT v.name, '', 'ready', v.sort_order, 'pza', 0, 'pza'
FROM (
  VALUES
    ('Pico de gallo', 0),
    ('Guacamole', 1),
    ('Salsa roja', 2),
    ('Salsa verde', 3),
    ('Lechuga (cortada)', 4),
    ('Arroz (listo)', 5),
    ('Frijoles (listos)', 6),
    ('Otras salsas', 7)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_items i
  WHERE i.list_kind = 'ready'
    AND lower(trim(i.name)) = lower(v.name)
);

DELETE FROM public.inventory_stock_categories
WHERE lower(trim(name)) = lower('Preparados listos')
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_items i
    WHERE i.list_kind = 'stock'
      AND lower(trim(i.category)) = lower('Preparados listos')
  );
