-- Business hours for /horario-edit; constrains employee entry/exit dropdowns.

ALTER TABLE public.staff_schedules
  ADD COLUMN IF NOT EXISTS hours_open text NOT NULL DEFAULT '8:00 AM';

ALTER TABLE public.staff_schedules
  ADD COLUMN IF NOT EXISTS hours_close text NOT NULL DEFAULT '10:00 PM';

COMMENT ON COLUMN public.staff_schedules.hours_open IS
  'Opening time (AM/PM text); employee entrada dropdown starts here.';
COMMENT ON COLUMN public.staff_schedules.hours_close IS
  'Closing time (AM/PM text); employee salida dropdown ends here.';
