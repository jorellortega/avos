"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"

const applicationSchema = z.object({
  job_post_id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().max(8000).optional().default(""),
})

export type SubmitJobApplicationState = { ok: true } | { ok: false; error: string }

export async function submitJobApplication(
  _prev: SubmitJobApplicationState | undefined,
  formData: FormData,
): Promise<SubmitJobApplicationState> {
  const parsed = applicationSchema.safeParse({
    job_post_id: formData.get("job_post_id"),
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    message: formData.get("message") ?? "",
  })

  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario." }
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("job_applications").insert({
    job_post_id: parsed.data.job_post_id,
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    message: parsed.data.message,
  })

  if (error) {
    return { ok: false, error: "No se pudo enviar la solicitud. Intenta de nuevo." }
  }

  revalidatePath("/jobs-edit")
  return { ok: true }
}
