import { createBrowserSupabase } from "@/lib/supabase/client"

export type CajaRevenueBucket = {
  efectivo: number
  tarjeta: number
  total: number
}

export type CajaSummary = {
  registerChangeFloat: number
  shiftStartedAt: string
  today: CajaRevenueBucket
  shift: CajaRevenueBucket
}

function parseBucket(raw: unknown): CajaRevenueBucket {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const efectivo = Number(o.efectivo)
  const tarjeta = Number(o.tarjeta)
  const total = Number(o.total)
  return {
    efectivo: Number.isFinite(efectivo) ? efectivo : 0,
    tarjeta: Number.isFinite(tarjeta) ? tarjeta : 0,
    total: Number.isFinite(total) ? total : 0,
  }
}

export function parseCajaSummary(raw: unknown): CajaSummary | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const f = Number(o.register_change_float)
  const shift =
    typeof o.shift_started_at === "string" ? o.shift_started_at : new Date().toISOString()
  return {
    registerChangeFloat: Number.isFinite(f) ? Math.max(0, f) : 0,
    shiftStartedAt: shift,
    today: parseBucket(o.today),
    shift: parseBucket(o.shift),
  }
}

export async function fetchCajaSummaryClient(): Promise<{
  summary: CajaSummary | null
  error?: string
}> {
  try {
    const supabase = createBrowserSupabase()
    const { data, error } = await supabase.rpc("staff_get_caja_summary")
    if (error) return { summary: null, error: error.message }
    return { summary: parseCajaSummary(data) }
  } catch (e) {
    return {
      summary: null,
      error: e instanceof Error ? e.message : "No se pudo cargar resumen de caja.",
    }
  }
}

export async function ceoSetRegisterChangeFloat(
  amount: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createBrowserSupabase()
    const { error } = await supabase.rpc("ceo_set_register_change_float", {
      p_amount: amount,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar.",
    }
  }
}

export async function ceoStartCajaShift(): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createBrowserSupabase()
    const { error } = await supabase.rpc("ceo_start_caja_shift")
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo iniciar turno.",
    }
  }
}

export function formatCajaMoney(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n)
}
