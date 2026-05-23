export const DELIVERY_ZONES_KEY = "public_delivery_zones" as const

export type DeliveryZone = {
  id: string
  label: string
  hint: string
  fee: number
  enabled: boolean
  mapRow: number
  mapCol: number
}

export type DeliveryZonesJson = {
  cityLabel: string
  zones: DeliveryZone[]
}

export function defaultDeliveryZonesJson(): DeliveryZonesJson {
  return {
    cityLabel: "Pastor Ortiz, Michoacán",
    zones: [
      {
        id: "centro",
        label: "Centro",
        hint: "Alrededor de la parroquia y plaza",
        fee: 35,
        enabled: true,
        mapRow: 1,
        mapCol: 2,
      },
      {
        id: "colonia-norte",
        label: "Colonia (norte)",
        hint: "Zona noreste, cerca de la unidad deportiva",
        fee: 40,
        enabled: true,
        mapRow: 0,
        mapCol: 2,
      },
      {
        id: "colonia-oeste",
        label: "Colonia (oeste)",
        hint: "Al oeste del río / arroyo",
        fee: 45,
        enabled: true,
        mapRow: 1,
        mapCol: 0,
      },
      {
        id: "la-planta",
        label: "La Planta",
        hint: "Sector suroeste",
        fee: 50,
        enabled: true,
        mapRow: 2,
        mapCol: 0,
      },
      {
        id: "la-herradura",
        label: "La Herradura",
        hint: "Sobre Av. Hidalgo",
        fee: 40,
        enabled: true,
        mapRow: 1,
        mapCol: 1,
      },
      {
        id: "los-vazquez",
        label: "Los Vázquez",
        hint: "Sur del centro",
        fee: 45,
        enabled: true,
        mapRow: 2,
        mapCol: 1,
      },
      {
        id: "lazaro-cardenas",
        label: "Lázaro Cárdenas",
        hint: "Zona sur",
        fee: 55,
        enabled: true,
        mapRow: 2,
        mapCol: 2,
      },
    ],
  }
}

function sanitizeZone(raw: unknown): DeliveryZone | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === "string" ? o.id.trim() : ""
  const label = typeof o.label === "string" ? o.label.trim() : ""
  if (!id || !label) return null
  const fee = Number(o.fee)
  return {
    id: id.slice(0, 64),
    label: label.slice(0, 80),
    hint:
      typeof o.hint === "string" ? o.hint.trim().slice(0, 200) : "",
    fee: Number.isFinite(fee) && fee >= 0 ? Math.round(fee * 100) / 100 : 0,
    enabled: o.enabled !== false,
    mapRow:
      typeof o.mapRow === "number" && o.mapRow >= 0 && o.mapRow <= 4
        ? Math.floor(o.mapRow)
        : 0,
    mapCol:
      typeof o.mapCol === "number" && o.mapCol >= 0 && o.mapCol <= 4
        ? Math.floor(o.mapCol)
        : 0,
  }
}

export function parseDeliveryZonesJson(
  raw: string | null | undefined,
): DeliveryZonesJson {
  const fallback = defaultDeliveryZonesJson()
  if (!raw?.trim()) return fallback
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fallback
    }
    const root = parsed as Record<string, unknown>
    const cityLabel =
      typeof root.cityLabel === "string" && root.cityLabel.trim()
        ? root.cityLabel.trim().slice(0, 120)
        : fallback.cityLabel
    const zones: DeliveryZone[] = []
    if (Array.isArray(root.zones)) {
      for (const z of root.zones) {
        const zone = sanitizeZone(z)
        if (zone) zones.push(zone)
      }
    }
    return {
      cityLabel,
      zones: zones.length > 0 ? zones : fallback.zones,
    }
  } catch {
    return fallback
  }
}

export function serializeDeliveryZonesJson(json: DeliveryZonesJson): string {
  return JSON.stringify(json)
}

export function enabledDeliveryZones(json: DeliveryZonesJson): DeliveryZone[] {
  return json.zones.filter((z) => z.enabled)
}

export function getDeliveryZoneById(
  json: DeliveryZonesJson,
  id: string,
): DeliveryZone | undefined {
  return json.zones.find((z) => z.id === id && z.enabled)
}

export function slugifyZoneId(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
}
