"use client"

import { useRouter } from "next/navigation"
import { CreditCard, ShoppingBag } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { Button } from "@/components/ui/button"
import { MenuOrderServicePicker } from "@/components/menu-order-service-picker"
import { useMenuOrderService } from "@/hooks/use-menu-order-service"
import { cn } from "@/lib/utils"

export function MenuCategoryCartBar() {
  const router = useRouter()
  const { total, itemCount } = useCart()
  const service = useMenuOrderService()
  const hasItems = itemCount > 0

  if (hasItems) {
    return (
      <div
        className={cn(
          "mt-6 rounded-xl border border-primary/25 bg-card p-4 shadow-sm ring-1 ring-primary/15",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <ShoppingBag className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Total del carrito</p>
            <p className="truncate text-xl font-bold tabular-nums text-foreground">
              ${total.toFixed(2)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {itemCount} {itemCount === 1 ? "artículo" : "artículos"}
              </span>
            </p>
          </div>
        </div>

        <MenuOrderServicePicker {...service} className="mt-4" />

        <Button
          type="button"
          size="lg"
          disabled={!service.isComplete}
          className="mt-4 w-full bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600/40 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700"
          onClick={() => {
            if (!service.isComplete) return
            router.push("/checkout")
          }}
        >
          <CreditCard className="h-5 w-5" aria-hidden />
          Pagar
        </Button>
        {!service.isComplete && service.hydrated && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Elige para llevar o para aquí (y mesa si aplica) para continuar.
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center"
      aria-live="polite"
    >
      <p className="text-sm text-muted-foreground">
        Carrito: <span className="font-semibold tabular-nums text-foreground">${total.toFixed(2)}</span>
        {" · "}
        Agrega artículos arriba para pagar
      </p>
    </div>
  )
}
