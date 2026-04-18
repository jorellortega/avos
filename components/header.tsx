"use client"

import Link from "next/link"
import {
  ShoppingCart,
  Menu,
  X,
  ChevronDown,
  Users,
  ChefHat,
  Banknote,
  Tags,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/components/cart-provider"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { AccountNavLinks } from "@/components/account-nav-links"
import { useStaffOrdenesNavAccess } from "@/hooks/use-staff-ordenes-nav-access"

export function Header() {
  const { itemCount } = useCart()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const staffOrdenesNav = useStaffOrdenesNavAccess()

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center">
              <svg viewBox="0 0 40 40" className="w-10 h-10 md:w-12 md:h-12">
                <ellipse cx="20" cy="20" rx="18" ry="20" fill="#4a7c59" />
                <ellipse cx="20" cy="20" rx="10" ry="12" fill="#8fbc8f" />
                <ellipse cx="20" cy="20" rx="4" ry="5" fill="#654321" />
              </svg>
              <span className="text-xl md:text-2xl font-bold text-primary ml-1" style={{ fontFamily: 'var(--font-heading)' }}>
                AVOS
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-foreground/80 hover:text-primary transition-colors font-medium"
            >
              Inicio
            </Link>
            <Link
              href="/menu"
              className="text-foreground/80 hover:text-primary transition-colors font-medium"
            >
              Menú
            </Link>
            <Link
              href="/orden"
              className="text-foreground/80 hover:text-primary transition-colors font-medium"
            >
              Mi Orden
            </Link>
            <AccountNavLinks />
            {staffOrdenesNav === true && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-foreground/80 hover:text-primary transition-colors font-medium">
                  Staff
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/staff/ordenes" className="flex items-center gap-2 cursor-pointer">
                      <Banknote className="h-4 w-4" />
                      Órdenes y pagos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/staff/menu-catalog" className="flex items-center gap-2 cursor-pointer">
                      <Tags className="h-4 w-4" />
                      Precios y disponibilidad
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/staff" className="flex items-center gap-2 cursor-pointer">
                      <Users className="h-4 w-4" />
                      Crear Orden
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/cocina" className="flex items-center gap-2 cursor-pointer">
                      <ChefHat className="h-4 w-4" />
                      Cocina
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {/* Cart & Mobile Menu */}
          <div className="flex items-center gap-2">
            <Link href="/carrito">
              <Button variant="outline" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
                <span className="sr-only">Carrito de compras</span>
              </Button>
            </Link>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              <span className="sr-only">Menú</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-4 border-t border-border pt-4">
            <div className="flex flex-col gap-4">
              <Link
                href="/"
                className="text-foreground/80 hover:text-primary transition-colors font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Inicio
              </Link>
              <Link
                href="/menu"
                className="text-foreground/80 hover:text-primary transition-colors font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Menú
              </Link>
              <Link
                href="/orden"
                className="text-foreground/80 hover:text-primary transition-colors font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Mi Orden
              </Link>
              <div
                className="py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <AccountNavLinks />
              </div>
              {staffOrdenesNav === true && (
                <div className="border-t border-border pt-4 mt-2">
                  <p className="text-sm text-muted-foreground mb-2">Staff</p>
                  <Link
                    href="/staff/ordenes"
                    className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors font-medium py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Banknote className="h-4 w-4" />
                    Órdenes y pagos
                  </Link>
                  <Link
                    href="/staff/menu-catalog"
                    className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors font-medium py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Tags className="h-4 w-4" />
                    Precios y disponibilidad
                  </Link>
                  <Link
                    href="/staff"
                    className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors font-medium py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Users className="h-4 w-4" />
                    Crear Orden
                  </Link>
                  <Link
                    href="/cocina"
                    className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors font-medium py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <ChefHat className="h-4 w-4" />
                    Cocina
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
