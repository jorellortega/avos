-- Employee weekly schedules: manager/CEO edit; employees view via share token (no login).

CREATE TABLE IF NOT EXISTS public.staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Horario',
  week_start date,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.staff_schedule_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.staff_schedules (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  shift text NOT NULL DEFAULT 'manana'
    CHECK (shift IN ('manana', 'tarde')),
  mon text NOT NULL DEFAULT '',
  tue text NOT NULL DEFAULT '',
  wed text NOT NULL DEFAULT '',
  thu text NOT NULL DEFAULT '',
  fri text NOT NULL DEFAULT '',
  sat text NOT NULL DEFAULT '',
  sun text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS staff_schedule_employees_schedule_shift_sort_idx
  ON public.staff_schedule_employees (schedule_id, shift, sort_order, id);

CREATE UNIQUE INDEX IF NOT EXISTS staff_schedule_employees_share_token_idx
  ON public.staff_schedule_employees (share_token);

DROP TRIGGER IF EXISTS set_staff_schedules_updated_at ON public.staff_schedules;
CREATE TRIGGER set_staff_schedules_updated_at
  BEFORE UPDATE ON public.staff_schedules
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS set_staff_schedule_employees_updated_at ON public.staff_schedule_employees;
CREATE TRIGGER set_staff_schedule_employees_updated_at
  BEFORE UPDATE ON public.staff_schedule_employees
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedule_employees ENABLE ROW LEVEL SECURITY;

-- Manager/CEO full access
DROP POLICY IF EXISTS "Manager CEO all staff_schedules" ON public.staff_schedules;
CREATE POLICY "Manager CEO all staff_schedules"
  ON public.staff_schedules FOR ALL
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo())
  WITH CHECK (public.jwt_user_is_manager_or_ceo());

DROP POLICY IF EXISTS "Manager CEO all staff_schedule_employees" ON public.staff_schedule_employees;
CREATE POLICY "Manager CEO all staff_schedule_employees"
  ON public.staff_schedule_employees FOR ALL
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo())
  WITH CHECK (public.jwt_user_is_manager_or_ceo());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_schedule_employees TO authenticated;

COMMENT ON TABLE public.staff_schedules IS 'Weekly schedule header; manager edits at /horario-edit.';
COMMENT ON TABLE public.staff_schedule_employees IS 'One row per employee; share_token powers /horario/e/[token].';

-- Public employee view: published schedule only, minimal fields.
CREATE OR REPLACE FUNCTION public.get_staff_schedule_employee_public(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'name', e.name,
    'title', s.title,
    'week_start', s.week_start,
    'shift', e.shift,
    'days', jsonb_build_object(
      'mon', e.mon,
      'tue', e.tue,
      'wed', e.wed,
      'thu', e.thu,
      'fri', e.fri,
      'sat', e.sat,
      'sun', e.sun
    )
  )
  FROM public.staff_schedule_employees e
  JOIN public.staff_schedules s ON s.id = e.schedule_id
  WHERE e.share_token = p_token
    AND s.is_published = true
    AND length(trim(coalesce(p_token, ''))) > 0;
$$;

REVOKE ALL ON FUNCTION public.get_staff_schedule_employee_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_schedule_employee_public(text) TO anon, authenticated;
