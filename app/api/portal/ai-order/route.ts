import { NextResponse } from "next/server"
import type { OrderItem } from "@/components/orders-provider"
import { createServerSupabase } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { isStaffOrdersRole } from "@/lib/profile-types"
import {
  MENU_CATALOG_KEY,
  buildMenuCatalogHelpers,
  defaultMenuCatalogJson,
  parseMenuCatalogJson,
} from "@/lib/menu-catalog-shared"
import {
  buildPortalMenuSnapshot,
  buildPortalOrderLineBreakdown,
  mergeOrderItems,
  orderItemsTotal,
  resolvePortalAiLines,
  type PortalAiLineInput,
} from "@/lib/portal-menu-snapshot"
import { sanitizePortalAiLinesFromMessage } from "@/lib/portal-ai-sanitize"
import { resolvePortalOrderTipo } from "@/lib/portal-order-tipo"
import type { OrderType } from "@/components/orders-provider"

const MAX_MESSAGE_LEN = 4000

type AiOrderJson = {
  items?: PortalAiLineInput[]
  assistantMessage?: string
  mergeMode?: "replace" | "append"
  orderTipo?: string
}

async function loadMenuCatalog() {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from("ai_settings")
    .select("setting_value")
    .eq("setting_key", MENU_CATALOG_KEY)
    .maybeSingle()
  const json = data?.setting_value
    ? parseMenuCatalogJson(data.setting_value)
    : defaultMenuCatalogJson()
  return buildMenuCatalogHelpers(json)
}

async function callOpenAIJson(
  system: string,
  user: string,
  apiKey: string,
  model: string,
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
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })
  if (!res.ok) {
    console.error("portal ai-order OpenAI", res.status, await res.text())
    return null
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return data?.choices?.[0]?.message?.content?.trim() ?? null
}

async function callAnthropicJson(
  system: string,
  user: string,
  apiKey: string,
  model: string,
): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    }),
  })
  if (!res.ok) {
    console.error("portal ai-order Anthropic", res.status, await res.text())
    return null
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[]
  }
  return data?.content?.find((b) => b.type === "text")?.text?.trim() ?? null
}

