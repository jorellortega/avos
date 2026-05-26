import { createServiceRoleClient } from "@/lib/supabase-server"

const ELEVENLABS_KEYS = [
  "elevenlabs_api_key",
  "elevenlabs_voice_id",
  "elevenlabs_model",
  "elevenlabs_stt_model",
] as const

export type PortalElevenLabsDiagnostics = {
  serviceRoleConfigured: boolean
  loadPath: "direct_query" | "rpc" | "none"
  queryError: string | null
  rpcError: string | null
  rowsInDb: { key: string; valueLength: number; hasValue: boolean }[]
  elevenlabs_api_key: { configured: boolean; length: number }
  elevenlabs_voice_id: {
    configured: boolean
    length: number
    preview: string | null
  }
  elevenlabs_model: string | null
  readyForTts: boolean
  blockReason: "missing_service_role" | "missing_api_key" | "missing_voice_id" | null
  hints: string[]
}

export function isPortalTtsDebugEnabled(): boolean {
  return process.env.NODE_ENV === "development"
}

export async function diagnosePortalElevenLabsSettings(): Promise<PortalElevenLabsDiagnostics> {
  const hints: string[] = []
  const emptyRows: PortalElevenLabsDiagnostics["rowsInDb"] = []

  const serviceRoleConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )

  if (!serviceRoleConfigured) {
    return {
      serviceRoleConfigured: false,
      loadPath: "none",
      queryError: null,
      rpcError: null,
      rowsInDb: emptyRows,
      elevenlabs_api_key: { configured: false, length: 0 },
      elevenlabs_voice_id: { configured: false, length: 0, preview: null },
      elevenlabs_model: null,
      readyForTts: false,
      blockReason: "missing_service_role",
      hints: [
        "Añade SUPABASE_SERVICE_ROLE_KEY a .env.local y reinicia npm run dev.",
        "Sin service role, /api/portal/text-to-speech no puede leer ai_settings (solo el CEO las guarda en el navegador).",
      ],
    }
  }

  let loadPath: PortalElevenLabsDiagnostics["loadPath"] = "none"
  let queryError: string | null = null
  let rpcError: string | null = null
  const settings: Record<string, string> = {}

  try {
    const service = createServiceRoleClient()
    const { data, error } = await service
      .from("ai_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [...ELEVENLABS_KEYS])

    if (error) {
      queryError = error.message
      hints.push(`Error al leer ai_settings: ${error.message}`)
    } else if (Array.isArray(data)) {
      loadPath = "direct_query"
      for (const row of data) {
        if (row?.setting_key) settings[row.setting_key] = row.setting_value ?? ""
      }
      if (data.length === 0) {
        hints.push(
          "No hay filas elevenlabs_* en ai_settings. Ejecuta la migración 20260526120000_elevenlabs_ai_settings en Supabase.",
        )
      }
    }

    if (loadPath === "none" || queryError) {
      const { data: rpcData, error: rpcErr } = await service.rpc("get_ai_settings")
      if (rpcErr) {
        rpcError = rpcErr.message
        hints.push(`RPC get_ai_settings falló: ${rpcErr.message}`)
      } else if (Array.isArray(rpcData)) {
        loadPath = "rpc"
        for (const row of rpcData as { setting_key: string; setting_value: string }[]) {
          if (
            row?.setting_key &&
            (ELEVENLABS_KEYS as readonly string[]).includes(row.setting_key)
          ) {
            settings[row.setting_key] = row.setting_value ?? ""
          }
        }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    queryError = queryError ?? msg
    hints.push(`Excepción al cargar ajustes: ${msg}`)
  }

  const rowsInDb = ELEVENLABS_KEYS.map((key) => {
    const v = settings[key] ?? ""
    return { key, valueLength: v.length, hasValue: v.trim().length > 0 }
  })

  for (const key of ELEVENLABS_KEYS) {
    if (!rowsInDb.find((r) => r.key === key)?.hasValue) {
      if (key === "elevenlabs_voice_id") {
        hints.push(
          "elevenlabs_voice_id vacío en la BD. En /ai-settings elige Adam/Rachel y espera «Voz guardada».",
        )
      } else if (key === "elevenlabs_api_key") {
        hints.push("elevenlabs_api_key vacío en la BD. Guarda la clave en /ai-settings.")
      }
    }
  }

  const apiKey = settings.elevenlabs_api_key?.trim() ?? ""
  const voiceId = settings.elevenlabs_voice_id?.trim() ?? ""
  const model = settings.elevenlabs_model?.trim() || null

  let blockReason: PortalElevenLabsDiagnostics["blockReason"] = null
  if (!apiKey) blockReason = "missing_api_key"
  else if (!voiceId) blockReason = "missing_voice_id"

  return {
    serviceRoleConfigured: true,
    loadPath,
    queryError,
    rpcError,
    rowsInDb,
    elevenlabs_api_key: { configured: apiKey.length > 0, length: apiKey.length },
    elevenlabs_voice_id: {
      configured: voiceId.length > 0,
      length: voiceId.length,
      preview: voiceId ? `${voiceId.slice(0, 6)}…` : null,
    },
    elevenlabs_model: model,
    readyForTts: Boolean(apiKey && voiceId),
    blockReason,
    hints,
  }
}

export function logPortalElevenLabsDiagnostics(
  context: string,
  diag: PortalElevenLabsDiagnostics,
): void {
  console.error(`[portal TTS debug] ${context}`, JSON.stringify(diag, null, 2))
}
