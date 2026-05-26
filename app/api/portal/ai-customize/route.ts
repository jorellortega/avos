import { NextResponse } from "next/server"
import type { OrderItem } from "@/components/orders-provider"
import {
  callPortalAiJson,
  loadPortalAiSettings,
  parseAiJsonObject,
  requirePortalStaff,
} from "@/lib/portal-ai-request"

const MAX_INSTRUCTION_LEN = 500

type AiCustomizeJson = {
  notas?: string
  assistantMessage?: string
}

export async function POST(req: Request) {
  const staff = await requirePortalStaff()
  if ("error" in staff && staff.error) return staff.error

  let body: { item?: OrderItem; instruction?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const item = body.item
  const instruction =
    typeof body.instruction === "string" ? body.instruction.trim() : ""

  if (!item?.id || !item.nombre) {
    return NextResponse.json({ error: "Artículo no válido." }, { status: 400 })
  }
  if (!instruction) {
    return NextResponse.json({ error: "Escribe la personalización." }, { status: 400 })
  }
  if (instruction.length > MAX_INSTRUCTION_LEN) {
    return NextResponse.json({ error: "Instrucción demasiado larga." }, { status: 400 })
  }

  const settings = await loadPortalAiSettings()
  if (!settings.openai_api_key?.trim() && !settings.anthropic_api_key?.trim()) {
    return NextResponse.json(
      { error: "IA no configurada. Agrega claves en Ajustes de IA." },
      { status: 503 },
    )
  }

  const system = `Eres el asistente de cocina en Avos Mexican Grill (portal de caja).
El staff describe cómo personalizar UN artículo del pedido. Devuelve SOLO JSON válido:
{
  "notas": "texto corto para cocina en español",
  "assistantMessage": "confirmación breve en español"
}

Reglas:
- "notas" es lo que verá cocina: claro, corto, en español (ej. "sin salsa", "plain", "sin cebolla, extra limón").
- Si el artículo ya tiene notas, combínalas con lo nuevo (sin duplicar). Si piden quitar algo, respétalo.
- No cambies cantidad, proteína ni nombre del platillo; solo personalización / notas.
- Sin markdown ni texto fuera del JSON.`

  const userPrompt = `Artículo:
- Nombre: ${item.nombre}
- Cantidad: ${item.cantidad}
- Categoría: ${item.categoria}
${item.proteina ? `- Proteína: ${item.proteina}` : ""}
${item.notas ? `- Notas actuales: ${item.notas}` : "- Notas actuales: (ninguna)"}

Instrucción del staff:
${instruction}`

  const rawJson = await callPortalAiJson(system, userPrompt, settings)
  if (!rawJson) {
    return NextResponse.json(
      { error: "No se pudo interpretar la personalización." },
      { status: 502 },
    )
  }

  const parsed = parseAiJsonObject<AiCustomizeJson>(rawJson)
  const notas = parsed?.notas?.trim()
  if (!notas) {
    return NextResponse.json(
      { error: "La IA no devolvió notas válidas. Intenta de nuevo." },
      { status: 422 },
    )
  }

  return NextResponse.json({
    notas,
    assistantMessage:
      parsed?.assistantMessage?.trim() || `Notas: ${notas}`,
  })
}
