export type ElevenLabsVoiceSummary = {
  voice_id: string
  name: string
  category?: string
  preview_url?: string
}

/** Common voices when API key cannot list voices (missing voices_read). */
export const ELEVENLABS_PRESET_VOICES: ElevenLabsVoiceSummary[] = [
  { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", category: "preset" },
  { voice_id: "JBFqnCBsd6RMkjVDRZzb", name: "George", category: "preset" },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", category: "preset" },
  { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam", category: "preset" },
]

export type ElevenLabsVoicesErrorCode =
  | "missing_voices_read_permission"
  | "unknown"

export class ElevenLabsVoicesError extends Error {
  code: ElevenLabsVoicesErrorCode

  constructor(message: string, code: ElevenLabsVoicesErrorCode) {
    super(message)
    this.name = "ElevenLabsVoicesError"
    this.code = code
  }
}

export function classifyElevenLabsVoicesError(
  message: string,
): ElevenLabsVoicesError {
  const lower = message.toLowerCase()
  if (lower.includes("voices_read")) {
    return new ElevenLabsVoicesError(
      "Tu clave no tiene permiso voices_read. En elevenlabs.io → API keys, edita la clave y activa «Voices» (o usa una clave con todos los permisos). Mientras tanto, elige una voz sugerida o pega el ID manualmente.",
      "missing_voices_read_permission",
    )
  }
  return new ElevenLabsVoicesError(message, "unknown")
}

type ElevenLabsVoicesResponse = {
  voices?: {
    voice_id?: string
    name?: string
    category?: string
    preview_url?: string
  }[]
}

export async function listElevenLabsVoices(
  apiKey: string,
): Promise<ElevenLabsVoiceSummary[]> {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey.trim() },
    cache: "no-store",
  })

  const raw = await res.text()
  let data: ElevenLabsVoicesResponse & { detail?: { message?: string } | string }
  try {
    data = JSON.parse(raw) as typeof data
  } catch {
    throw new Error(
      res.ok ? "Respuesta inválida de ElevenLabs." : `ElevenLabs ${res.status}`,
    )
  }

  if (!res.ok) {
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : data.detail?.message ?? `ElevenLabs error ${res.status}`
    throw classifyElevenLabsVoicesError(detail)
  }

  const voices = (data.voices ?? [])
    .filter((v): v is Required<Pick<typeof v, "voice_id" | "name">> & typeof v =>
      Boolean(v.voice_id?.trim() && v.name?.trim()),
    )
    .map((v) => ({
      voice_id: v.voice_id!.trim(),
      name: v.name!.trim(),
      category: v.category?.trim() || undefined,
      preview_url: v.preview_url?.trim() || undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))

  return voices
}
