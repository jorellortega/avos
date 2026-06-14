"use client"

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Plus,
  Minus,
  ShoppingCart,
  Utensils,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react"
import {
  BEBIDAS_CATEGORIA_ID,
  bebidasOrdenar,
  bebidaTamanoLabels,
  categorias,
  getPlatillosForCategoria,
  getPlatilloTamanoLabel,
  imagenCategoriaBebidas,
  menuCategories,
  type BebidaOrdenar,
  type BebidaTamano,
  type OrdenarMenuItem,
  isProteinaRegular,
  type ProteinaPlatillo,
} from "@/lib/menu-data"
import { BebidaThumb } from "@/components/bebida-thumb"
import { useBebidaImagenes } from "@/lib/use-bebida-imagenes"
import { useProteinaImagenes } from "@/lib/use-proteina-imagenes"
import { useCategoriaImagenes } from "@/lib/use-categoria-imagenes"
import { useOrders, type OrderItem } from "@/components/orders-provider"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import type { MenuCatalogHelpers } from "@/lib/menu-catalog-shared"
import { insertAvosOrderToSupabase } from "@/lib/avos-orders-sync"
import { logCheckoutClient } from "@/lib/checkout-debug-client"
import { menuCategoryTabButtonClass } from "@/components/menu-category-tab-styles"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { OrderItemExtrasPicker } from "@/components/order-item-extras-picker"
import {
  useCustomizationConfig,
  useOrderCustomizationsContext,
  useOrderCustomizationsContextOptional,
} from "@/components/order-customizations-provider"
import {
  defaultOrderExtras,
  defaultPlatilloCustomizationConfig,
} from "@/lib/order-item-customizations"
import { cartLineKey, formatOrderItemNotas } from "@/lib/order-item-extras"
import {
  platilloCartSuffix,
  platilloLineNombre,
  platilloPickerFlags,
  type PlatilloPickerFlags,
} from "@/lib/platillo-config"

interface CartItem {
  id: string
  name: string
  categoria: string
  protein?: ProteinaPlatillo
  price: number
  quantity: number
  extras: string[]
  customNote: string
  categoryId: string
  menuItemId: string
}

const categoriaEmoji: Record<string, string> = {
  tacos: "🌮",
  tortas: "🥪",
  burritos: "🌯",
  quesadillas: "🧀",
  platillos: "🍽️",
  "carne-asada-fries": "🍟",
  "menu-infantil": "🧒",
  acompanamientos: "🍟",
  "proteina-extra": "🥩",
  bebidas: "🥤",
}


