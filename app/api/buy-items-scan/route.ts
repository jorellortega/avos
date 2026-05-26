import { NextResponse } from "next/server"
import type { AISettingsMap } from "@/lib/ai-types"
import {
  BUY_LIST_SCAN_SYSTEM_PROMPT,
  parseBuyListScanJson,
} from "@/lib/buy-list-ai"
import { requireStaffOrders } from "@/lib/require-staff-orders"
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

async function loadAiSettings(): Promise<AISettingsMap> {
  const service = createServiceRoleClient()
  const { data, error } = await service
    .from("ai_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["openai_api_key", "openai_model"])

  if (!error && data) return mapSettings(data)

  const { data: rpcData } = await service.rpc("get_ai_settings")
  return mapSettings(
    rpcData as { setting_key: string; setting_value: string }[] | null,
  )
}

async function callOpenAiJson(
  apiKey: string,
  model: string,
  userContent: string | { type: string; text?: string; image_url?: { url: string } }[],
): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: BUY_LIST_SCAN_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  })

  if (!res.ok) {
    console.error("buy-items-scan OpenAI", res.status, await res.text())
    return null
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return data?.choices?.[0]?.message?.content?.trim() ?? null
}

export async function POST(req: Request) {
  const staff = await requireStaffOrders()
  if ("error" in staff && staff.error) return staff.error

  let body: {
    mode?: "image" | "text"
    imageBase64?: string
    mimeType?: string
    text?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const mode = body.mode === "text" ? "text" : "image"

  let settings: AISettingsMap
  try {
    settings = await loadAiSettings()
  } catch {
    return NextResponse.json(
      { error: "Servidor sin configuración de IA." },
      { status: 503 },
    )
  }

  const apiKey = settings["openai_api_key"]?.trim()
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Falta la clave de OpenAI en Ajustes de IA (/ai-settings).",
      },
      { status: 503 },
    )
  }

  const model = visionModel(settings)

  let content: string | null = null

  if (mode === "text") {
    const text = typeof body.text === "string" ? body.text.trim() : ""
    if (!text) {
      return NextResponse.json({ error: "Escribe o pega una lista." }, { status: 400 })
    }
    content = await callOpenAiJson(
      apiKey,
      model.includes("gpt-4o") ? model : "gpt-4o-mini",
      `Organiza esta lista de compras en items claros:\n\n${text}`,
    )
  } else {
    const imageBase64 =
      typeof body.imageBase64 === "string" ? body.imageBase64.trim() : ""
    const mimeType =
      typeof body.mimeType === "string" && body.mimeType.startsWith("image/")
        ? body.mimeType
        : "image/jpeg"

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

    content = await callOpenAiJson(apiKey, model, [
      {
        type: "text",
        text: "Lee la foto y extrae todos los artículos de la lista de compras.",
      },
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${rawB64}` },
      },
    ])
  }

  if (!content) {
    return NextResponse.json(
      { error: "No se pudo analizar. Revisa el modelo en Ajustes de IA." },
      { status: 502 },
    )
  }

  const scan = parseBuyListScanJson(content)
  if (!scan) {
    return NextResponse.json(
      { error: "No se pudo interpretar la respuesta de la IA." },
      { status: 502 },
    )
  }

  if (scan.items.length === 0) {
    return NextResponse.json(
      {
        error: "No se detectaron artículos. Prueba otra foto o escribe la lista a mano.",
        scan,
      },
      { status: 422 },
    )
  }

  return NextResponse.json({ scan, model })
}
