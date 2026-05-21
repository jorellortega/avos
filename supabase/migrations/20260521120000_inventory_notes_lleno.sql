-- Spanish preset for on-hand quantity (was English "Full").
UPDATE public.inventory_items
SET notes = 'Lleno'
WHERE list_kind = 'stock'
  AND lower(trim(notes)) = 'full';
