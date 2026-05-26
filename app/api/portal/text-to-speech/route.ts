import { NextResponse } from "next/server"
import {
  ElevenLabsTtsError,
  synthesizeSpeechWithElevenLabs,
} from "@/lib/elevenlabs-tts"
import {
  diagnosePortalElevenLabsSettings,
  isPortalTtsDebugEnabled,
  logPortalElevenLabsDiagnostics,
} from "@/lib/portal-elevenlabs-debug"
import { loadPortalAiSettings, requirePortalStaff } from "@/lib/portal-ai-request"

const MAX_TEXT_CHARS = 2_500

/** Staff-only: why TTS returns 503 (dev-friendly diagnostics). */
export async function GET() {
  const staff = await requirePortalStaff()
  if ("error" in staff && staff.error) return staff.error

  const debug = await diagnosePortalElevenLabsSettings()
  logPortalElevenLabsDiagnostics("GET /api/portal/text-to-speech", debug)

  return NextResponse.json({
    ok: debug.readyForTts,
    blockReason: debug.blockReason,
    debug,
  })
}

export async function POST(req: Request) {
  const staff = await requirePortalStaff()
  if ("error" in staff && staff.error) return staff.error

  let body: { text?: string }
  try {
    body = (await req.json()) as { text?: string }
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const text = body.text?.trim()
  if (!text) {
    return NextResponse.json({ error: "No hay texto para reproducir." }, { status: 400 })
  }
  if (text.length > MAX_TEXT_CHARS) {
    return NextResponse.json(
      { error: "El pedido es demasiado largo para reproducir." },
      { status: 400 },
    )
  }

  const settings = await loadPortalAiSettings()
  const apiKey = settings.elevenlabs_api_key?.trim()
  const voiceId = settings.elevenlabs_voice_id?.trim()
  const modelId = settings.elevenlabs_model?.trim() || "eleven_multilingual_v2"

  const attachDebug = async (blockReason: string) => {
    if (!isPortalTtsDebugEnabled()) return {}
    const debug = await diagnosePortalElevenLabsSettings()
    logPortalElevenLabsDiagnostics(`POST 503: ${blockReason}`, debug)
    return { debug, blockReason: debug.blockReason ?? blockReason }
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Falta la clave de ElevenLabs. Configúrala en Ajustes de IA (/ai-settings).",
        code: "missing_api_key",
        ...(await attachDebug("missing_api_key")),
      },
      { status: 503 },
    )
  }

  if (!voiceId) {
    return NextResponse.json(
      {
        error:
          "Falta el ID de voz de ElevenLabs. En /ai-settings elige una voz (Rachel, Adam, etc.) y espera «Voz guardada» antes de usar Escuchar en el portal.",
        code: "missing_voice_id",
        ...(await attachDebug("missing_voice_id")),
      },
      { status: 503 },
    )
  }

  try {
    const audio = await synthesizeSpeechWithElevenLabs(apiKey, text, {
      voiceId,
      modelId,
      languageCode: "es",
    })
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    if (e instanceof ElevenLabsTtsError) {
      console.error("portal text-to-speech", e.code, e.message)
      const payload: Record<string, unknown> = {
        error: e.message,
        code: e.code,
      }
      if (isPortalTtsDebugEnabled()) {
        const debug = await diagnosePortalElevenLabsSettings()
        if (e.code === "missing_tts_permission") {
          debug.hints = [
            "ai_settings en Supabase está bien (clave + voz guardadas).",
            "Falta permiso text_to_speech en la clave: elevenlabs.io → API keys → edita la clave → activa «Text to Speech».",
            ...debug.hints,
          ]
          debug.blockReason = null
        }
        payload.debug = debug
      }
      return NextResponse.json(payload, {
        status: e.code === "missing_tts_permission" ? 403 : 502,
      })
    }
    const message =
      e instanceof Error ? e.message : "No se pudo generar el audio."
    console.error("portal text-to-speech", message)
    const payload: Record<string, unknown> = { error: message }
    if (isPortalTtsDebugEnabled()) {
      payload.debug = await diagnosePortalElevenLabsSettings()
    }
    return NextResponse.json(payload, { status: 502 })
  }
}
