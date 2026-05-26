export type ElevenLabsSttErrorCode =
  | "missing_stt_permission"
  | "unknown"

export class ElevenLabsSttError extends Error {
  code: ElevenLabsSttErrorCode

  constructor(message: string, code: ElevenLabsSttErrorCode) {
    super(message)
    this.name = "ElevenLabsSttError"
    this.code = code
  }
}

export function classifyElevenLabsErrorMessage(message: string): ElevenLabsSttError {
  const lower = message.toLowerCase()
  if (
    lower.includes("speech_to_text") &&
    (lower.includes("permission") || lower.includes("missing"))
  ) {
    return new ElevenLabsSttError(
      "Tu clave de ElevenLabs no tiene permiso speech_to_text. En elevenlabs.io → Profile → API keys, crea o edita una clave y activa «Speech to Text» (o usa una clave con todos los permisos).",
      "missing_stt_permission",
    )
  }
  return new ElevenLabsSttError(message, "unknown")
}

export type ElevenLabsSttResponse = {
  language_code?: string
  language_probability?: number
  text?: string
  words?: unknown[]
  transcripts?: { text?: string }[]
}

export function extractElevenLabsTranscript(
  payload: ElevenLabsSttResponse,
): string {
  if (payload.text?.trim()) return payload.text.trim()
  if (payload.transcripts?.length) {
    return payload.transcripts
      .map((t) => t.text?.trim())
      .filter(Boolean)
      .join(" ")
  }
  return ""
}

export async function transcribeAudioWithElevenLabs(
  apiKey: string,
  audio: Blob,
  options?: {
    modelId?: string
    languageCode?: string
    fileName?: string
  },
): Promise<{ text: string; languageCode?: string }> {
  const form = new FormData()
  const fileName = options?.fileName ?? "recording.webm"
  form.append("file", audio, fileName)
  form.append("model_id", options?.modelId?.trim() || "scribe_v2")
  if (options?.languageCode) {
    form.append("language_code", options.languageCode)
  }
  form.append("tag_audio_events", "false")
  form.append("diarize", "false")

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: form,
  })

  const raw = await res.text()
  let data: ElevenLabsSttResponse & { detail?: { message?: string } | string }
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
        : data.detail?.message
    throw classifyElevenLabsErrorMessage(
      detail ?? `ElevenLabs error ${res.status}`,
    )
  }

  const text = extractElevenLabsTranscript(data)
  if (!text) {
    throw new Error("No se detectó texto en el audio.")
  }

  return { text, languageCode: data.language_code }
}
