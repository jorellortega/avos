-- Back-of-house inventory; manager/CEO manage at /inventario-edit.

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'pza',
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  par_level numeric CHECK (par_level IS NULL OR par_level >= 0),
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS inventory_items_active_sort_idx
  ON public.inventory_items (is_active, sort_order, id);

CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items (id) ON DELETE CASCADE,
  delta numeric NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS inventory_adjustments_item_created_idx
  ON public.inventory_adjustments (item_id, created_at DESC);

DROP TRIGGER IF EXISTS set_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER set_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manager CEO all inventory_items" ON public.inventory_items;
CREATE POLICY "Manager CEO all inventory_items"
  ON public.inventory_items FOR ALL
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo())
  WITH CHECK (public.jwt_user_is_manager_or_ceo());

DROP POLICY IF EXISTS "Manager CEO all inventory_adjustments" ON public.inventory_adjustments;
CREATE POLICY "Manager CEO all inventory_adjustments"
  ON public.inventory_adjustments FOR ALL
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo())
  WITH CHECK (public.jwt_user_is_manager_or_ceo());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_adjustments TO authenticated;

COMMENT ON TABLE public.inventory_items IS 'Stock list; managed at /inventario-edit.';
COMMENT ON TABLE public.inventory_adjustments IS 'Quantity change log for inventory items.';
