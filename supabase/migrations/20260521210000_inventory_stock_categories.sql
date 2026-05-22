-- Editable stock category names for /inventario-edit.

CREATE TABLE IF NOT EXISTS public.inventory_stock_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  show_marinated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_stock_categories_name_unique_idx
  ON public.inventory_stock_categories (lower(trim(name)));

CREATE INDEX IF NOT EXISTS inventory_stock_categories_sort_idx
  ON public.inventory_stock_categories (sort_order, name);

DROP TRIGGER IF EXISTS set_inventory_stock_categories_updated_at ON public.inventory_stock_categories;
CREATE TRIGGER set_inventory_stock_categories_updated_at
  BEFORE UPDATE ON public.inventory_stock_categories
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.inventory_stock_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manager CEO all inventory_stock_categories" ON public.inventory_stock_categories;
CREATE POLICY "Manager CEO all inventory_stock_categories"
  ON public.inventory_stock_categories FOR ALL
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo())
  WITH CHECK (public.jwt_user_is_manager_or_ceo());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_stock_categories TO authenticated;

COMMENT ON TABLE public.inventory_stock_categories IS 'Stock section names on /inventario-edit.';
COMMENT ON COLUMN public.inventory_stock_categories.show_marinated IS 'Show Marinado column for items in this category.';

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.inventory_stock_categories) > 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.inventory_stock_categories (name, sort_order, show_marinated) VALUES
    ('Tomates y vegetales', 0, false),
    ('Especias', 10, false),
    ('Proteínas', 20, true),
    ('Lácteos', 30, false),
    ('Salsas', 40, false),
    ('Bebidas', 50, false),
    ('Despensa', 60, false),
    ('Limpieza y suministros', 70, false),
    ('Otros', 80, false);
END $$;
