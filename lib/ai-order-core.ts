import type { OrderItem, OrderType } from "@/components/orders-provider"
import { createServiceRoleClient } from "@/lib/supabase-server"
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
  pruneSupersededIncompleteItems,
  resolvePortalAiLines,
  type PortalAiLineInput,
} from "@/lib/portal-menu-snapshot"
import { sanitizePortalAiLinesFromMessage } from "@/lib/portal-ai-sanitize"
import {
  buildIncompleteOrderFollowUp,
  buildOrderConfirmationMessage,
  orderLinesIncomplete,
} from "@/lib/incomplete-order-prompts"
import { resolvePortalOrderTipo } from "@/lib/portal-order-tipo"

export const AI_ORDER_MAX_MESSAGE_LEN = 4000

type AiOrderJson = {
  items?: PortalAiLineInput[]
  assistantMessage?: string
  mergeMode?: "replace" | "append"
  orderTipo?: string
}

export type AiOrderAudience = "staff" | "customer"

export type ProcessAiOrderInput = {
  message: string
  existingItems?: OrderItem[]
  nextOrderNumber?: number
  orderNumero?: number
  forceAppend?: boolean
  orderTipo?: OrderType
  audience?: AiOrderAudience
}

export type ProcessAiOrderResult =
  | {
      ok: true
      items: OrderItem[]
      total: number
      lineBreakdown: ReturnType<typeof buildPortalOrderLineBreakdown>
      mergeMode: "replace" | "append"
      orderTipo?: OrderType
      assistantMessage: string
      warnings?: string[]
      conversational?: boolean
      incomplete?: boolean
      nextOrderNumber?: number | null
      orderNumero?: number | null
    }
  | { ok: false; status: number; error: string }

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

async function loadAiSettings(): Promise<Record<string, string>> {
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
    console.error("ai-order settings", e)
  }
  return settings
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
    console.error("ai-order OpenAI", res.status, await res.text())
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
    console.error("ai-order Anthropic", res.status, await res.text())
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

