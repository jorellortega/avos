"use client"

import { OrderItemExtrasPicker } from "@/components/order-item-extras-picker"
import { useCustomizationConfig } from "@/components/order-customizations-provider"
import { parseCartLineCustomization } from "@/lib/order-item-extras"
import { parseCartLineBaseId } from "@/lib/portal-cart-item"

type Props = {
  itemId: string
  onChange: (extras: string[], customNote: string) => void
}

export function PortalCartLineCustomization({ itemId, onChange }: Props) {
  const parsed = parseCartLineBaseId(itemId)
  if (!parsed) return null

  const config = useCustomizationConfig(parsed.categoriaId, parsed.platilloId)
  const { extras, customNote } = parseCartLineCustomization(itemId, config)

  return (
    <OrderItemExtrasPicker
      inline
      compact
      config={config}
      extras={extras}
      customNote={customNote}
      noteInputId={`portal-extra-${itemId}`}
      onExtrasChange={(next) => onChange(next, customNote)}
      onCustomNoteChange={(note) => onChange(extras, note)}
    />
  )
}
