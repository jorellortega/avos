"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createBrowserSupabase } from "@/lib/supabase/client"
import type { JobApplicationStatus, JobApplicationWithPost, JobPostRow } from "@/lib/jobs-types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const STATUS_OPTIONS: { value: JobApplicationStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "reviewed", label: "Revisada" },
  { value: "interview", label: "Entrevista" },
  { value: "hired", label: "Contratado" },
  { value: "rejected", label: "Rechazada" },
]

function emptyPost(): Partial<JobPostRow> {
  return {
    title: "",
    description: "",
    location: "",
    employment_type: "Tiempo completo",
    pay: "",
    is_active: true,
    sort_order: 0,
  }
}

export function JobsEditDashboard() {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [posts, setPosts] = useState<JobPostRow[]>([])
  const [applications, setApplications] = useState<JobApplicationWithPost[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refreshPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from("job_posts")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
    if (error) {
      setLoadError(error.message)
      return
    }
    setPosts((data ?? []) as JobPostRow[])
  }, [supabase])

  const refreshApplications = useCallback(async () => {
    const { data, error } = await supabase
      .from("job_applications")
      .select("id, job_post_id, full_name, email, phone, message, status, created_at, job_posts(title)")
      .order("created_at", { ascending: false })
    if (error) {
      setLoadError(error.message)
      return
    }
    setApplications((data ?? []) as JobApplicationWithPost[])
  }, [supabase])

  const refreshAll = useCallback(async () => {
    setLoadError(null)
    await Promise.all([refreshPosts(), refreshApplications()])
  }, [refreshPosts, refreshApplications])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  async function toggleActive(post: JobPostRow) {
    setBusyId(post.id)
    const { error } = await supabase
      .from("job_posts")
      .update({ is_active: !post.is_active })
      .eq("id", post.id)
    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      return
    }
    void refreshPosts()
  }

  async function deletePost(id: string) {
    setBusyId(id)
    const { error } = await supabase.from("job_posts").delete().eq("id", id)
    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      return
    }
    void refreshAll()
  }

  async function updateApplicationStatus(id: string, status: JobApplicationStatus) {
    setBusyId(id)
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", id)
    setBusyId(null)
    if (error) {
      setLoadError(error.message)
      return
    }
    void refreshApplications()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Empleos — administración
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Publica vacantes y revisa solicitudes. La página pública está en{" "}
          <a href="/jobs" className="text-primary underline underline-offset-2">
            /jobs
          </a>
          .
        </p>
      </div>

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {loadError}
            <Button type="button" variant="outline" size="sm" onClick={() => void refreshAll()}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="posts" className="w-full">
        <TabsList>
          <TabsTrigger value="posts">Vacantes</TabsTrigger>
          <TabsTrigger value="applications">Solicitudes</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <PostFormDialog
              supabase={supabase}
              mode="create"
              onSaved={() => void refreshPosts()}
            />
          </div>
          {posts.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sin vacantes</CardTitle>
                <CardDescription>Crea una vacante para que aparezca en /jobs.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <Card key={post.id}>
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{post.title}</CardTitle>
                      <CardDescription>
                        {post.is_active ? (
                          <Badge variant="secondary">Publicada</Badge>
                        ) : (
                          <Badge variant="outline">Oculta</Badge>
                        )}{" "}
                        · {post.employment_type}
                        {post.location ? ` · ${post.location}` : ""}
                        {post.pay?.trim() ? ` · ${post.pay.trim()}` : ""}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Switch
                          id={`active-${post.id}`}
                          checked={post.is_active}
                          disabled={busyId === post.id}
                          onCheckedChange={() => void toggleActive(post)}
                        />
                        <Label htmlFor={`active-${post.id}`} className="cursor-pointer">
                          Activa
                        </Label>
                      </div>
                      <PostFormDialog
                        supabase={supabase}
                        mode="edit"
                        post={post}
                        onSaved={() => void refreshPosts()}
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={busyId === post.id}>
                            Eliminar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar vacante?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminarán también las solicitudes asociadas. Esta acción no se puede
                              deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void deletePost(post.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                      {post.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="applications" className="mt-4">
          {applications.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sin solicitudes</CardTitle>
                <CardDescription>
                  Las solicitudes desde /jobs aparecerán aquí cuando existan vacantes activas.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Vacante</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead className="max-w-[200px]">Mensaje</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(app.created_at).toLocaleString("es")}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm">
                        {app.job_posts?.title ?? "—"}
                      </TableCell>
                      <TableCell className="font-medium">{app.full_name}</TableCell>
                      <TableCell>
                        <a href={`mailto:${app.email}`} className="text-primary underline text-sm">
                          {app.email}
                        </a>
                      </TableCell>
                      <TableCell className="text-sm">{app.phone || "—"}</TableCell>
                      <TableCell className="max-w-[220px] text-sm align-top">
                        {app.message ? (
                          <span className="line-clamp-4 whitespace-pre-wrap" title={app.message}>
                            {app.message}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={app.status}
                          disabled={busyId === app.id}
                          onValueChange={(v) =>
                            void updateApplicationStatus(app.id, v as JobApplicationStatus)
                          }
                        >
                          <SelectTrigger className="w-[140px]" size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PostFormDialog({
  supabase,
  mode,
  post,
  onSaved,
}: {
  supabase: ReturnType<typeof createBrowserSupabase>
  mode: "create" | "edit"
  post?: JobPostRow
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)

  const defaults = mode === "edit" && post ? post : (emptyPost() as JobPostRow)
  const fieldId = post?.id ?? (mode === "create" ? "create" : "edit")

  useEffect(() => {
    if (open) {
      setIsActive(mode === "edit" && post ? post.is_active : true)
      setError(null)
    }
  }, [open, mode, post])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const fd = new FormData(form)
    const title = String(fd.get("title") ?? "").trim()
    const description = String(fd.get("description") ?? "").trim()
    const location = String(fd.get("location") ?? "").trim()
    const employment_type = String(fd.get("employment_type") ?? "").trim() || "Tiempo completo"
    const pay = String(fd.get("pay") ?? "").trim()
    const sort_order = Number(fd.get("sort_order") ?? 0) || 0
    const is_active = isActive

    if (!title) {
      setPending(false)
      setError("El título es obligatorio.")
      return
    }

    if (mode === "create") {
      const { error: insErr } = await supabase.from("job_posts").insert({
        title,
        description,
        location,
        employment_type,
        pay,
        is_active,
        sort_order,
      })
      setPending(false)
      if (insErr) {
        setError(insErr.message)
        return
      }
    } else if (post) {
      const { error: upErr } = await supabase
        .from("job_posts")
        .update({
          title,
          description,
          location,
          employment_type,
          pay,
          is_active,
          sort_order,
        })
        .eq("id", post.id)
      setPending(false)
      if (upErr) {
        setError(upErr.message)
        return
      }
    }

    setOpen(false)
    onSaved()
    form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={mode === "create" ? "default" : "outline"} size="sm">
          {mode === "create" ? "Nueva vacante" : "Editar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nueva vacante" : "Editar vacante"}</DialogTitle>
          <DialogDescription>
            Los cambios se reflejan de inmediato en la página pública si la vacante está activa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`jf-title-${fieldId}`}>Título</Label>
            <Input
              id={`jf-title-${fieldId}`}
              name="title"
              required
              defaultValue={defaults.title}
              key={`${mode}-${post?.id}-title`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`jf-desc-${fieldId}`}>Descripción</Label>
            <Textarea
              id={`jf-desc-${fieldId}`}
              name="description"
              rows={6}
              defaultValue={defaults.description}
              key={`${mode}-${post?.id}-desc`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`jf-loc-${fieldId}`}>Ubicación</Label>
              <Input id={`jf-loc-${fieldId}`} name="location" defaultValue={defaults.location} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`jf-type-${fieldId}`}>Tipo de empleo</Label>
              <Input
                id={`jf-type-${fieldId}`}
                name="employment_type"
                defaultValue={defaults.employment_type}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`jf-pay-${fieldId}`}>Pago / compensación</Label>
            <Input
              id={`jf-pay-${fieldId}`}
              name="pay"
              placeholder='Ej. $18/hora, $500–$600/semana, según experiencia'
              defaultValue={String(defaults.pay ?? "")}
              key={`${mode}-${post?.id}-pay`}
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Se muestra en la página pública de empleos.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`jf-sort-${fieldId}`}>Orden (menor primero)</Label>
              <Input
                id={`jf-sort-${fieldId}`}
                name="sort_order"
                type="number"
                defaultValue={defaults.sort_order}
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <div className="flex items-center gap-2">
                <Switch
                  id={`jf-active-${fieldId}`}
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor={`jf-active-${fieldId}`}>Publicada (activa)</Label>
              </div>
            </div>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