function buildSystemPrompt(
  menuSnapshot: string,
  audience: AiOrderAudience,
): string {
  const roleLine =
    audience === "customer"
      ? "Eres el asistente de pedidos en el sitio web de Avos Mexican Grill (clientes en línea)."
      : "Eres el asistente de toma de pedidos en Avos Mexican Grill (portal de caja)."

  const conversationalRule =
    audience === "customer"
      ? `- Si el cliente solo pregunta (menú, ingredientes, horarios, cómo ordenar) SIN pedir comida ahora, devuelve "items": [] y responde en assistantMessage. No inventes líneas de pedido.
`
      : ""

  const userLabel = audience === "customer" ? "Mensaje del cliente" : "Pedido del staff"

  return `${roleLine}
Convierte pedidos en líneas usando SOLO ítems del menú con precios exactos.
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
- Si el carrito ya tiene líneas incompletas (needsProteina / needsPlatilloTamano) y el usuario responde con detalles (ej. «asada», «grande»), devuelve SOLO las líneas que completas con cantidad igual a la del carrito — NO dupliques el mismo platillo en líneas extra ni repitas cantidades.
- NUNCA devuelvas dos líneas del mismo platillo en un solo mensaje (ej. un taco sin proteína y otro taco asada). Una sola línea por platillo por mensaje.
- assistantMessage: si FALTA proteína, tamaño de platillo (chico/grande), tamaño de bebida o sabor de bebida en alguna línea, NO des total ni precio estimado — solo deja items con datos faltantes y un assistantMessage breve (el servidor añadirá las preguntas). Cuando TODO esté completo, resume cantidades y total en pesos MXN ($).
${conversationalRule}- IMPORTANTE: Si piden tacos/tortas/burritos/quesadillas/platillos SIN decir proteína, igual incluye la línea con categoriaId y platilloId correctos y cantidad, pero OMITE el campo "proteina" (no adivines). Ej: "3 tacos" → cantidad 3, categoriaId tacos, sin proteina.
- IMPORTANTE: Si piden un platillo con tamaños (tacos, quesadillas, burritos, chilaquiles, etc.) SIN decir chico o grande, incluye categoriaId y platilloId pero OMITE "platilloTamano" (no asumas chico). Ej: "2 tacos asada" sin tamaño → proteina Asada, sin platilloTamano.
- Chilaquiles sin carne / sencillos / solos → platilloId "chilaquiles" y proteina "Regular". Con pollo/asada/etc. → mismo platilloId con la proteina indicada.
- Acompañamientos (categoriaId "acompanamientos"): guacamole-extra, tortillas-maiz — precio fijo, sin proteína ($2 c/u tortillas de maíz). papas-fritas, arroz, frijoles — chico/grande (platilloTamano), sin proteína; si no dicen tamaño, OMITE platilloTamano.
- Proteína extra (categoriaId "proteina-extra"): asada-vaso, pollo-vaso — precio fijo, sin proteína.
- "small/chico/pequeño" → platilloTamano "chico"; "large/grande" → platilloTamano "grande" en platillos con tamaño.
- IMPORTANTE: Si piden bebida/agua/refresco SIN decir chico o grande, incluye bebidaId y cantidad pero OMITE "bebidaTamano". Ej: "agua de jamaica" sin tamaño → sin bebidaTamano; "large jamaica" → bebidaId jamaica + bebidaTamano grande.
- Si dicen solo "drink"/"bebida"/"grande agua"/"agua" SIN sabor específico (jamaica, horchata, piña, etc.), NO uses bebidaId "agua" (no existe). Usa categoriaId=bebidas, cantidad, bebidaTamano si dijeron grande/chico, y OMITE bebidaId.
- bebidaId válidos son SOLO los del menú (jamaica, horchata, pina, limon-pepino, mango, etc.), nunca "agua" solo.
- NUNCA pongas proteína en una línea si el fragmento del pedido no la menciona. Ej: "tacos, 3 tacos asada" → línea 1: tacos cantidad 1 SIN proteina; línea 2: tacos cantidad 3 proteina Asada.
- Separa cantidades distintas en líneas distintas (ej. "3 tacos" y "2 tacos asada" = 2 líneas).
- TIPO DE ORDEN (orderTipo): "mesa" = comer aquí / en mesa / aquí; "pickup" = para llevar / llevar / takeout; "domicilio" = domicilio / delivery / envío. Si lo mencionan, incluye orderTipo. Si no, omite orderTipo (se mantiene el actual).

MENÚ Y PRECIOS:
${menuSnapshot}

Al final del prompt verás el contexto del carrito y el ${userLabel}.`
}

