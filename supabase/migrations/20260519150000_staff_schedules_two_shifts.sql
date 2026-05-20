-- Morning + afternoon shift per day (replaces single field per day).

ALTER TABLE public.staff_schedule_employees
  ADD COLUMN IF NOT EXISTS mon_manana text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mon_tarde text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tue_manana text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tue_tarde text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wed_manana text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wed_tarde text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS thu_manana text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS thu_tarde text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fri_manana text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fri_tarde text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sat_manana text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sat_tarde text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sun_manana text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sun_tarde text NOT NULL DEFAULT '';

-- Copy legacy single-shift columns into mañana if they still exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'staff_schedule_employees'
      AND column_name = 'mon'
  ) THEN
    UPDATE public.staff_schedule_employees SET
      mon_manana = COALESCE(NULLIF(mon_manana, ''), mon, ''),
      tue_manana = COALESCE(NULLIF(tue_manana, ''), tue, ''),
      wed_manana = COALESCE(NULLIF(wed_manana, ''), wed, ''),
      thu_manana = COALESCE(NULLIF(thu_manana, ''), thu, ''),
      fri_manana = COALESCE(NULLIF(fri_manana, ''), fri, ''),
      sat_manana = COALESCE(NULLIF(sat_manana, ''), sat, ''),
      sun_manana = COALESCE(NULLIF(sun_manana, ''), sun, '');

    ALTER TABLE public.staff_schedule_employees
      DROP COLUMN IF EXISTS mon,
      DROP COLUMN IF EXISTS tue,
      DROP COLUMN IF EXISTS wed,
      DROP COLUMN IF EXISTS thu,
      DROP COLUMN IF EXISTS fri,
      DROP COLUMN IF EXISTS sat,
      DROP COLUMN IF EXISTS sun;
  END IF;
END $$;

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
    'days', jsonb_build_object(
      'mon', jsonb_build_object('manana', e.mon_manana, 'tarde', e.mon_tarde),
      'tue', jsonb_build_object('manana', e.tue_manana, 'tarde', e.tue_tarde),
      'wed', jsonb_build_object('manana', e.wed_manana, 'tarde', e.wed_tarde),
      'thu', jsonb_build_object('manana', e.thu_manana, 'tarde', e.thu_tarde),
      'fri', jsonb_build_object('manana', e.fri_manana, 'tarde', e.fri_tarde),
      'sat', jsonb_build_object('manana', e.sat_manana, 'tarde', e.sat_tarde),
      'sun', jsonb_build_object('manana', e.sun_manana, 'tarde', e.sun_tarde)
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
