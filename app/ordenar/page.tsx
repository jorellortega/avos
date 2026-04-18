"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
} from "lucide-react"
import {
  BEBIDAS_CATEGORIA_ID,
  bebidasOrdenar,
  categorias,
  imagenCategoriaBebidas,
  menuCategories,
  type BebidaOrdenar,
  type OrdenarMenuItem,
  type Proteina,
} from "@/lib/menu-data"
import { useProteinaImagenes } from "@/lib/use-proteina-imagenes"
import { useCategoriaImagenes } from "@/lib/use-categoria-imagenes"
import { useOrders, type OrderItem } from "@/components/orders-provider"
import { useMenuCatalogContext } from "@/components/menu-catalog-provider"
import { insertAvosOrderToSupabase } from "@/lib/avos-orders-sync"
import { cn } from "@/lib/utils"

interface CartItem {
  id: string
  name: string
  categoria: string
  protein?: Proteina
  price: number
  quantity: number
}

const categoriaEmoji: Record<string, string> = {
  tacos: "🌮",
  tortas: "🥪",
  burritos: "🌯",
  quesadillas: "🧀",
  platillos: "🍽️",
  bebidas: "🥤",
}

export default function OrdenarPage() {
  const router = useRouter()
  const { addOrder } = useOrders()
  const { catalog } = useMenuCatalogContext()
  const proteinaImgs = useProteinaImagenes()
  const categoriaImgs = useCategoriaImagenes()
  const [orderType, setOrderType] = useState<"dine-in" | "takeout" | null>(null)
  const [tableNumber, setTableNumber] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  )
  const [selectedProtein, setSelectedProtein] = useState<Proteina | null>(null)
  const [pickerQty, setPickerQty] = useState(1)
  const [selectedBebidaId, setSelectedBebidaId] = useState<string | null>(null)
  const [bebidaPickerQty, setBebidaPickerQty] = useState(1)
  const [placeOrderLoading, setPlaceOrderLoading] = useState(false)
  const [placeOrderError, setPlaceOrderError] = useState("")
  const expandPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const type = sessionStorage.getItem("orderType") as "dine-in" | "takeout" | null
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
  }, [router])

  useEffect(() => {
    setSelectedProtein(null)
    setPickerQty(1)
    setSelectedBebidaId(null)
    setBebidaPickerQty(1)
  }, [selectedCategoryId])

  useEffect(() => {
    if (
      catalog?.isCategoriaOut(BEBIDAS_CATEGORIA_ID) &&
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
      protein: Proteina | undefined,
      qty: number,
      categoryId: string,
    ) => {
      const itemId = `${item.name}-${protein || "none"}`
      setCart((prev) => {
        const existingItem = prev.find((i) => i.id === itemId)
        let price: number
        if (catalog) {
          const base = catalog.getCategoriaPrecioBase(categoryId)
          const extra = catalog.getCamarónExtra()
          price = base
          if (protein === "Camarón") price += extra
        } else {
          price = item.basePrice
          if (protein === "Camarón" && item.shrimpExtra) {
            price += item.shrimpExtra
          }
        }
        if (existingItem) {
          return prev.map((i) =>
            i.id === itemId ? { ...i, quantity: i.quantity + qty } : i,
          )
        }
        return [
          ...prev,
          {
            id: itemId,
            name: item.name,
            categoria,
            protein,
            price,
            quantity: qty,
          },
        ]
      })
    },
    [catalog],
  )

  const addBebidaToCart = useCallback(
    (bebida: BebidaOrdenar, qty = 1) => {
      const itemId = `bebida-${bebida.name}`
      const unitPrice = catalog
        ? catalog.getBebidaPrecio(bebida.id)
        : bebida.price
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
            name: bebida.name,
            categoria: "Bebidas",
            price: unitPrice,
            quantity: qty,
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

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || !orderType) return

    setPlaceOrderError("")

    const orderItems: OrderItem[] = cart.map((item) => ({
      id: `${item.id}-line`,
      categoria: item.categoria,
      nombre: item.protein ? `${item.name} de ${item.protein}` : item.name,
      proteina: item.protein,
      cantidad: item.quantity,
      precio: item.price,
    }))

    const newOrder = addOrder({
      items: orderItems,
      nombreCliente: customerName || undefined,
      mesa: orderType === "dine-in" ? tableNumber : undefined,
      tipo: orderType === "dine-in" ? "mesa" : "pickup",
      status: "pendiente",
      total,
    })

    sessionStorage.removeItem("orderType")
    sessionStorage.removeItem("tableNumber")
    sessionStorage.removeItem("customerName")
    sessionStorage.removeItem("customerPhone")

    const inserted = await insertAvosOrderToSupabase(newOrder)
    if (!inserted) {
      setPlaceOrderError("No se pudo registrar el pedido. Intenta de nuevo.")
      return
    }

    if (orderType === "takeout") {
      setPlaceOrderLoading(true)
      try {
        const res = await fetch("/api/checkout/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: newOrder.id }),
        })
        const data = (await res.json()) as { url?: string; error?: string }
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
        <div className="flex items-center justify-between mb-6">
          <Link
            href={orderType === "dine-in" ? "/comer-aqui" : "/para-llevar"}
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
              {orderType !== "dine-in" && (
                <p className="mt-3 text-sm font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 rounded-lg px-3 py-2 max-w-2xl">
                  Para llevar: pago con tarjeta al recoger (no efectivo).
                </p>
              )}
            </div>

            <section className="rounded-2xl bg-secondary/30 p-4 md:p-6">
              <h2
                className="text-lg font-semibold text-center mb-4 md:mb-6"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Categorías
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
                {menuCategories
                  .filter((c) => !catalog?.isCategoriaOut(c.id))
                  .map((category) => {
                  const catMeta = categorias.find((c) => c.id === category.id)
                  const thumb =
                    categoriaImgs[category.id] ?? catMeta?.imagen ?? ""
                  const active = selectedCategoryId === category.id
                  const displayBase = catalog
                    ? catalog.getCategoriaPrecioBase(category.id)
                    : category.items[0]?.basePrice ?? 0
                  const displayShrimp =
                    catalog?.getCamarónExtra() ??
                    category.items[0]?.shrimpExtra ??
                    20
                  return (
                    <div key={category.id} className="contents">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCategoryId((prev) =>
                            prev === category.id ? null : category.id,
                          )
                        }
                        className={cn(
                          "cursor-pointer bg-card rounded-2xl p-4 md:p-6 text-center shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 overflow-hidden touch-manipulation",
                          active
                            ? "ring-2 ring-primary shadow-md"
                            : "hover:shadow-md",
                        )}
                      >
                        <div className="relative aspect-[4/3] w-full max-w-[140px] mx-auto mb-3 rounded-xl overflow-hidden bg-muted pointer-events-none">
                          {thumb ? (
                            <Image
                              src={thumb}
                              alt=""
                              fill
                              className="object-cover pointer-events-none select-none"
                              sizes="(max-width: 768px) 40vw, 140px"
                              draggable={false}
                            />
                          ) : null}
                        </div>
                        <div className="text-3xl mb-2" aria-hidden>
                          {categoriaEmoji[category.id] ?? "🍴"}
                        </div>
                        <h3 className="font-semibold text-foreground text-sm md:text-base">
                          {category.name}
                        </h3>
                      </button>

                      {active && (
                        <div
                          ref={expandPanelRef}
                          className="col-span-2 sm:col-span-3 rounded-xl border border-border bg-card text-card-foreground shadow-sm animate-in fade-in-0 slide-in-from-top-2 duration-200"
                        >
                          <div className="bg-secondary/40 border-b border-border px-4 py-3 rounded-t-xl">
                            <h3 className="font-semibold">{category.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {category.description}
                            </p>
                          </div>
                          <div className="p-4 space-y-4">
                            {category.items.map((item) => (
                              <div key={item.name}>
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <h4 className="font-semibold">
                                      {item.name}
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      ${displayBase} MXN
                                      {item.shrimpExtra != null && (
                                        <span className="text-xs ml-2">
                                          (Camarón +${displayShrimp})
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <p className="text-sm font-medium mb-2">
                                  Proteína
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                                  {item.proteins.map((protein) => {
                                    const isSel = selectedProtein === protein
                                    const agotada =
                                      catalog?.isProteinaOut(protein) ?? false
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
                                            src={proteinaImgs[protein]}
                                            alt=""
                                            fill
                                            className="object-cover pointer-events-none select-none"
                                            sizes="(max-width: 640px) 45vw, 140px"
                                            draggable={false}
                                          />
                                        </span>
                                        <span className="flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium">
                                          {protein}
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

                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-3 border-t border-border">
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
                                        disabled={pickerQty <= 1}
                                        onClick={() =>
                                          setPickerQty((q) =>
                                            Math.max(1, q - 1),
                                          )
                                        }
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
                                        onClick={() =>
                                          setPickerQty((q) => q + 1)
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
                                      !selectedProtein ||
                                      (catalog?.isProteinaOut(selectedProtein) ??
                                        false)
                                    }
                                    onClick={() => {
                                      if (!selectedProtein) return
                                      if (catalog?.isProteinaOut(selectedProtein))
                                        return
                                      addToCart(
                                        item,
                                        category.name,
                                        selectedProtein,
                                        pickerQty,
                                        category.id,
                                      )
                                      setPickerQty(1)
                                    }}
                                  >
                                    Agregar al carrito
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                <div className="contents">
                  {catalog?.isCategoriaOut(BEBIDAS_CATEGORIA_ID) ? (
                    <div className="rounded-2xl p-4 md:p-6 text-center border border-dashed border-border bg-muted/30 opacity-80">
                      <div className="text-3xl mb-2" aria-hidden>
                        {categoriaEmoji.bebidas}
                      </div>
                      <h3 className="font-semibold text-foreground text-sm md:text-base">
                        Bebidas
                      </h3>
                      <p className="text-xs text-destructive font-medium mt-2">
                        Agotado
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCategoryId((prev) =>
                          prev === BEBIDAS_CATEGORIA_ID
                            ? null
                            : BEBIDAS_CATEGORIA_ID,
                        )
                      }
                      className={cn(
                        "cursor-pointer bg-card rounded-2xl p-4 md:p-6 text-center shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 overflow-hidden touch-manipulation",
                        selectedCategoryId === BEBIDAS_CATEGORIA_ID
                          ? "ring-2 ring-primary shadow-md"
                          : "hover:shadow-md",
                      )}
                    >
                      <div className="relative aspect-[4/3] w-full max-w-[140px] mx-auto mb-3 rounded-xl overflow-hidden bg-muted pointer-events-none">
                        {thumbBebidas ? (
                          <Image
                            src={thumbBebidas}
                            alt=""
                            fill
                            className="object-cover pointer-events-none select-none"
                            sizes="(max-width: 768px) 40vw, 140px"
                            draggable={false}
                          />
                        ) : null}
                      </div>
                      <div className="text-3xl mb-2" aria-hidden>
                        {categoriaEmoji.bebidas}
                      </div>
                      <h3 className="font-semibold text-foreground text-sm md:text-base">
                        Bebidas
                      </h3>
                    </button>
                  )}

                  {selectedCategoryId === BEBIDAS_CATEGORIA_ID &&
                    !catalog?.isCategoriaOut(BEBIDAS_CATEGORIA_ID) && (
                    <div
                      ref={expandPanelRef}
                      className="col-span-2 sm:col-span-3 rounded-xl border border-border bg-card text-card-foreground shadow-sm animate-in fade-in-0 slide-in-from-top-2 duration-200"
                    >
                      <div className="bg-secondary/40 border-b border-border px-4 py-3 rounded-t-xl">
                        <h3 className="font-semibold">Aguas Frescas</h3>
                        <p className="text-sm text-muted-foreground">
                          Bebidas naturales y refrescantes
                        </p>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {bebidasOrdenar.map((bebida) => {
                            const active = selectedBebidaId === bebida.id
                            const agotada =
                              catalog?.isBebidaOut(bebida.id) ?? false
                            const precio = catalog
                              ? catalog.getBebidaPrecio(bebida.id)
                              : bebida.price
                            return (
                              <button
                                key={bebida.id}
                                type="button"
                                disabled={agotada}
                                onClick={() => {
                                  if (agotada) return
                                  setSelectedBebidaId(bebida.id)
                                  setBebidaPickerQty(1)
                                }}
                                className={cn(
                                  "rounded-xl border p-4 text-left transition-colors touch-manipulation",
                                  agotada
                                    ? "opacity-50 cursor-not-allowed border-border bg-muted"
                                    : "cursor-pointer border-border bg-muted/30 hover:border-primary/50",
                                  active &&
                                    !agotada &&
                                    "border-primary ring-2 ring-primary/30 bg-accent/40",
                                )}
                              >
                                <h4 className="font-semibold">{bebida.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  ${precio} MXN
                                  {agotada && (
                                    <span className="block text-xs text-destructive">
                                      Agotado
                                    </span>
                                  )}
                                </p>
                              </button>
                            )
                          })}
                        </div>

                        {selectedBebida && (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2 border-t border-border">
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
                                  bebidaPickerQty,
                                )
                              }}
                            >
                              Agregar al carrito
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
                        {cart.map((item) => (
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
                        ))}
                      </div>

                      <div className="border-t border-border mt-4 pt-4">
                        <div className="flex justify-between items-center mb-4">
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
                          disabled={placeOrderLoading}
                        >
                          {placeOrderLoading
                            ? "Abriendo pago…"
                            : orderType === "takeout"
                              ? "Pagar y confirmar pedido"
                              : "Hacer pedido"}
                        </Button>
                        {orderType === "takeout" && !placeOrderLoading && (
                          <p className="text-xs text-muted-foreground text-center mt-2">
                            Para llevar: el pedido se confirma al completar el pago con tarjeta.
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
