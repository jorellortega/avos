import { NextResponse } from "next/server"
import {
  ELEVENLABS_PRESET_VOICES,
  ElevenLabsVoicesError,
  listElevenLabsVoices,
} from "@/lib/elevenlabs-voices"
import { loadPortalAiSettings } from "@/lib/portal-ai-request"
import { requireCeo } from "@/lib/require-ceo"

export async function POST(req: Request) {
  const ceo = await requireCeo()
  if ("error" in ceo && ceo.error) return ceo.error

  let body: { apiKey?: string } = {}
  try {
    body = (await req.json()) as { apiKey?: string }
  } catch {
    /* use saved key */
  }

  const fromBody = body.apiKey?.trim()
  const settings = fromBody ? {} : await loadPortalAiSettings()
  const apiKey = fromBody || settings.elevenlabs_api_key?.trim()

  if (!apiKey) {
    return NextResponse.json(
      { error: "Guarda primero tu clave API de ElevenLabs." },
      { status: 400 },
    )
  }

  try {
    const voices = await listElevenLabsVoices(apiKey)
    return NextResponse.json({ voices })
  } catch (e) {
    if (e instanceof ElevenLabsVoicesError) {
      console.error("elevenlabs-voices", e.message)
      return NextResponse.json(
        {
          error: e.message,
          code: e.code,
          presets:
            e.code === "missing_voices_read_permission"
              ? ELEVENLABS_PRESET_VOICES
              : undefined,
        },
        { status: e.code === "missing_voices_read_permission" ? 403 : 502 },
      )
    }
    const message =
      e instanceof Error ? e.message : "No se pudieron cargar las voces."
    console.error("elevenlabs-voices", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
