-- Ready prep items (salsas, rice, beans, etc.) with temp: frozen / hot / cold — /preparados

CREATE TABLE IF NOT EXISTS public.prep_ready_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  temp_state text NOT NULL DEFAULT 'cold'
    CHECK (temp_state IN ('frozen', 'hot', 'cold')),
  category text NOT NULL DEFAULT 'Otros',
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS prep_ready_items_active_sort_idx
  ON public.prep_ready_items (is_active, category, sort_order, name);

DROP TRIGGER IF EXISTS set_prep_ready_items_updated_at ON public.prep_ready_items;
CREATE TRIGGER set_prep_ready_items_updated_at
  BEFORE UPDATE ON public.prep_ready_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.prep_ready_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff like all prep_ready_items" ON public.prep_ready_items;
CREATE POLICY "Staff like all prep_ready_items"
  ON public.prep_ready_items FOR ALL
  TO authenticated
  USING (public.jwt_user_is_staff_like())
  WITH CHECK (public.jwt_user_is_staff_like());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prep_ready_items TO authenticated;

COMMENT ON TABLE public.prep_ready_items IS 'Preparados listos (salsas, arroz, frijoles…); /preparados.';
COMMENT ON COLUMN public.prep_ready_items.temp_state IS 'frozen | hot | cold';

-- Seed starter list when table is empty.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.prep_ready_items) > 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.prep_ready_items (name, temp_state, category, sort_order) VALUES
    ('Pico de Gallo', 'cold', 'Salsas', 0),
    ('Red Chili Sauce', 'hot', 'Salsas', 1),
    ('Green Chili Sauce', 'cold', 'Salsas', 2),
    ('Beans', 'hot', 'Frijoles y arroz', 10),
    ('Rice', 'hot', 'Frijoles y arroz', 11),
    ('Shrimp Salad', 'cold', 'Ensaladas', 20),
    ('Agua Fresca', 'cold', 'Bebidas', 30),
    ('Horchata', 'cold', 'Bebidas', 31),
    ('Guacamole', 'cold', 'Salsas', 3);
END $$;
