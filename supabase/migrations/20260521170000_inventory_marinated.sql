-- Marinado sí/no for stock items (mainly proteínas at /inventario-edit).

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS marinated boolean;

COMMENT ON COLUMN public.inventory_items.marinated IS 'Marinado: true = sí, false = no, null = sin marcar.';
