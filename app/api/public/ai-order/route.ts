import { NextResponse } from "next/server"
import type { OrderItem, OrderType } from "@/components/orders-provider"
import { processAiOrderRequest } from "@/lib/ai-order-core"
import { createServiceRoleClient } from "@/lib/supabase-server"

export async function POST(req: Request) {
  let body: {
    message?: string
    existingItems?: OrderItem[]
    orderTipo?: OrderType
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  try {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("ordering_settings")
      .select("ordering_enabled, closed_message")
      .eq("id", 1)
      .maybeSingle()
    if (data && data.ordering_enabled === false) {
      return NextResponse.json(
        {
          error:
            data.closed_message?.trim() ||
            "En este momento no estamos aceptando pedidos en línea. Intenta más tarde.",
        },
        { status: 503 },
      )
    }
  } catch {
    // If settings lookup fails, don't block ordering.
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  const existingItems = Array.isArray(body.existingItems)
    ? (body.existingItems as OrderItem[])
    : []
  const orderTipo =
    body.orderTipo === "mesa" ||
    body.orderTipo === "pickup" ||
    body.orderTipo === "domicilio"
      ? body.orderTipo
      : undefined

  const result = await processAiOrderRequest({
    message,
    existingItems,
    orderTipo,
    audience: "customer",
    forceAppend: existingItems.length > 0,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    items: result.items,
    total: result.total,
    lineBreakdown: result.lineBreakdown,
    mergeMode: result.mergeMode,
    orderTipo: result.orderTipo,
    assistantMessage: result.assistantMessage,
    warnings: result.warnings,
    conversational: result.conversational ?? false,
    incomplete: result.incomplete ?? false,
  })
}
