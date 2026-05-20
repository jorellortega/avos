import Link from "next/link"
import { MapPin, Phone, Clock } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg viewBox="0 0 40 40" className="w-10 h-10">
                <ellipse cx="20" cy="20" rx="18" ry="20" fill="#8fbc8f" />
                <ellipse cx="20" cy="20" rx="10" ry="12" fill="#c8e6c9" />
                <ellipse cx="20" cy="20" rx="4" ry="5" fill="#654321" />
              </svg>
              <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                AVOS
              </span>
            </div>
            <p className="text-primary-foreground/80 text-sm leading-relaxed">
              Comida Mexicana estilo California
            </p>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-lg mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
              Contacto
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>Pastor Ortiz Michoacan</span>
              </div>
              <a
                href="tel:+524431156204"
                className="flex items-center gap-3 hover:underline underline-offset-2"
              >
                <Phone className="h-5 w-5 flex-shrink-0" />
                <span>(443) 115-6204</span>
              </a>
            </div>
          </div>

          {/* Hours */}
          <div>
            <h3 className="font-semibold text-lg mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
              Horario
            </h3>
            <div className="flex items-start gap-3 text-sm">
              <Clock className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-1.5 leading-snug">
                <p>9:30am to 9:30pm</p>
                <p className="text-primary-foreground/90">
                  Closed: Thursdays and Tuesdays
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-8 pt-8 flex flex-col items-center gap-3 text-sm text-primary-foreground/70">
          <p className="text-center">
            &copy; {new Date().getFullYear()} Avos Mexican Grill. Todos los derechos reservados.
          </p>
          <Link
            href="/jobs"
            className="text-primary-foreground/90 hover:text-primary-foreground underline underline-offset-4 font-medium transition-colors"
          >
            Empleos — trabaja con nosotros
          </Link>
        </div>
      </div>
    </footer>
  )
}
