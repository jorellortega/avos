export type ElevenLabsTtsErrorCode = "missing_tts_permission" | "unknown"

export class ElevenLabsTtsError extends Error {
  code: ElevenLabsTtsErrorCode

  constructor(message: string, code: ElevenLabsTtsErrorCode) {
    super(message)
    this.name = "ElevenLabsTtsError"
    this.code = code
  }
}

export function classifyElevenLabsTtsErrorMessage(message: string): ElevenLabsTtsError {
  const lower = message.toLowerCase()
  if (
    (lower.includes("text_to_speech") || lower.includes("text-to-speech")) &&
    (lower.includes("permission") || lower.includes("missing"))
  ) {
    return new ElevenLabsTtsError(
      "Tu clave de ElevenLabs no tiene permiso text_to_speech. En elevenlabs.io → Profile → API keys, activa «Text to Speech» (o usa una clave con todos los permisos).",
      "missing_tts_permission",
    )
  }
  return new ElevenLabsTtsError(message, "unknown")
}

export type ElevenLabsTtsOptions = {
  voiceId: string
  modelId?: string
  languageCode?: string
  outputFormat?: string
}

export async function synthesizeSpeechWithElevenLabs(
  apiKey: string,
  text: string,
  options: ElevenLabsTtsOptions,
): Promise<ArrayBuffer> {
  const voiceId = options.voiceId.trim()
  if (!voiceId) {
    throw new ElevenLabsTtsError(
      "Falta el ID de voz de ElevenLabs. Configúralo en Ajustes de IA (/ai-settings).",
      "unknown",
    )
  }

  const modelId = options.modelId?.trim() || "eleven_multilingual_v2"
  const outputFormat = options.outputFormat?.trim() || "mp3_22050_32"
  const params = new URLSearchParams({ output_format: outputFormat })

  const body: Record<string, string> = {
    text: text.trim(),
    model_id: modelId,
  }
  if (options.languageCode?.trim()) {
    body.language_code = options.languageCode.trim()
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?${params}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(body),
    },
  )

  if (res.ok) {
    return res.arrayBuffer()
  }

  const contentType = res.headers.get("content-type") ?? ""
  let detail = `ElevenLabs error ${res.status}`
  if (contentType.includes("application/json")) {
    try {
      const data = (await res.json()) as {
        detail?: { message?: string } | string
      }
      detail =
        typeof data.detail === "string"
          ? data.detail
          : data.detail?.message ?? detail
    } catch {
      /* ignore */
    }
  } else {
    const raw = await res.text()
    if (raw.trim()) detail = raw.slice(0, 300)
  }

  throw classifyElevenLabsTtsErrorMessage(detail)
}
