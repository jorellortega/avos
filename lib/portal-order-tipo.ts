import type { OrderType } from "@/components/orders-provider"

export const PORTAL_TIPO_OPTIONS: { value: OrderType; label: string }[] = [
  { value: "mesa", label: "Aquí" },
  { value: "pickup", label: "Llevar" },
  { value: "domicilio", label: "Domicilio" },
]

export const PORTAL_TIPO_LABEL: Record<OrderType, string> = {
  mesa: "Aquí",
  pickup: "Llevar",
  domicilio: "Domicilio",
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

/** Map AI / free-text to canonical OrderType. */
export function normalizeOrderTipo(raw: string | undefined | null): OrderType | null {
  if (!raw?.trim()) return null
  const s = normalizeText(raw.trim())
  if (
    s === "mesa" ||
    s === "aqui" ||
    s === "aquí" ||
    s === "dine-in" ||
    s === "dine_in" ||
    s === "here"
  ) {
    return "mesa"
  }
  if (
    s === "pickup" ||
    s === "llevar" ||
    s === "para llevar" ||
    s === "takeout" ||
    s === "take-out" ||
    s === "recoger"
  ) {
    return "pickup"
  }
  if (
    s === "domicilio" ||
    s === "delivery" ||
    s === "a domicilio" ||
    s === "envio" ||
    s === "envío"
  ) {
    return "domicilio"
  }
  return null
}

/** Detect order type from staff message (Spanish/English). */
export function detectOrderTipoFromMessage(message: string): OrderType | null {
  const s = normalizeText(message)

  if (
    /(?:^|[\s,.])(?:a\s+)?domicilio(?:$|[\s,.])/.test(s) ||
    /\b(envio a domicilio|envío a domicilio|delivery|entrega a domicilio|para entregar)\b/.test(
      s,
    )
  ) {
    return "domicilio"
  }
  if (
    /para\s+llevar(?:lo)?(?:\s|$|[,.])/.test(s) ||
    /\b(takeout|take out|pickup|pick up|recoger|recojo|recogida)\b/.test(s) ||
    /(?:^|[\s,.])llevar(?:$|[\s,.])/.test(s)
  ) {
    return "pickup"
  }
  if (
    /para\s+aqui(?:\s|$|[,.])/.test(s) ||
    /\b(comer aqui|comer aquí|en el local|en local|dine in|for here|orden aqui|orden aquí)\b/.test(
      s,
    ) ||
    /\b(en mesa|mesa\s*\d)/.test(s) ||
    /(?:^|[\s,.])aqui(?:$|[\s,.])/.test(s)
  ) {
    return "mesa"
  }

  return null
}

export function resolvePortalOrderTipo(
  message: string,
  aiTipo: string | undefined | null,
  current: OrderType | undefined,
): OrderType {
  return (
    detectOrderTipoFromMessage(message) ??
    normalizeOrderTipo(aiTipo) ??
    current ??
    "mesa"
  )
}