function parseAiJson(raw: string): AiOrderJson | null {
  try {
    const j = JSON.parse(raw) as AiOrderJson
    if (!j || typeof j !== "object") return null
    return j
  } catch {
    const start = raw.indexOf("{")
    const end = raw.lastIndexOf("}")
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(raw.slice(start, end + 1)) as AiOrderJson
    } catch {
      return null
    }
  }
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión de personal." }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || !isStaffOrdersRole(profile.role)) {
    return NextResponse.json({ error: "Sin permiso de personal." }, { status: 403 })
  }

  let body: {
    message?: string
    existingItems?: OrderItem[]
    nextOrderNumber?: number
    orderNumero?: number
    forceAppend?: boolean
    orderTipo?: OrderType
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (!message) {
    return NextResponse.json({ error: "Escribe el pedido." }, { status: 400 })
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: "Mensaje demasiado largo." }, { status: 400 })
  }

  const existingItems = Array.isArray(body.existingItems)
    ? (body.existingItems as OrderItem[])
    : []
  const forceAppend = body.forceAppend === true
  const nextOrderNumber =
    typeof body.nextOrderNumber === "number" ? body.nextOrderNumber : undefined
  const orderNumero =
    typeof body.orderNumero === "number" ? body.orderNumero : undefined
  const currentOrderTipo =
    body.orderTipo === "mesa" ||
    body.orderTipo === "pickup" ||
    body.orderTipo === "domicilio"
      ? body.orderTipo
      : undefined

  const settings: Record<string, string> = {}
  try {
    const service = createServiceRoleClient()
    const { data, error } = await service.rpc("get_ai_settings")
    if (!error && Array.isArray(data)) {
      for (const row of data as { setting_key: string; setting_value: string }[]) {
        if (row?.setting_key) settings[row.setting_key] = row.setting_value ?? ""
      }
    }
  } catch (e) {
    console.error("portal ai-order settings", e)
  }

  const openaiKey = settings["openai_api_key"]?.trim()
  const anthropicKey = settings["anthropic_api_key"]?.trim()
  if (!openaiKey && !anthropicKey) {
    return NextResponse.json(
      { error: "IA no configurada. Agrega claves en Ajustes de IA." },
      { status: 503 },
    )
  }

  const catalog = await loadMenuCatalog()
  const menuSnapshot = buildPortalMenuSnapshot(catalog)

  const tipoLabel =
    currentOrderTipo === "pickup"
      ? "para llevar"
      : currentOrderTipo === "domicilio"
        ? "domicilio"
        : "aquí (mesa)"
  const contextBlock =
    orderNumero != null
      ? `Orden activa #${orderNumero} (${tipoLabel}). Carrito actual (${existingItems.length} líneas):\n${JSON.stringify(existingItems, null, 0)}\nModo: agregar o reemplazar según lo que pida el usuario.`
      : nextOrderNumber != null
        ? `Nueva orden (número reservado #${nextOrderNumber}, tipo actual: ${tipoLabel}). Carrito borrador:\n${JSON.stringify(existingItems, null, 0)}`
        : `Carrito borrador (tipo actual: ${tipoLabel}):\n${JSON.stringify(existingItems, null, 0)}`

  const system = `Eres el asistente de toma de pedidos en Avos Mexican Grill (portal de caja).
Convierte el mensaje del staff en líneas de pedido usando SOLO ítems del menú con precios exactos.
Responde ÚNICAMENTE con JSON válido (sin markdown) con esta forma:
{
  "mergeMode": "append" | "replace",
  "items": [
    {
      "categoriaId": "tacos",
      "platilloId": "tacos",
      "proteina": "Asada",
      "cantidad": 2,
      "notas": "sin salsa"
    },
    {
      "categoriaId": "bebidas",
      "bebidaId": "horchata",
      "bebidaTamano": "chico",
      "cantidad": 1
    }
  ],
  "assistantMessage": "Resumen breve en español con total estimado",
  "orderTipo": "mesa" | "pickup" | "domicilio"
}

Reglas:
- Usa categoriaId, platilloId, proteina y precios del menú abajo.
- "small/chico/pequeño" → bebidaTamano "chico"; "large/grande" → "grande".
- Sinónimos: asada=Asada, pollo=Pollo, pastor=Pastor, chorizo=Chorizo, carnitas=Carnitas, camarón/camaron=Camarón.
- Si el usuario pide quitar algo, ponlo en "notas" (ej. "sin salsa").
- mergeMode "append" salvo que diga reemplazar, borrar todo o nueva orden limpia.
- assistantMessage debe mencionar cantidades y total aproximado en pesos MXN ($).
- IMPORTANTE: Si piden tacos/tortas/burritos/quesadillas/platillos SIN decir proteína, igual incluye la línea con categoriaId y platilloId correctos y cantidad, pero OMITE el campo "proteina" (no adivines). Ej: "3 tacos" → cantidad 3, categoriaId tacos, sin proteina.
- IMPORTANTE: Si piden bebida/agua/refresco SIN decir chico o grande, incluye bebidaId y cantidad pero OMITE "bebidaTamano". Ej: "agua de jamaica" sin tamaño → sin bebidaTamano; "large jamaica" → bebidaId jamaica + bebidaTamano grande.
- Si dicen solo "drink"/"bebida"/"grande agua"/"agua" SIN sabor específico (jamaica, horchata, piña, etc.), NO uses bebidaId "agua" (no existe). Usa categoriaId=bebidas, cantidad, bebidaTamano si dijeron grande/chico, y OMITE bebidaId.
- bebidaId válidos son SOLO los del menú (jamaica, horchata, pina, limon-pepino, mango, etc.), nunca "agua" solo.
- NUNCA pongas proteína en una línea si el fragmento del pedido no la menciona. Ej: "tacos, 3 tacos asada" → línea 1: tacos cantidad 1 SIN proteina; línea 2: tacos cantidad 3 proteina Asada.
- Separa cantidades distintas en líneas distintas (ej. "3 tacos" y "2 tacos asada" = 2 líneas).
- TIPO DE ORDEN (orderTipo): "mesa" = comer aquí / en mesa / aquí; "pickup" = para llevar / llevar / takeout; "domicilio" = domicilio / delivery / envío. Si el staff lo dice en el mensaje, incluye orderTipo. Si no lo menciona, omite orderTipo (se mantiene el actual).

MENÚ Y PRECIOS:
${menuSnapshot}`

  const userPrompt = `${contextBlock}\n\nPedido del staff:\n${message}`

  let rawJson: string | null = null
  if (openaiKey) {
    rawJson = await callOpenAIJson(
      system,
      userPrompt,
      openaiKey,
      settings["openai_model"]?.trim() || "gpt-4o-mini",
    )
  }
  if (!rawJson && anthropicKey) {
    rawJson = await callAnthropicJson(
      system + "\n\nResponde solo JSON, sin texto extra.",
      userPrompt,
      anthropicKey,
      settings["anthropic_model"]?.trim() || "claude-3-5-sonnet-20241022",
    )
  }

  if (!rawJson) {
    return NextResponse.json(
      { error: "No se pudo interpretar el pedido con IA." },
      { status: 502 },
    )
  }

  const parsed = parseAiJson(rawJson)
  if (!parsed?.items || !Array.isArray(parsed.items)) {
    return NextResponse.json(
      { error: "La IA no devolvió ítems válidos. Intenta ser más específico." },
      { status: 422 },
    )
  }

  const sanitizedItems = sanitizePortalAiLinesFromMessage(
    parsed.items as PortalAiLineInput[],
    message,
    catalog.json,
  )
  const { items: resolved, errors } = resolvePortalAiLines(sanitizedItems, catalog)
  if (resolved.length === 0) {
    return NextResponse.json(
      {
        error:
          errors[0] ??
          "No se reconoció ningún producto. Usa nombres del menú (ej. tacos asada, burrito pastor).",
      },
      { status: 422 },
    )
  }

  const mergeMode =
    forceAppend || existingItems.length > 0
      ? "append"
      : parsed.mergeMode === "replace"
        ? "replace"
        : "append"
  const items = mergeOrderItems(existingItems, resolved, mergeMode)
  const total = orderItemsTotal(items)
  const lineBreakdown = buildPortalOrderLineBreakdown(items)
  const orderTipo = resolvePortalOrderTipo(
    message,
    parsed.orderTipo,
    currentOrderTipo,
  )

  return NextResponse.json({
    items,
    total,
    lineBreakdown,
    mergeMode,
    orderTipo,
    assistantMessage:
      parsed.assistantMessage?.trim() ||
      `Listo: ${resolved.length} línea(s). Total $${total.toFixed(2)}.`,
    warnings: errors.length > 0 ? errors : undefined,
    nextOrderNumber: nextOrderNumber ?? null,
    orderNumero: orderNumero ?? null,
  })
}
