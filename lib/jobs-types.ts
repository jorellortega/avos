export type JobApplicationStatus =
  | "pending"
  | "reviewed"
  | "interview"
  | "hired"
  | "rejected"

export interface JobPostRow {
  id: string
  title: string
  description: string
  location: string
  employment_type: string
  /** Shown on listings, e.g. hourly rate or "Según experiencia". */
  pay: string
  /** Shown on listings, e.g. 20-30 hrs/semana. */
  hours: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface JobApplicationRow {
  id: string
  job_post_id: string
  full_name: string
  email: string
  phone: string
  message: string
  status: JobApplicationStatus
  created_at: string
}

export interface JobApplicationWithPost extends JobApplicationRow {
  job_posts: Pick<JobPostRow, "title"> | null
}
