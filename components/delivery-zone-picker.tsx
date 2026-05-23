"use client"

import { cn } from "@/lib/utils"
import {
  enabledDeliveryZones,
  type DeliveryZone,
  type DeliveryZonesJson,
} from "@/lib/delivery-zones"

type Props = {
  data: DeliveryZonesJson
  selectedId: string | null
  onSelect: (zone: DeliveryZone) => void
}

export function DeliveryZonePicker({ data, selectedId, onSelect }: Props) {
  const zones = enabledDeliveryZones(data)
  const maxRow = Math.max(0, ...zones.map((z) => z.mapRow))
  const maxCol = Math.max(0, ...zones.map((z) => z.mapCol))

  const grid: (DeliveryZone | null)[][] = []
  for (let r = 0; r <= maxRow; r++) {
    grid[r] = []
    for (let c = 0; c <= maxCol; c++) {
      grid[r][c] = zones.find((z) => z.mapRow === r && z.mapCol === c) ?? null
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">
        {data.cityLabel} — elige tu colonia o sector
      </p>
      <div
        className="relative rounded-xl border-2 border-primary/20 bg-gradient-to-br from-emerald-50/80 to-amber-50/50 dark:from-emerald-950/30 dark:to-amber-950/20 p-3 md:p-4"
        role="listbox"
        aria-label="Zonas de entrega"
      >
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${maxCol + 1}, minmax(0, 1fr))`,
          }}
        >
          {grid.flatMap((row, ri) =>
            row.map((zone, ci) => {
              if (!zone) {
                return (
                  <div
                    key={`empty-${ri}-${ci}`}
                    className="min-h-[72px] rounded-lg border border-dashed border-border/40 bg-background/30"
                    aria-hidden
                  />
                )
              }
              const active = selectedId === zone.id
              return (
                <button
                  key={zone.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onSelect(zone)}
                  className={cn(
                    "min-h-[72px] rounded-lg border-2 px-2 py-2 text-left transition-all touch-manipulation",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]"
                      : "border-border bg-card/90 hover:border-primary/50 hover:bg-accent/40",
                  )}
                >
                  <span className="block text-xs font-semibold leading-tight">
                    {zone.label}
                  </span>
                  <span
                    className={cn(
                      "block text-[10px] mt-0.5 leading-snug",
                      active ? "text-primary-foreground/90" : "text-muted-foreground",
                    )}
                  >
                    Envío ${zone.fee}
                  </span>
                </button>
              )
            }),
          )}
        </div>
        <p className="text-[10px] text-center text-muted-foreground mt-3">
          Mapa orientativo de Pastor Ortiz
        </p>
      </div>
      {selectedId ? (
        <p className="text-sm text-center">
          {zones.find((z) => z.id === selectedId)?.hint}
        </p>
      ) : null}
    </div>
  )
}
