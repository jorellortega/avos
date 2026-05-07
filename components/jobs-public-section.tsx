"use client"

import { useState } from "react"
import Link from "next/link"
import { MapPin, Briefcase, DollarSign, Clock } from "lucide-react"
import { submitJobApplication } from "@/app/jobs/actions"
import type { JobPostRow } from "@/lib/jobs-types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

function ApplyDialog({ job }: { job: JobPostRow }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setPending(true)
    const form = e.currentTarget
    const fd = new FormData(form)
    const result = await submitJobApplication(undefined, fd)
    setPending(false)
    if (result.ok) {
      setSuccess(true)
      form.reset()
    } else {
      setError(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Aplicar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {success ? "Solicitud enviada" : `Solicitud — ${job.title}`}
          </DialogTitle>
          <DialogDescription>
            {success
              ? "Recibimos tu solicitud. Te contactaremos pronto."
              : "Completa el formulario. No necesitas cuenta en el sitio."}
          </DialogDescription>
        </DialogHeader>
        {success ? (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Gracias</AlertTitle>
              <AlertDescription>
                Tu solicitud fue enviada correctamente. Si tu perfil encaja con la vacante, te
                contactaremos pronto.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setSuccess(false)
                  setError(null)
                }}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="job_post_id" value={job.id} />
            <div className="space-y-2">
              <Label htmlFor={`name-${job.id}`}>Nombre completo</Label>
              <Input id={`name-${job.id}`} name="full_name" required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`email-${job.id}`}>Correo</Label>
              <Input
                id={`email-${job.id}`}
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`phone-${job.id}`}>Teléfono (opcional)</Label>
              <Input id={`phone-${job.id}`} name="phone" type="tel" autoComplete="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`msg-${job.id}`}>Mensaje / experiencia (opcional)</Label>
              <Textarea id={`msg-${job.id}`} name="message" rows={4} />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Enviando…" : "Enviar solicitud"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function JobsPublicSection({
  jobs,
  loadError,
}: {
  jobs: JobPostRow[]
  loadError: boolean
}) {
  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudieron cargar las vacantes</AlertTitle>
        <AlertDescription>
          Intenta más tarde o visita el restaurante para preguntar por empleos.
        </AlertDescription>
      </Alert>
    )
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5" />
            Sin vacantes publicadas
          </CardTitle>
          <CardDescription>
            En este momento no hay posiciones listadas en la web. Puedes pasar por Avos o llamarnos
            para dejar tu información.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardHeader>
            <CardTitle className="text-xl">{job.title}</CardTitle>
            <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
              {job.pay?.trim() ? (
                <span className="inline-flex items-center gap-1 font-medium text-foreground/90">
                  <DollarSign className="h-3.5 w-3.5" />
                  {job.pay.trim()}
                </span>
              ) : null}
              {job.hours?.trim() ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {job.hours.trim()}
                </span>
              ) : null}
              {job.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.location}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />
                {job.employment_type}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{job.description}</p>
          </CardContent>
          <CardFooter className="justify-end border-t pt-4">
            <ApplyDialog job={job} />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
