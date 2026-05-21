import { NextResponse } from "next/server"
import type { AISettingsMap } from "@/lib/ai-types"
import {
  INVENTORY_SCAN_SYSTEM_PROMPT,
  parseInventoryScanJson,
} from "@/lib/inventory-ai-scan"
import { isManagerOrCeo } from "@/lib/profile-types"
import { createServerSupabase } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

function mapSettings(
  rows: { setting_key: string; setting_value: string }[] | null,
): AISettingsMap {
  const out: AISettingsMap = {}
  if (!rows) return out
  for (const row of rows) {
    out[row.setting_key] = row.setting_value
  }
  return out
}

function visionModel(settings: AISettingsMap): string {
  const preferred = settings["openai_model"]?.trim() || "gpt-4o-mini"
  if (preferred.includes("gpt-4o")) return preferred
  return "gpt-4o-mini"
}

export async function POST(req: Request) {
  let body: {
    imageBase64?: string
    mimeType?: string
    productName?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (!isManagerOrCeo(profile?.role)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 })
  }

  const imageBase64 =
    typeof body.imageBase64 === "string" ? body.imageBase64.trim() : ""
  const mimeType =
    typeof body.mimeType === "string" && body.mimeType.startsWith("image/")
      ? body.mimeType
      : "image/jpeg"
  const productName =
    typeof body.productName === "string" ? body.productName.trim() : ""

  if (!imageBase64) {
    return NextResponse.json({ error: "Falta la imagen." }, { status: 400 })
  }

  const rawB64 = imageBase64.replace(/^data:image\/\w+;base64,/, "")
  const sizeBytes = Math.ceil((rawB64.length * 3) / 4)
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Imagen demasiado grande (máx. 8 MB)." },
      { status: 400 },
    )
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Servidor sin configuración de IA." },
      { status: 503 },
    )
  }

  const { data: settingsData, error: settingsError } =
    await service.rpc("get_ai_settings")
  if (settingsError) {
    console.error("get_ai_settings", settingsError)
    return NextResponse.json(
      { error: "No se pudo cargar la configuración de IA." },
      { status: 503 },
    )
  }

  const settings = mapSettings(
    settingsData as { setting_key: string; setting_value: string }[] | null,
  )
  const apiKey = settings["openai_api_key"]?.trim()
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Falta la clave de OpenAI en Ajustes de IA (/ai-settings).",
      },
      { status: 503 },
    )
  }

  const model = visionModel(settings)
  const userText = productName
    ? `Producto en inventario: "${productName}". Analiza la foto y completa el JSON.`
    : "Analiza la foto del producto de inventario y completa el JSON."

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: INVENTORY_SCAN_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${rawB64}`,
              },
            },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("OpenAI vision error", res.status, err)
    return NextResponse.json(
      { error: "No se pudo analizar la imagen. Revisa el modelo en Ajustes de IA." },
      { status: 502 },
    )
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) {
    return NextResponse.json(
      { error: "La IA no devolvió resultados." },
      { status: 502 },
    )
  }

  const scan = parseInventoryScanJson(content)
  if (!scan) {
    return NextResponse.json(
      { error: "No se pudo interpretar la respuesta de la IA." },
      { status: 502 },
    )
  }

  return NextResponse.json({ scan, model })
}
