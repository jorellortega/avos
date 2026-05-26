import { NextResponse } from "next/server"
import {
  ElevenLabsSttError,
  transcribeAudioWithElevenLabs,
} from "@/lib/elevenlabs-stt"
import { loadPortalAiSettings, requirePortalStaff } from "@/lib/portal-ai-request"

const MAX_BYTES = 25 * 1024 * 1024

export async function POST(req: Request) {
  const staff = await requirePortalStaff()
  if ("error" in staff && staff.error) return staff.error

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "No se recibió audio." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Audio demasiado largo. Graba un pedido más corto." },
      { status: 400 },
    )
  }

  const settings = await loadPortalAiSettings()
  const apiKey = settings.elevenlabs_api_key?.trim()
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Falta la clave de ElevenLabs. Configúrala en Ajustes de IA (/ai-settings).",
      },
      { status: 503 },
    )
  }

  const modelId = settings.elevenlabs_stt_model?.trim() || "scribe_v2"
  const name =
    file instanceof File && file.name ? file.name : "recording.webm"

  try {
    const { text, languageCode } = await transcribeAudioWithElevenLabs(
      apiKey,
      file,
      {
        modelId,
        languageCode: "spa",
        fileName: name,
      },
    )
    return NextResponse.json({ text, languageCode })
  } catch (e) {
    if (e instanceof ElevenLabsSttError) {
      console.error("portal speech-to-text", e.message)
      return NextResponse.json(
        {
          error: e.message,
          code: e.code,
          fallback: e.code === "missing_stt_permission" ? "browser" : undefined,
        },
        { status: e.code === "missing_stt_permission" ? 403 : 502 },
      )
    }
    const message =
      e instanceof Error ? e.message : "No se pudo transcribir el audio."
    console.error("portal speech-to-text", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
