/** App roles in `public.users` (DB type `public.app_user_role` ENUM). */
export type AppRole = "user" | "staff" | "manager" | "ceo"

/** Row shape for `public.users` (app user; not `auth.users`). */
export interface StaffProfile {
  id: string
  email: string | null
  full_name: string
  role: AppRole
  created_at?: string
  updated_at?: string
}
