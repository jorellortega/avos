-- Daily staff plan checklist — /el-plan

CREATE TABLE IF NOT EXISTS public.el_plan_days (
  plan_date date PRIMARY KEY,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.el_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_date date NOT NULL,
  title text NOT NULL,
  item_notes text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS el_plan_items_date_sort_idx
  ON public.el_plan_items (plan_date, sort_order, title);

DROP TRIGGER IF EXISTS set_el_plan_days_updated_at ON public.el_plan_days;
CREATE TRIGGER set_el_plan_days_updated_at
  BEFORE UPDATE ON public.el_plan_days
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS set_el_plan_items_updated_at ON public.el_plan_items;
CREATE TRIGGER set_el_plan_items_updated_at
  BEFORE UPDATE ON public.el_plan_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.el_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.el_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff like all el_plan_days" ON public.el_plan_days;
CREATE POLICY "Staff like all el_plan_days"
  ON public.el_plan_days FOR ALL
  TO authenticated
  USING (public.jwt_user_is_staff_like())
  WITH CHECK (public.jwt_user_is_staff_like());

DROP POLICY IF EXISTS "Staff like all el_plan_items" ON public.el_plan_items;
CREATE POLICY "Staff like all el_plan_items"
  ON public.el_plan_items FOR ALL
  TO authenticated
  USING (public.jwt_user_is_staff_like())
  WITH CHECK (public.jwt_user_is_staff_like());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.el_plan_days TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.el_plan_items TO authenticated;

COMMENT ON TABLE public.el_plan_days IS 'Notas generales del plan del día; /el-plan.';
COMMENT ON TABLE public.el_plan_items IS 'Tareas del plan del día con checkbox; /el-plan.';
