import type { Metadata } from 'next'
import { Montserrat, Open_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { CartProvider } from '@/components/cart-provider'
import { MenuCatalogProvider } from '@/components/menu-catalog-provider'
import { OrdersProvider } from '@/components/orders-provider'

const montserrat = Montserrat({ 
  subsets: ["latin"],
  variable: '--font-montserrat',
  display: 'swap'
});

const openSans = Open_Sans({ 
  subsets: ["latin"],
  variable: '--font-open-sans',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Avos Mexican Grill | Comida Mexicana Estilo California',
  description: 'Enfocado en la parrilla, abundante en aguacate. Tacos, burritos, quesadillas y más. Ordena para recoger.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} ${openSans.variable} font-sans antialiased`}>
        <OrdersProvider>
          <CartProvider>
            <MenuCatalogProvider>{children}</MenuCatalogProvider>
          </CartProvider>
        </OrdersProvider>
        <Analytics />
      </body>
    </html>
  )
}
