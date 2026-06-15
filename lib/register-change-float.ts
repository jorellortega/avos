import { createBrowserSupabase } from "@/lib/supabase/client"

export type CajaRevenueBucket = {
  efectivo: number
  tarjeta: number
  total: number
}

export type RegisterFloatAdjustment = {
  id: string
  amount: number
  note: string
  balanceAfter: number
  createdAt: string
  createdByName: string | null
}

export type CajaSummary = {
  registerChangeFloat: number
  shiftStartedAt: string
  today: CajaRevenueBucket
  shift: CajaRevenueBucket
  recentAdjustments: RegisterFloatAdjustment[]
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

function parseAdjustments(raw: unknown): RegisterFloatAdjustment[] {
  if (!Array.isArray(raw)) return []
  const out: RegisterFloatAdjustment[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const id = typeof o.id === "string" ? o.id : ""
    const amount = Number(o.amount)
    const note = typeof o.note === "string" ? o.note : ""
    const balanceAfter = Number(o.balance_after)
    const createdAt =
      typeof o.created_at === "string" ? o.created_at : new Date().toISOString()
    if (!id || !Number.isFinite(amount) || !note.trim()) continue
    out.push({
      id,
      amount,
      note: note.trim(),
      balanceAfter: Number.isFinite(balanceAfter) ? balanceAfter : 0,
      createdAt,
      createdByName:
        typeof o.created_by_name === "string" && o.created_by_name.trim()
          ? o.created_by_name.trim()
          : null,
    })
  }
  return out
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
    recentAdjustments: parseAdjustments(o.recent_adjustments),
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

export async function staffApplyRegisterFloatAdjustment(
  amount: number,
  note: string,
): Promise<{ ok: boolean; registerChangeFloat?: number; error?: string }> {
  try {
    const supabase = createBrowserSupabase()
    const { data, error } = await supabase.rpc(
      "staff_apply_register_float_adjustment",
      { p_amount: amount, p_note: note },
    )
    if (error) {
      const msg = error.message
      if (msg.includes("insufficient float")) {
        return { ok: false, error: "No hay suficiente fondo para ese retiro." }
      }
      if (msg.includes("note required")) {
        return { ok: false, error: "Escribe un motivo (mínimo 2 caracteres)." }
      }
      return { ok: false, error: msg }
    }
    const o = data as Record<string, unknown> | null
    const v = Number(o?.register_change_float)
    return {
      ok: true,
      registerChangeFloat: Number.isFinite(v) ? v : undefined,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo registrar el ajuste.",
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
