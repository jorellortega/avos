-- Independent morning / afternoon rosters (separate names per shift).

ALTER TABLE public.staff_schedule_employees
  ADD COLUMN IF NOT EXISTS shift text NOT NULL DEFAULT 'manana'
    CHECK (shift IN ('manana', 'tarde'));

ALTER TABLE public.staff_schedule_employees
  ADD COLUMN IF NOT EXISTS mon text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tue text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wed text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS thu text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fri text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sat text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sun text NOT NULL DEFAULT '';

-- Split legacy combined rows into one row per shift.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'staff_schedule_employees'
      AND column_name = 'mon_manana'
  ) THEN
    -- Afternoon rows (new names; keep tarde hours only)
    INSERT INTO public.staff_schedule_employees (
      schedule_id, name, share_token, shift,
      mon, tue, wed, thu, fri, sat, sun, sort_order
    )
    SELECT
      schedule_id,
      '',
      encode(gen_random_bytes(12), 'hex'),
      'tarde',
      mon_tarde, tue_tarde, wed_tarde, thu_tarde, fri_tarde, sat_tarde, sun_tarde,
      sort_order + 10000
    FROM public.staff_schedule_employees
    WHERE shift = 'manana' OR shift IS NULL;

    -- Morning rows: copy mañana hours into day columns
    UPDATE public.staff_schedule_employees SET
      shift = 'manana',
      mon = mon_manana,
      tue = tue_manana,
      wed = wed_manana,
      thu = thu_manana,
      fri = fri_manana,
      sat = sat_manana,
      sun = sun_manana
    WHERE shift = 'manana'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'staff_schedule_employees'
          AND column_name = 'mon_manana'
      );

    ALTER TABLE public.staff_schedule_employees
      DROP COLUMN IF EXISTS mon_manana,
      DROP COLUMN IF EXISTS mon_tarde,
      DROP COLUMN IF EXISTS tue_manana,
      DROP COLUMN IF EXISTS tue_tarde,
      DROP COLUMN IF EXISTS wed_manana,
      DROP COLUMN IF EXISTS wed_tarde,
      DROP COLUMN IF EXISTS thu_manana,
      DROP COLUMN IF EXISTS thu_tarde,
      DROP COLUMN IF EXISTS fri_manana,
      DROP COLUMN IF EXISTS fri_tarde,
      DROP COLUMN IF EXISTS sat_manana,
      DROP COLUMN IF EXISTS sat_tarde,
      DROP COLUMN IF EXISTS sun_manana,
      DROP COLUMN IF EXISTS sun_tarde;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS staff_schedule_employees_schedule_shift_sort_idx
  ON public.staff_schedule_employees (schedule_id, shift, sort_order, id);

CREATE OR REPLACE FUNCTION public.get_staff_schedule_employee_public(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'name', e.name,
    'shift', e.shift,
    'title', s.title,
    'week_start', s.week_start,
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
