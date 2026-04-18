import { Tag } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function CuentaOfertasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Ofertas
        </h1>
        <p className="text-muted-foreground mt-1">
          Promociones y cupones para clientes registrados.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <Tag className="h-10 w-10 text-muted-foreground mb-2" />
          <CardTitle>Próximamente</CardTitle>
          <CardDescription>
            Estamos preparando ofertas exclusivas para tu cuenta. Vuelve pronto o
            síguenos en redes para novedades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Si tienes una idea de promoción, pregunta en el local o por WhatsApp.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
