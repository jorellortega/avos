-- Proveedores (suppliers) for /proveedores — manager/CEO only.

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  supplier_type text NOT NULL DEFAULT '',
  price_notes text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS suppliers_active_sort_idx
  ON public.suppliers (is_active, sort_order, name);

DROP TRIGGER IF EXISTS set_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manager CEO all suppliers" ON public.suppliers;
CREATE POLICY "Manager CEO all suppliers"
  ON public.suppliers FOR ALL
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo())
  WITH CHECK (public.jwt_user_is_manager_or_ceo());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;

COMMENT ON TABLE public.suppliers IS 'Proveedores; gestión en /proveedores.';
COMMENT ON COLUMN public.suppliers.supplier_type IS 'Tipo: carnes, verduras, bebidas, etc.';
COMMENT ON COLUMN public.suppliers.price_notes IS 'Precios o referencia (ej. $45/caja, lista mayoreo).';