function OrdenarFixedPlatilloRow({
  item,
  categoryId,
  categoryName,
  catalog,
  onAdd,
}: {
  item: OrdenarMenuItem
  categoryId: string
  categoryName: string
  catalog: MenuCatalogHelpers | null
  onAdd: (
    item: OrdenarMenuItem,
    categoria: string,
    qty: number,
    categoryId: string,
    extras: string[],
    customNote: string,
    tamano?: BebidaTamano,
  ) => void
}) {
  const [qty, setQty] = useState(1)
  const [selectedTamano, setSelectedTamano] = useState<BebidaTamano>("chico")
  const customizationConfig = useCustomizationConfig(categoryId, item.id)
  const [extras, setExtras] = useState<string[]>(() =>
    defaultOrderExtras(customizationConfig),
  )
  const [customNote, setCustomNote] = useState("")
  const agotado = catalog?.isPlatilloOut(categoryId, item.id) ?? false
  const price = item.tieneTamanos
    ? catalog?.getPlatilloPrecioTamano(categoryId, item.id, selectedTamano) ??
      (selectedTamano === "chico"
        ? (item.precioChico ?? item.basePrice)
        : (item.precioGrande ?? item.basePrice))
    : catalog?.getPlatilloPrecio(categoryId, item.id) ?? item.basePrice

  return (
    <>
      {agotado && (
        <p className="text-sm text-destructive font-medium mb-3">Agotado</p>
      )}
      <OrderItemExtrasPicker
        config={customizationConfig}
        extras={extras}
        customNote={customNote}
        onExtrasChange={setExtras}
        onCustomNoteChange={setCustomNote}
        className="mb-4"
      />
      {item.tieneTamanos ? (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Tamaño</p>
          <div className="grid grid-cols-2 gap-2">
            {(["chico", "grande"] as const).map((tam) => {
              const p =
                catalog?.getPlatilloPrecioTamano(categoryId, item.id, tam) ??
                (tam === "chico"
                  ? (item.precioChico ?? item.basePrice)
                  : (item.precioGrande ?? item.basePrice))
              const isSel = selectedTamano === tam
              return (
                <button
                  key={tam}
                  type="button"
                  onClick={() => setSelectedTamano(tam)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    isSel
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-primary/50",
                  )}
                >
                  {getPlatilloTamanoLabel(item, tam)}
                  <span className="block text-xs opacity-80">${p}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium shrink-0">Cantidad</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              disabled={qty <= 1 || agotado}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center tabular-nums font-medium">{qty}</span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              disabled={agotado}
              onClick={() => setQty((q) => q + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Button
          type="button"
          className="sm:ml-auto w-full sm:w-auto"
          disabled={agotado}
          onClick={() => {
            onAdd(
              item,
              categoryName,
              qty,
              categoryId,
              extras,
              customNote,
              item.tieneTamanos ? selectedTamano : undefined,
            )
            setQty(1)
            setSelectedTamano("chico")
            setExtras(defaultOrderExtras(customizationConfig))
            setCustomNote("")
          }}
        >
          Agregar al carrito{item.tieneTamanos ? ` · $${price.toFixed(0)}` : ""}
        </Button>
      </div>
    </>
  )
}

function OrdenarOpcionesPlatilloBlock({
  item,
  categoryId,
  categoryName,
  catalog,
  onAdd,
}: {
  item: OrdenarMenuItem
  categoryId: string
  categoryName: string
  catalog: MenuCatalogHelpers | null
  onAdd: (
    item: OrdenarMenuItem,
    categoria: string,
    qty: number,
    categoryId: string,
    extras: string[],
    customNote: string,
    tamano: BebidaTamano,
    opcionId: string,
  ) => void
}) {
  const [qty, setQty] = useState(1)
  const [selectedTamano, setSelectedTamano] = useState<BebidaTamano>("chico")
  const [selectedOpcion, setSelectedOpcion] = useState<string | null>(
    item.opciones?.[0]?.id ?? null,
  )
  const customizationConfig = useCustomizationConfig(categoryId, item.id)
  const [extras, setExtras] = useState<string[]>(() =>
    defaultOrderExtras(customizationConfig),
  )
  const [customNote, setCustomNote] = useState("")
  const agotado = catalog?.isPlatilloOut(categoryId, item.id) ?? false
  const price =
    catalog?.getPlatilloPrecioTamano(categoryId, item.id, selectedTamano) ??
    (selectedTamano === "chico"
      ? (item.precioChico ?? item.basePrice)
      : (item.precioGrande ?? item.basePrice))

  return (
    <>
      {agotado && (
        <p className="text-sm text-destructive font-medium mb-3">Agotado</p>
      )}
      <div className="mb-4">
        <p className="text-sm font-medium mb-2">Tamaño</p>
        <div className="grid grid-cols-2 gap-2">
          {(["chico", "grande"] as const).map((tam) => {
            const p =
              catalog?.getPlatilloPrecioTamano(categoryId, item.id, tam) ??
              (tam === "chico"
                ? (item.precioChico ?? item.basePrice)
                : (item.precioGrande ?? item.basePrice))
            const isSel = selectedTamano === tam
            return (
              <button
                key={tam}
                type="button"
                onClick={() => setSelectedTamano(tam)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  isSel
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:border-primary/50",
                )}
              >
                {getPlatilloTamanoLabel(item, tam)}
                <span className="block text-xs opacity-80">${p}</span>
              </button>
            )
          })}
        </div>
      </div>
      <p className="text-sm font-medium mb-2">Elige 1 fruta</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(item.opciones ?? []).map((opcion) => {
          const isSel = selectedOpcion === opcion.id
          return (
            <button
              key={opcion.id}
              type="button"
              onClick={() => setSelectedOpcion(opcion.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                isSel
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/50",
              )}
            >
              {opcion.label}
            </button>
          )
        })}
      </div>
      <OrderItemExtrasPicker
        config={customizationConfig}
        extras={extras}
        customNote={customNote}
        onExtrasChange={setExtras}
        onCustomNoteChange={setCustomNote}
        className="mb-4"
      />
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium shrink-0">Cantidad</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              disabled={qty <= 1 || agotado}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center tabular-nums font-medium">{qty}</span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              disabled={agotado}
              onClick={() => setQty((q) => q + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Button
          type="button"
          className="sm:ml-auto w-full sm:w-auto"
          disabled={agotado || !selectedOpcion}
          onClick={() => {
            if (!selectedOpcion) return
            onAdd(
              item,
              categoryName,
              qty,
              categoryId,
              extras,
              customNote,
              selectedTamano,
              selectedOpcion,
            )
            setQty(1)
            setSelectedTamano("chico")
            setSelectedOpcion(item.opciones?.[0]?.id ?? null)
            setExtras(defaultOrderExtras(customizationConfig))
            setCustomNote("")
          }}
        >
          Agregar al carrito · ${price.toFixed(0)}
        </Button>
      </div>
    </>
  )
}

function OrdenarProteinPlatilloBlock({
  item,
  category,
  catalog,
  linesForItem,
  selectedProtein,
  setSelectedProtein,
  pickerQty,
  setPickerQty,
  proteinaImgs,
  onAdd,
}: {
  item: OrdenarMenuItem
  category: { id: string; name: string }
  catalog: MenuCatalogHelpers | null
  linesForItem: CartItem[]
  selectedProtein: ProteinaPlatillo | null
  setSelectedProtein: (p: ProteinaPlatillo | null) => void
  pickerQty: number
  setPickerQty: Dispatch<SetStateAction<number>>
  proteinaImgs: Partial<Record<ProteinaPlatillo, string>>
  onAdd: (
    item: OrdenarMenuItem,
    categoria: string,
    protein: ProteinaPlatillo,
    qty: number,
    categoryId: string,
    extras: string[],
    customNote: string,
    tamano?: BebidaTamano,
  ) => void
}) {
  const customizationConfig = useCustomizationConfig(category.id, item.id)
  const customizationsCtx = useOrderCustomizationsContextOptional()
  const [selectedTamano, setSelectedTamano] = useState<BebidaTamano>("chico")
  const [extras, setExtras] = useState<string[]>(() =>
    defaultOrderExtras(customizationConfig),
  )
  const [customNote, setCustomNote] = useState("")

  const flags: PlatilloPickerFlags = {
    tieneProteinas: true,
    tieneTamanos: item.tieneTamanos === true,
    tieneOpciones: false,
  }

  const lineNotas = (line: CartItem) => {
    const cfg =
      customizationsCtx?.customizations?.getConfig(
        line.categoryId,
        line.menuItemId,
      ) ?? defaultPlatilloCustomizationConfig()
    return formatOrderItemNotas(line.extras, line.customNote, cfg)
  }

  return (
    <>
      {item.tieneTamanos ? (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Tamaño</p>
          <div className="grid grid-cols-2 gap-2">
            {(["chico", "grande"] as const).map((tam) => {
              const p =
                catalog?.getPlatilloPrecioTamano(category.id, item.id, tam) ??
                (tam === "chico"
                  ? (item.precioChico ?? item.basePrice)
                  : (item.precioGrande ?? item.basePrice))
              const isSel = selectedTamano === tam
              return (
                <button
                  key={tam}
                  type="button"
                  onClick={() => setSelectedTamano(tam)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    isSel
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-primary/50",
                  )}
                >
                  {getPlatilloTamanoLabel(item, tam)}
                  <span className="block text-xs opacity-80">${p}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      <p className="text-sm font-medium mb-2">Proteína</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {item.proteins
          .filter(
            (protein) =>
              !catalog?.isProteinaHidden(category.id, protein, item.id),
          )
          .map((protein) => {
            const isSel = selectedProtein === protein
            const agotada =
              catalog?.isProteinaOut(category.id, protein, item.id) ?? false
            const proteinPrice = catalog
              ? catalog.getPrecioConProteina(
                  category.id,
                  protein,
                  item.id,
                  item.tieneTamanos ? selectedTamano : undefined,
                )
              : item.basePrice +
                (protein === "Camarón" ? (item.shrimpExtra ?? 20) : 0)
            return (
              <button
                key={protein}
                type="button"
                disabled={agotada}
                onClick={() => {
                  if (agotada) return
                  setSelectedProtein(protein)
                  setPickerQty(1)
                }}
                className={cn(
                  "touch-manipulation flex flex-col rounded-lg border overflow-hidden transition-colors text-left",
                  agotada
                    ? "opacity-40 cursor-not-allowed border-border bg-muted"
                    : "cursor-pointer border-border bg-card hover:border-primary/60 hover:bg-accent/30",
                  isSel &&
                    !agotada &&
                    "border-primary ring-2 ring-primary/30 bg-accent/40",
                )}
              >
                <span className="relative aspect-[4/3] w-full bg-muted pointer-events-none">
                  <Image
                    src={proteinaImgs[protein] ?? "/placeholder.svg"}
                    alt=""
                    fill
                    className="object-cover pointer-events-none select-none"
                    sizes="(max-width: 640px) 45vw, 140px"
                    draggable={false}
                  />
                </span>
                <span className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-medium">
                  {protein}
                  {!agotada && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      ${proteinPrice}
                    </span>
                  )}
                  {agotada && (
                    <span className="block text-[10px] text-destructive">
                      Agotado
                    </span>
                  )}
                </span>
              </button>
            )
          })}
      </div>

      {linesForItem.length > 0 && (
        <div
          className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 space-y-2 mb-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />
            En tu carrito
          </p>
          <ul className="space-y-1.5">
            {linesForItem.map((line) => {
              const notas = lineNotas(line)
              return (
                <li
                  key={line.id}
                  className="flex justify-between gap-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">
                      {line.protein && !isProteinaRegular(line.protein)
                        ? `${line.name} de ${line.protein}`
                        : line.name}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      ×{line.quantity}
                    </span>
                    {notas ? (
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {notas}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    ${(line.price * line.quantity).toFixed(2)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <OrderItemExtrasPicker
        config={customizationConfig}
        extras={extras}
        customNote={customNote}
        onExtrasChange={setExtras}
        onCustomNoteChange={setCustomNote}
        className="mb-4"
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium shrink-0">Cantidad</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              disabled={pickerQty <= 1}
              onClick={() => setPickerQty((q) => Math.max(1, q - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center tabular-nums font-medium">
              {pickerQty}
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={() => setPickerQty((q) => q + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Button
          type="button"
          className="sm:ml-auto w-full sm:w-auto"
          disabled={
            !selectedProtein ||
            (catalog?.isProteinaOut(category.id, selectedProtein, item.id) ??
              false)
          }
          onClick={() => {
            if (!selectedProtein) return
            if (
              catalog?.isProteinaOut(category.id, selectedProtein, item.id)
            )
              return
            onAdd(
              item,
              category.name,
              selectedProtein,
              pickerQty,
              category.id,
              extras,
              customNote,
              item.tieneTamanos ? selectedTamano : undefined,
            )
            setPickerQty(1)
            setSelectedTamano("chico")
            setExtras(defaultOrderExtras(customizationConfig))
            setCustomNote("")
          }}
        >
          Agregar al carrito
        </Button>
      </div>
    </>
  )
}

export default function OrdenarPage() {
  const router = useRouter()
  const { addOrder } = useOrders()
  const { catalog } = useMenuCatalogContext()
  const { customizations } = useOrderCustomizationsContext()

  const cartItemNotasLabel = useCallback(
    (item: Pick<CartItem, "extras" | "customNote" | "categoryId" | "menuItemId">) => {
      const config =
        customizations?.getConfig(item.categoryId, item.menuItemId) ??
        defaultPlatilloCustomizationConfig()
      return formatOrderItemNotas(item.extras, item.customNote, config)
    },
    [customizations],
  )

  const resolveMenuItemName = useCallback(
    (categoryId: string, item: Pick<OrdenarMenuItem, "id" | "name">) =>
      catalog?.getPlatilloNombre(categoryId, item.id) ?? item.name,
    [catalog],
  )
  const proteinaImgs = useProteinaImagenes()
  const bebidaImgs = useBebidaImagenes()
  const categoriaImgs = useCategoriaImagenes()
  const [orderType, setOrderType] = useState<
    "dine-in" | "takeout" | "domicilio" | null
  >(null)
  const [tableNumber, setTableNumber] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [deliveryZoneId, setDeliveryZoneId] = useState("")
  const [deliveryZoneLabel, setDeliveryZoneLabel] = useState("")
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [deliveryPhotoStreetUrl, setDeliveryPhotoStreetUrl] = useState("")
  const [deliveryPhotoHouseUrl, setDeliveryPhotoHouseUrl] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  )
  const [selectedProtein, setSelectedProtein] =
    useState<ProteinaPlatillo | null>(null)
  const [pickerQty, setPickerQty] = useState(1)
  const [selectedBebidaId, setSelectedBebidaId] = useState<string | null>(null)
  const [selectedBebidaTamano, setSelectedBebidaTamano] =
    useState<BebidaTamano>("chico")
  const [bebidaPickerQty, setBebidaPickerQty] = useState(1)
  const [placeOrderLoading, setPlaceOrderLoading] = useState(false)
  const [placeOrderError, setPlaceOrderError] = useState("")
  const [orderingEnabled, setOrderingEnabled] = useState(true)
  const [orderingMessage, setOrderingMessage] = useState("")
  const expandPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/ordering-status")
        const data = (await res.json()) as { enabled?: boolean; message?: string }
        setOrderingEnabled(Boolean(data.enabled ?? true))
        setOrderingMessage(String(data.message ?? ""))
      } catch {
        setOrderingEnabled(true)
        setOrderingMessage("")
      }
    })()
  }, [])

  useEffect(() => {
    const type = sessionStorage.getItem("orderType") as
      | "dine-in"
      | "takeout"
      | "domicilio"
      | null
    const table = sessionStorage.getItem("tableNumber") || ""
    const name = sessionStorage.getItem("customerName") || ""
    const phone = sessionStorage.getItem("customerPhone") || ""

    if (!type) {
      router.push("/")
      return
    }

    setOrderType(type)
    setTableNumber(table)
    setCustomerName(name)
    setCustomerPhone(phone)
    if (type === "domicilio") {
      setDeliveryZoneId(sessionStorage.getItem("deliveryZoneId") || "")
      setDeliveryZoneLabel(sessionStorage.getItem("deliveryZoneLabel") || "")
      setDeliveryFee(Number(sessionStorage.getItem("deliveryFee") || "0"))
      setDeliveryAddress(sessionStorage.getItem("deliveryAddress") || "")
      setDeliveryPhotoStreetUrl(
        sessionStorage.getItem("deliveryPhotoStreetUrl") || "",
      )
      setDeliveryPhotoHouseUrl(
        sessionStorage.getItem("deliveryPhotoHouseUrl") || "",
      )
    }
  }, [router])

  useEffect(() => {
    setSelectedProtein(null)
    setPickerQty(1)
    setSelectedBebidaId(null)
    setSelectedBebidaTamano("chico")
    setBebidaPickerQty(1)
  }, [selectedCategoryId])

  useEffect(() => {
    if (
      (catalog?.isCategoriaOut(BEBIDAS_CATEGORIA_ID) ||
        catalog?.isCategoriaHidden(BEBIDAS_CATEGORIA_ID)) &&
      selectedCategoryId === BEBIDAS_CATEGORIA_ID
    ) {
      setSelectedCategoryId(null)
    }
  }, [catalog, selectedCategoryId])

  useEffect(() => {
    if (!selectedCategoryId) return
    const el = expandPanelRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }, [selectedCategoryId])

  const addToCart = useCallback(
    (
      item: OrdenarMenuItem,
      categoria: string,
      protein: ProteinaPlatillo | undefined,
      qty: number,
      categoryId: string,
      extras: string[] = [],
      customNote = "",
      tamano?: BebidaTamano,
      opcionId?: string,
    ) => {
      const config =
        customizations?.getConfig(categoryId, item.id) ??
        defaultPlatilloCustomizationConfig()
      const lineKey =
        item.opciones?.length && tamano && opcionId
          ? `${item.id}-${tamano}-${opcionId}`
          : item.tieneTamanos && tamano && protein
            ? `${item.id}-${tamano}-${protein}`
            : item.tieneTamanos && tamano
              ? `${item.id}-${tamano}`
              : `${item.id}-${protein || "none"}`
      const itemId = cartLineKey(lineKey, extras, customNote, config)
      setCart((prev) => {
        const existingItem = prev.find((i) => i.id === itemId)
        let price: number
        if (catalog && protein) {
          price = catalog.getPrecioConProteina(
            categoryId,
            protein,
            item.id,
            tamano,
          )
        } else if (catalog && item.tieneTamanos && tamano) {
          price = catalog.getPlatilloPrecioTamano(categoryId, item.id, tamano)
        } else if (catalog && !item.tieneProteinas) {
          price = catalog.getPlatilloPrecio(categoryId, item.id)
        } else if (catalog) {
          price = catalog.getCategoriaPrecioBase(categoryId)
        } else {
          price = item.basePrice
          if (protein === "Camarón" && item.shrimpExtra) {
            price += item.shrimpExtra
          }
        }
        const flags: PlatilloPickerFlags = {
          tieneProteinas: item.tieneProteinas,
          tieneTamanos: item.tieneTamanos === true,
          tieneOpciones: (item.opciones?.length ?? 0) > 0,
        }
        const displayName = platilloLineNombre(
          resolveMenuItemName(categoryId, item),
          flags,
          tamano,
          protein,
          {
            tamanoLabelChico: item.tamanoLabelChico,
            tamanoLabelGrande: item.tamanoLabelGrande,
            opciones: item.opciones,
          },
          opcionId,
        )
        if (existingItem) {
          return prev.map((i) =>
            i.id === itemId ? { ...i, quantity: i.quantity + qty } : i,
          )
        }
        return [
          ...prev,
          {
            id: itemId,
            name: displayName,
            categoria,
            protein,
            price,
            quantity: qty,
            extras: [...extras],
            customNote,
            categoryId,
            menuItemId: item.id,
          },
        ]
      })
    },
    [catalog, customizations, resolveMenuItemName],
  )

  const addBebidaToCart = useCallback(
    (bebida: BebidaOrdenar, tamano: BebidaTamano, qty = 1) => {
      const itemId = `bebida-${bebida.id}-${tamano}`
      const unitPrice = catalog
        ? catalog.getBebidaPrecio(bebida.id, tamano)
        : tamano === "chico"
          ? bebida.priceChico
          : bebida.priceGrande
      const displayName = `${bebida.name} (${bebidaTamanoLabels[tamano]})`
      setCart((prev) => {
        const existingItem = prev.find((i) => i.id === itemId)
        if (existingItem) {
          return prev.map((i) =>
            i.id === itemId ? { ...i, quantity: i.quantity + qty } : i,
          )
        }
        return [
          ...prev,
          {
            id: itemId,
            name: displayName,
            categoria: "Bebidas",
            price: unitPrice,
            quantity: qty,
            extras: [],
            customNote: "",
            categoryId: BEBIDAS_CATEGORIA_ID,
            menuItemId: bebida.id,
          },
        ]
      })
    },
    [catalog],
  )

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const newQuantity = item.quantity + delta
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : item
          }
          return item
        })
        .filter((item) => item.quantity > 0),
    )
  }

  const removeItem = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId))
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const deliveryCharge = orderType === "domicilio" ? deliveryFee : 0
  const total = subtotal + deliveryCharge
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartBebidasLines = cart.filter((c) => c.categoria === "Bebidas")

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || !orderType) return
    if (!orderingEnabled) {
      setPlaceOrderError(
        orderingMessage?.trim() ||
          "En este momento no estamos aceptando pedidos en línea. Intenta más tarde.",
      )
      return
    }

    setPlaceOrderError("")

    const orderItems: OrderItem[] = cart.map((item) => ({
      id: `${item.id}-line`,
      categoria: item.categoria,
      nombre: item.protein ? `${item.name} de ${item.protein}` : item.name,
      proteina: item.protein,
      cantidad: item.quantity,
      precio: item.price,
      notas: cartItemNotasLabel(item),
    }))

    const newOrder = addOrder({
      items: orderItems,
      nombreCliente: customerName || undefined,
      mesa: orderType === "dine-in" ? tableNumber : undefined,
      tipo:
        orderType === "dine-in"
          ? "mesa"
          : orderType === "domicilio"
            ? "domicilio"
            : "pickup",
      status: "pendiente",
      total,
      deliveryZoneId: orderType === "domicilio" ? deliveryZoneId : undefined,
      deliveryZoneLabel:
        orderType === "domicilio" ? deliveryZoneLabel : undefined,
      deliveryFee: orderType === "domicilio" ? deliveryCharge : undefined,
      deliveryAddress:
        orderType === "domicilio" ? deliveryAddress : undefined,
      deliveryPhotoStreetUrl:
        orderType === "domicilio" ? deliveryPhotoStreetUrl : undefined,
      deliveryPhotoHouseUrl:
        orderType === "domicilio" ? deliveryPhotoHouseUrl : undefined,
    })

    sessionStorage.removeItem("orderType")
    sessionStorage.removeItem("tableNumber")
    sessionStorage.removeItem("customerName")
    sessionStorage.removeItem("customerPhone")
    sessionStorage.removeItem("deliveryZoneId")
    sessionStorage.removeItem("deliveryZoneLabel")
    sessionStorage.removeItem("deliveryFee")
    sessionStorage.removeItem("deliveryAddress")
    sessionStorage.removeItem("deliveryPhotoStreetUrl")
    sessionStorage.removeItem("deliveryPhotoHouseUrl")

    const inserted = await insertAvosOrderToSupabase(newOrder)
    if (!inserted) {
      setPlaceOrderError(
        orderingMessage?.trim() ||
          "En este momento no estamos aceptando pedidos en línea. Intenta más tarde.",
      )
      return
    }

    if (orderType === "takeout" || orderType === "domicilio") {
      setPlaceOrderLoading(true)
      try {
        logCheckoutClient("ordenar:takeout:checkout_order", {
          orderIdPrefix: newOrder.id.slice(0, 8),
          numero: newOrder.numero,
          total: newOrder.total,
          lines: newOrder.items.map((i) => ({
            nombre: i.nombre?.slice(0, 60),
            cantidad: i.cantidad,
            precio: i.precio,
          })),
        })
        const res = await fetch("/api/checkout/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: newOrder.id }),
        })
        const data = (await res.json()) as { url?: string; error?: string }
        logCheckoutClient("ordenar:takeout:api_response", {
          ok: res.ok,
          status: res.status,
          hasUrl: Boolean(data.url),
          error: data.error ?? null,
        })
        if (!res.ok || !data.url) {
          setPlaceOrderError(data.error ?? "No se pudo iniciar el pago.")
          setPlaceOrderLoading(false)
          return
        }
        window.location.href = data.url
      } catch {
        setPlaceOrderError("Error de red. Intenta de nuevo.")
        setPlaceOrderLoading(false)
      }
      return
    }

    router.push(`/orden/${newOrder.numero}`)
  }

  const selectedBebida = selectedBebidaId
    ? bebidasOrdenar.find((b) => b.id === selectedBebidaId)
    : undefined

  const thumbBebidas =
    categoriaImgs[BEBIDAS_CATEGORIA_ID] ?? imagenCategoriaBebidas

  const visibleMenuCategories = menuCategories.filter(
    (c) =>
      !catalog?.isCategoriaOut(c.id) && !catalog?.isCategoriaHidden(c.id),
  )
  const selectedFoodCategory = selectedCategoryId
    ? visibleMenuCategories.find((c) => c.id === selectedCategoryId)
    : undefined
  const showBebidasTab =
    !catalog?.isCategoriaHidden(BEBIDAS_CATEGORIA_ID) &&
    !catalog?.isCategoriaOut(BEBIDAS_CATEGORIA_ID)

  if (!orderType) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6">
        {!orderingEnabled ? (
          <div className="mb-4">
            <Alert variant="destructive">
              <AlertTitle>Pedidos en pausa</AlertTitle>
              <AlertDescription>
                {orderingMessage?.trim() ||
                  "En este momento no estamos aceptando pedidos en línea. Intenta más tarde."}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={
              orderType === "dine-in"
                ? "/comer-aqui"
                : orderType === "domicilio"
                  ? "/domicilio"
                  : "/para-llevar"
            }
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>

          <div className="flex items-center gap-2">
            {orderType === "dine-in" ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Utensils className="h-3 w-3" />
                Mesa {tableNumber}
              </Badge>
            ) : orderType === "domicilio" ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Truck className="h-3 w-3" />
                {deliveryZoneLabel || "Domicilio"}
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" />
                Para Llevar
              </Badge>
            )}
            {customerName && (
              <Badge variant="outline">{customerName}</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
          <div className="lg:col-span-2 space-y-8 min-w-0 relative z-10">
            <div>
              <h1
                className="text-2xl md:text-3xl font-bold mb-2"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Menú
              </h1>
              <p className="text-muted-foreground text-sm md:text-base max-w-2xl">
                Toca una categoría: se abre aquí mismo para elegir proteína y
                cantidad. Vuelve a tocar la misma para cerrar.
              </p>
              {(orderType === "takeout" || orderType === "domicilio") && (
                <p className="mt-3 text-sm font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 rounded-lg px-3 py-2 max-w-2xl">
                  {orderType === "domicilio"
                    ? "Domicilio: paga en línea para confirmar. Incluye envío a tu zona."
                    : "Para llevar: debes pagar en línea para confirmar el pedido (no efectivo al recoger)."}
                </p>
              )}
              {orderType === "dine-in" && (
                <p className="mt-3 text-sm text-muted-foreground border border-border rounded-lg px-3 py-2 max-w-2xl bg-muted/30">
                  Para aquí: puedes pagar en línea o indicar pago en caja (un toque; caja registra el cobro).
                </p>
              )}
            </div>

            <section className="rounded-2xl bg-secondary/30 p-4 md:p-6 space-y-4">
              <div
                data-menu-category-tabs
                className="flex flex-nowrap gap-2 overflow-x-auto pb-1 -mx-1 px-1 scroll-smooth [scrollbar-width:thin]"
                role="tablist"
                aria-label="Categorías del menú"
              >
                {visibleMenuCategories.map((category) => {
                  const active = selectedCategoryId === category.id
                  return (
                    <button
                      key={category.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() =>
                        setSelectedCategoryId((prev) =>
                          prev === category.id ? null : category.id,
                        )
                      }
                      className={menuCategoryTabButtonClass(active)}
                    >
                      <span className="text-lg leading-none" aria-hidden>
                        {categoriaEmoji[category.id] ?? "🍴"}
                      </span>
                      <span className="whitespace-nowrap">{category.name}</span>
                    </button>
                  )
                })}
                {showBebidasTab ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedCategoryId === BEBIDAS_CATEGORIA_ID}
                    onClick={() =>
                      setSelectedCategoryId((prev) =>
                        prev === BEBIDAS_CATEGORIA_ID
                          ? null
                          : BEBIDAS_CATEGORIA_ID,
                      )
                    }
                    className={menuCategoryTabButtonClass(
                      selectedCategoryId === BEBIDAS_CATEGORIA_ID,
                    )}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {categoriaEmoji.bebidas}
                    </span>
                    <span className="whitespace-nowrap">Bebidas</span>
                  </button>
                ) : null}
              </div>

              {selectedFoodCategory ? (
                <div
                  key={selectedFoodCategory.id}
                  ref={expandPanelRef}
                  className="rounded-xl border border-border bg-card text-card-foreground shadow-sm animate-in fade-in-0 slide-in-from-top-2 duration-200"
                >
                  {(() => {
                    const category = selectedFoodCategory
                    const displayBase = catalog
                      ? catalog.getCategoriaPrecioBase(category.id)
                      : category.items[0]?.basePrice ?? 0
                    const displayShrimp =
                      catalog?.getCamarónExtra() ??
                      category.items[0]?.shrimpExtra ??
                      20
                    return (
                      <>
                  <div className="bg-secondary/40 border-b border-border px-4 py-3 rounded-t-xl">
                    <h3 className="font-semibold">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                  <div className="p-4 space-y-4">
                    {category.items
                      .filter(
                        (item) =>
                          !catalog?.isPlatilloHidden(category.id, item.id),
                      )
                      .map((item) => {
                      const linesForItem = cart.filter(
                        (c) =>
                          c.categoria === category.name &&
                          c.id.startsWith(`${item.id}-`),
                      )
                      const catDef = categorias.find((x) => x.id === category.id)
                      const platDef = catDef
                        ? getPlatillosForCategoria(catDef).find(
                            (x) => x.id === item.id,
                          )
                        : undefined
                      const itemFlags =
                        platDef && catDef
                          ? platilloPickerFlags(platDef, catDef)
                          : {
                              tieneProteinas: item.tieneProteinas,
                              tieneTamanos: item.tieneTamanos === true,
                              tieneOpciones: (item.opciones?.length ?? 0) > 0,
                            }
                      const fixedPrice = catalog
                        ? catalog.getPlatilloPrecio(category.id, item.id)
                        : item.basePrice
                      return (
                      <div key={item.id}>
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <h4 className="font-semibold">
                                      {resolveMenuItemName(category.id, item)}
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      {item.tieneProteinas
                                        ? catalog
                                          ? "Precio según proteína"
                                          : `$${displayBase} MXN${
                                              item.shrimpExtra != null
                                                ? ` (Camarón +$${displayShrimp})`
                                                : ""
                                            }`
                                        : item.tieneTamanos
                                          ? (() => {
                                              const cat = categorias.find(
                                                (x) => x.id === category.id,
                                              )
                                              const plat = cat
                                                ? getPlatillosForCategoria(cat).find(
                                                    (x) => x.id === item.id,
                                                  )
                                                : undefined
                                              const chico =
                                                plat?.tamanoLabelChico ??
                                                "Chico"
                                              const grande =
                                                plat?.tamanoLabelGrande ??
                                                "Grande"
                                              const pChico =
                                                catalog?.getPlatilloPrecioTamano(
                                                  category.id,
                                                  item.id,
                                                  "chico",
                                                ) ??
                                                item.precioChico ??
                                                item.basePrice
                                              const pGrande =
                                                catalog?.getPlatilloPrecioTamano(
                                                  category.id,
                                                  item.id,
                                                  "grande",
                                                ) ??
                                                item.precioGrande ??
                                                item.basePrice
                                              return `${chico} $${pChico} · ${grande} $${pGrande} MXN`
                                            })()
                                          : `$${fixedPrice} MXN`}
                                    </p>
                                  </div>
                                </div>

                                {!itemFlags.tieneProteinas ? (
                                  <>
                                    {linesForItem.length > 0 && (
                                      <div
                                        className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 space-y-2 mb-4"
                                        role="status"
                                        aria-live="polite"
                                      >
                                        <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                                          <ShoppingCart className="h-3.5 w-3.5" />
                                          En tu carrito
                                        </p>
                                        <ul className="space-y-1.5">
                                          {linesForItem.map((line) => {
                                            const notas = cartItemNotasLabel(line)
                                            return (
                                            <li
                                              key={line.id}
                                              className="flex justify-between gap-2 text-sm"
                                            >
                                              <span className="min-w-0">
                                                <span className="font-medium">
                                                  {line.name}
                                                </span>
                                                <span className="text-muted-foreground">
                                                  {" "}
                                                  ×{line.quantity}
                                                </span>
                                                {notas ? (
                                                  <span className="block text-xs text-muted-foreground mt-0.5">
                                                    {notas}
                                                  </span>
                                                ) : null}
                                              </span>
                                              <span className="text-muted-foreground tabular-nums shrink-0">
                                                $
                                                {(
                                                  line.price * line.quantity
                                                ).toFixed(2)}
                                              </span>
                                            </li>
                                            )
                                          })}
                                        </ul>
                                      </div>
                                    )}
                                    {itemFlags.tieneOpciones ? (
                                      <OrdenarOpcionesPlatilloBlock
                                        item={item}
                                        categoryId={category.id}
                                        categoryName={category.name}
                                        catalog={catalog}
                                        onAdd={(
                                          it,
                                          cat,
                                          qty,
                                          catId,
                                          extras,
                                          note,
                                          tam,
                                          opcion,
                                        ) =>
                                          addToCart(
                                            it,
                                            cat,
                                            undefined,
                                            qty,
                                            catId,
                                            extras,
                                            note,
                                            tam,
                                            opcion,
                                          )
                                        }
                                      />
                                    ) : (
                                    <OrdenarFixedPlatilloRow
                                      item={item}
                                      categoryId={category.id}
                                      categoryName={category.name}
                                      catalog={catalog}
                                      onAdd={(it, cat, qty, catId, extras, note, tam) =>
                                        addToCart(
                                          it,
                                          cat,
                                          undefined,
                                          qty,
                                          catId,
                                          extras,
                                          note,
                                          tam,
                                        )
                                      }
                                    />
                                    )}
                                  </>
                                ) : (
                                  <OrdenarProteinPlatilloBlock
                                    item={item}
                                    category={category}
                                    catalog={catalog}
                                    linesForItem={linesForItem}
                                    selectedProtein={selectedProtein}
                                    setSelectedProtein={setSelectedProtein}
                                    pickerQty={pickerQty}
                                    setPickerQty={setPickerQty}
                                    proteinaImgs={proteinaImgs}
                                    onAdd={addToCart}
                                  />
                                )}
                              </div>
                            )
                            })}
                          </div>
                      </>
                    )
                  })()}
                </div>
              ) : null}

              {selectedCategoryId === BEBIDAS_CATEGORIA_ID && showBebidasTab ? (
                    <div
                      ref={expandPanelRef}
                      className="rounded-xl border border-border bg-card text-card-foreground shadow-sm animate-in fade-in-0 slide-in-from-top-2 duration-200"
                    >
                      <div className="bg-secondary/40 border-b border-border px-4 py-3 rounded-t-xl">
                        <h3 className="font-semibold">Aguas Frescas</h3>
                        <p className="text-sm text-muted-foreground">
                          Bebidas naturales y refrescantes
                        </p>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {bebidasOrdenar
                            .filter(
                              (bebida) => !catalog?.isBebidaHidden(bebida.id),
                            )
                            .map((bebida) => {
                            const active = selectedBebidaId === bebida.id
                            const agotada =
                              catalog?.isBebidaOut(bebida.id) ?? false
                            const precioChico = catalog
                              ? catalog.getBebidaPrecio(bebida.id, "chico")
                              : bebida.priceChico
                            const precioGrande = catalog
                              ? catalog.getBebidaPrecio(bebida.id, "grande")
                              : bebida.priceGrande
                            return (
                              <button
                                key={bebida.id}
                                type="button"
                                disabled={agotada}
                                onClick={() => {
                                  if (agotada) return
                                  setSelectedBebidaId(bebida.id)
                                  setSelectedBebidaTamano("chico")
                                  setBebidaPickerQty(1)
                                }}
                                className={cn(
                                  "rounded-xl border p-4 text-left transition-colors touch-manipulation flex gap-3 items-start",
                                  agotada
                                    ? "opacity-50 cursor-not-allowed border-border bg-muted"
                                    : "cursor-pointer border-border bg-muted/30 hover:border-primary/50",
                                  active &&
                                    !agotada &&
                                    "border-primary ring-2 ring-primary/30 bg-accent/40",
                                )}
                              >
                                <BebidaThumb
                                  src={bebidaImgs[bebida.id]}
                                  alt={bebida.name}
                                />
                                <div className="min-w-0 flex-1">
                                <h4 className="font-semibold">{bebida.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  Chico ${precioChico} · Grande ${precioGrande}
                                  {agotada && (
                                    <span className="block text-xs text-destructive">
                                      Agotado
                                    </span>
                                  )}
                                </p>
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {cartBebidasLines.length > 0 && (
                          <div
                            className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 space-y-2"
                            role="status"
                            aria-live="polite"
                          >
                            <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                              <ShoppingCart className="h-3.5 w-3.5" />
                              En tu carrito
                            </p>
                            <ul className="space-y-1.5">
                              {cartBebidasLines.map((line) => (
                                <li
                                  key={line.id}
                                  className="flex justify-between gap-2 text-sm"
                                >
                                  <span className="min-w-0">
                                    <span className="font-medium">
                                      {line.name}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {" "}
                                      ×{line.quantity}
                                    </span>
                                  </span>
                                  <span className="text-muted-foreground tabular-nums shrink-0">
                                    $
                                    {(line.price * line.quantity).toFixed(2)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {selectedBebida && (
                          <div className="space-y-4 pt-2 border-t border-border">
                            <div>
                              <p className="text-sm font-medium mb-2">Tamaño</p>
                              <div className="grid grid-cols-2 gap-2 max-w-xs">
                                {(["chico", "grande"] as const).map((tam) => {
                                  const p = catalog
                                    ? catalog.getBebidaPrecio(
                                        selectedBebida.id,
                                        tam,
                                      )
                                    : tam === "chico"
                                      ? selectedBebida.priceChico
                                      : selectedBebida.priceGrande
                                  return (
                                    <button
                                      key={tam}
                                      type="button"
                                      onClick={() =>
                                        setSelectedBebidaTamano(tam)
                                      }
                                      className={cn(
                                        "rounded-lg border px-3 py-2 text-sm transition-colors",
                                        selectedBebidaTamano === tam
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border bg-card hover:border-primary/50",
                                      )}
                                    >
                                      <span className="block font-medium">
                                        {bebidaTamanoLabels[tam]}
                                      </span>
                                      <span className="block text-xs opacity-90">
                                        ${p}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium shrink-0">
                                Cantidad
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="h-9 w-9"
                                  disabled={bebidaPickerQty <= 1}
                                  onClick={() =>
                                    setBebidaPickerQty((q) =>
                                      Math.max(1, q - 1),
                                    )
                                  }
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center tabular-nums font-medium">
                                  {bebidaPickerQty}
                                </span>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="h-9 w-9"
                                  onClick={() =>
                                    setBebidaPickerQty((q) => q + 1)
                                  }
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <Button
                              type="button"
                              className="sm:ml-auto w-full sm:w-auto"
                              disabled={
                                !selectedBebida ||
                                (catalog?.isBebidaOut(selectedBebida.id) ??
                                  false)
                              }
                              onClick={() => {
                                if (
                                  !selectedBebida ||
                                  catalog?.isBebidaOut(selectedBebida.id)
                                )
                                  return
                                addBebidaToCart(
                                  selectedBebida,
                                  selectedBebidaTamano,
                                  bebidaPickerQty,
                                )
                              }}
                            >
                              Agregar al carrito
                            </Button>
                          </div>
                          </div>
                        )}
                      </div>
                    </div>
              ) : null}

              {!selectedCategoryId && (
                <p className="text-center text-muted-foreground pt-4 text-sm">
                  Toca una categoría para abrir las opciones aquí.
                </p>
              )}
            </section>
          </div>

          <div className="lg:col-span-1 min-w-0">
            <div className="sticky top-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Tu Orden</h2>
                    {itemCount > 0 && (
                      <Badge className="ml-auto">{itemCount}</Badge>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8">
                      Tu carrito está vacío
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {cart.map((item) => {
                          const notas = cartItemNotasLabel(item)
                          return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-2 border-b border-border last:border-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {item.protein
                                  ? `${item.name} de ${item.protein}`
                                  : item.name}
                              </p>
                              {notas ? (
                                <p className="text-xs text-primary/90 mt-0.5 line-clamp-2">
                                  {notas}
                                </p>
                              ) : null}
                              <p className="text-xs text-muted-foreground">
                                ${item.price} c/u
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-sm">
                                {item.quantity}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          )
                        })}
                      </div>

                      <div className="border-t border-border mt-4 pt-4 space-y-2">
                        {orderType === "domicilio" && deliveryCharge > 0 ? (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span>${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Envío ({deliveryZoneLabel})
                              </span>
                              <span>${deliveryCharge.toFixed(2)}</span>
                            </div>
                          </>
                        ) : null}
                        <div className="flex justify-between items-center mb-4 pt-1">
                          <span className="font-semibold">Total</span>
                          <span className="text-xl font-bold text-primary">
                            ${total.toFixed(2)} MXN
                          </span>
                        </div>

                        {placeOrderError ? (
                          <p className="text-sm text-destructive mb-2" role="alert">
                            {placeOrderError}
                          </p>
                        ) : null}
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={() => void handlePlaceOrder()}
                          disabled={placeOrderLoading || !orderingEnabled}
                        >
                          {placeOrderLoading
                            ? "Abriendo pago…"
                            : orderType === "takeout" || orderType === "domicilio"
                              ? "Pagar y confirmar pedido"
                              : "Hacer pedido"}
                        </Button>
                        {(orderType === "takeout" || orderType === "domicilio") &&
                          !placeOrderLoading && (
                          <p className="text-xs text-muted-foreground text-center mt-2">
                            {orderType === "domicilio"
                              ? "Domicilio: el pedido se confirma al pagar; te llevamos a tu dirección."
                              : "Para llevar: el pedido se confirma al completar el pago con tarjeta."}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
