import type { OrderType } from "@/components/orders-provider"
import type { PortalDeliveryInfo } from "@/lib/portal-delivery"
import { PORTAL_TIPO_LABEL } from "@/lib/portal-order-tipo"
import type { PortalOrderLineBreakdown } from "@/lib/portal-menu-snapshot"

const MAX_TTS_CHARS = 2_500

export type PortalOrderSpeechInput = {
  orderNumero?: number
  lines: PortalOrderLineBreakdown[]
  total: number
  orderTipo?: OrderType
  delivery?: PortalDeliveryInfo
  clienteNombre?: string
}

function lineToSpeech(line: PortalOrderLineBreakdown): string {
  let name = line.nombre
    .replace(/\s*\(elige proteína\)/gi, "")
    .replace(/\s*\(elige tamaño\)/gi, "")
    .trim()
  if (line.proteina && !name.toLowerCase().includes(line.proteina.toLowerCase())) {
    name = `${name} de ${line.proteina}`
  }
  const qty =
    line.cantidad === 1 ? "un" : line.cantidad === 2 ? "dos" : String(line.cantidad)
  const unit = line.cantidad === 1 ? "" : " "
  let phrase = `${qty}${unit} ${name}`.trim()
  if (line.notas?.trim()) {
    phrase += `, ${line.notas.trim()}`
  }
  if (line.needsProteina) phrase += ", falta elegir proteína"
  if (line.needsBebidaTamano) phrase += ", falta elegir tamaño de bebida"
  if (line.needsBebidaEleccion) phrase += ", falta elegir bebida"
  return phrase
}

/** Natural Spanish script for ElevenLabs TTS (kitchen / cashier playback). */
export function formatPortalOrderSpeechText(input: PortalOrderSpeechInput): string {
  const parts: string[] = []

  if (input.orderNumero != null) {
    parts.push(`Orden número ${input.orderNumero}.`)
  }

  if (input.clienteNombre?.trim()) {
    parts.push(`Cliente: ${input.clienteNombre.trim()}.`)
  }

  if (input.orderTipo) {
    parts.push(`Tipo: ${PORTAL_TIPO_LABEL[input.orderTipo]}.`)
  }

  if (input.orderTipo === "domicilio" && input.delivery) {
    if (input.delivery.deliveryZoneLabel?.trim()) {
      parts.push(`Zona: ${input.delivery.deliveryZoneLabel.trim()}.`)
    }
    if (input.delivery.deliveryAddress?.trim()) {
      parts.push(`Dirección: ${input.delivery.deliveryAddress.trim()}.`)
    }
  }

  if (input.lines.length === 0) {
    parts.push("Sin artículos en el pedido.")
  } else {
    parts.push("Pedido:")
    for (const line of input.lines) {
      parts.push(lineToSpeech(line))
    }
  }

  parts.push(`Total: ${input.total.toFixed(2)} pesos mexicanos.`)

  let text = parts.join(" ")
  if (text.length > MAX_TTS_CHARS) {
    text = `${text.slice(0, MAX_TTS_CHARS - 3).trim()}...`
  }
  return text
}