export async function processAiOrderRequest(
  input: ProcessAiOrderInput,
): Promise<ProcessAiOrderResult> {
  const message = input.message.trim()
  if (!message) {
    return { ok: false, status: 400, error: "Escribe el pedido." }
  }
  if (message.length > AI_ORDER_MAX_MESSAGE_LEN) {
    return { ok: false, status: 400, error: "Mensaje demasiado largo." }
  }

  const audience = input.audience ?? "staff"
  const existingItems = Array.isArray(input.existingItems)
    ? input.existingItems
    : []
  const forceAppend = input.forceAppend === true
  const nextOrderNumber = input.nextOrderNumber
  const orderNumero = input.orderNumero
  const currentOrderTipo =
    input.orderTipo === "mesa" ||
    input.orderTipo === "pickup" ||
    input.orderTipo === "domicilio"
      ? input.orderTipo
      : undefined

  const settings = await loadAiSettings()
  const openaiKey = settings["openai_api_key"]?.trim()
  const anthropicKey = settings["anthropic_api_key"]?.trim()
  if (!openaiKey && !anthropicKey) {
    return {
      ok: false,
      status: 503,
      error: "IA no configurada. Agrega claves en Ajustes de IA.",
    }
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
        : `Carrito borrador (tipo actual: ${tipoLabel}):\n${JSON.stringify(existingItems, null, 0)}${
            existingItems.some(
              (i) =>
                i.needsProteina ||
                i.needsPlatilloTamano ||
                i.needsBebidaTamano ||
                i.needsBebidaEleccion,
            )
              ? "\nHay líneas incompletas: al responder el cliente, completa esas líneas (misma cantidad) sin duplicar."
              : ""
          }`

  const system = buildSystemPrompt(menuSnapshot, audience)
  const userLabel = audience === "customer" ? "Mensaje del cliente" : "Pedido del staff"
  const userPrompt = `${contextBlock}\n\n${userLabel}:\n${message}`

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
    return {
      ok: false,
      status: 502,
      error: "No se pudo interpretar el pedido con IA.",
    }
  }

  const parsed = parseAiJson(rawJson)
  if (!parsed?.items || !Array.isArray(parsed.items)) {
    return {
      ok: false,
      status: 422,
      error: "La IA no devolvió ítems válidos. Intenta ser más específico.",
    }
  }

  const assistantMessage = parsed.assistantMessage?.trim() ?? ""

  if (parsed.items.length === 0) {
    if (audience === "customer" && assistantMessage) {
      const items = existingItems
      const total = orderItemsTotal(items)
      return {
        ok: true,
        items,
        total,
        lineBreakdown: buildPortalOrderLineBreakdown(items),
        mergeMode: "append",
        orderTipo: currentOrderTipo,
        assistantMessage,
        conversational: true,
        nextOrderNumber: nextOrderNumber ?? null,
        orderNumero: orderNumero ?? null,
      }
    }
    return {
      ok: false,
      status: 422,
      error:
        audience === "customer"
          ? "No entendí el pedido. Prueba algo como: 2 tacos asada y una horchata grande."
          : "No se reconoció ningún producto. Usa nombres del menú (ej. tacos asada, burrito pastor).",
    }
  }

  const sanitizedItems = sanitizePortalAiLinesFromMessage(
    parsed.items as PortalAiLineInput[],
    message,
    catalog.json,
  )
  const { items: resolved, errors } = resolvePortalAiLines(sanitizedItems, catalog)

  if (resolved.length === 0) {
    if (audience === "customer" && assistantMessage) {
      const items = existingItems
      const total = orderItemsTotal(items)
      return {
        ok: true,
        items,
        total,
        lineBreakdown: buildPortalOrderLineBreakdown(items),
        mergeMode: "append",
        orderTipo: currentOrderTipo,
        assistantMessage,
        conversational: true,
        warnings: errors.length > 0 ? errors : undefined,
        nextOrderNumber: nextOrderNumber ?? null,
        orderNumero: orderNumero ?? null,
      }
    }
    return {
      ok: false,
      status: 422,
      error:
        errors[0] ??
        "No se reconoció ningún producto. Usa nombres del menú (ej. tacos asada, burrito pastor).",
    }
  }

  const mergeMode =
    forceAppend || existingItems.length > 0
      ? "append"
      : parsed.mergeMode === "replace"
        ? "replace"
        : "append"
  const items = pruneSupersededIncompleteItems(
    mergeOrderItems(existingItems, resolved, mergeMode),
  )
  const total = orderItemsTotal(items)
  const lineBreakdown = buildPortalOrderLineBreakdown(items)
  const orderTipo = resolvePortalOrderTipo(
    message,
    parsed.orderTipo,
    currentOrderTipo,
  )

  const incomplete = orderLinesIncomplete(lineBreakdown)
  const followUp = incomplete ? buildIncompleteOrderFollowUp(lineBreakdown) : null
  const completeMessage = incomplete
    ? assistantMessage
    : buildOrderConfirmationMessage(lineBreakdown, total)

  return {
    ok: true,
    items,
    total,
    lineBreakdown,
    mergeMode,
    orderTipo,
    assistantMessage: followUp ?? completeMessage,
    incomplete,
    warnings: errors.length > 0 ? errors : undefined,
    nextOrderNumber: nextOrderNumber ?? null,
    orderNumero: orderNumero ?? null,
  }
}
