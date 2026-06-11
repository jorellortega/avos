-- Optional daily pay (MXN) per employee row for payroll estimates on /horario-edit.

ALTER TABLE public.staff_schedule_employees
  ADD COLUMN IF NOT EXISTS daily_pay numeric
    CHECK (daily_pay IS NULL OR daily_pay >= 0);

COMMENT ON COLUMN public.staff_schedule_employees.daily_pay IS
  'MXN paid per scheduled work day; manager-only, not shown on public employee links.';
