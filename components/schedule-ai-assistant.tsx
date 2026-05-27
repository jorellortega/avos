"use client"

import Link from "next/link"
import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import type { ScheduleAiResult } from "@/lib/schedule-ai"
import type {
  StaffScheduleEmployeeRow,
  StaffScheduleRow,
} from "@/lib/schedule-types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type ScheduleAiAssistantProps = {
  schedule: StaffScheduleRow
  employees: StaffScheduleEmployeeRow[]
  onApply: (plan: ScheduleAiResult) => Promise<string | null>
  disabled?: boolean
}

export function ScheduleAiAssistant({
  schedule,
  employees,
  onApply,
  disabled,
}: ScheduleAiAssistantProps) {
  const [instructions, setInstructions] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSummary, setLastSummary] = useState<string | null>(null)

  async function runAssistant() {
    const text = instructions.trim()
    if (!text) {
      setError("Escribe qué quieres cambiar en el horario.")
      return
    }

    setLoading(true)
    setError(null)
    setLastSummary(null)

    try {
      const res = await fetch("/api/schedule-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructions: text,
          schedule,
          employees,
        }),
      })

      const data = (await res.json()) as {
        error?: string
        plan?: ScheduleAiResult
      }

      if (!res.ok) {
        setError(data.error ?? "No se pudo procesar con la IA.")
        return
      }

      if (!data.plan?.summary) {
        setError("La IA no devolvió un plan válido.")
        return
      }

      const applyNote = await onApply(data.plan)
      if (applyNote === "Horario no cargado.") {
        setError(applyNote)
        return
      }

      setLastSummary(
        applyNote
          ? `${data.plan.summary}\n\nNota: ${applyNote}`
          : data.plan.summary,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          Asistente de horario (IA)
        </CardTitle>
        <CardDescription>
          Describe en español quién trabaja, quién falta, días que cierran, etc.
          La IA llenará la tabla según los nombres que ya tengas. Necesitas API
          en{" "}
          <Link href="/ai-settings" className="underline underline-offset-2">
            Ajustes de IA
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="schedule-ai-instructions">Instrucciones</Label>
          <Textarea
            id="schedule-ai-instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={`Ejemplos:
• María trabaja lunes a miércoles 9-5; jueves y viernes libre.
• Pedro solo puede venir martes y jueves en la tarde.
• El domingo cerramos — pon Cerrado para todos.
• Agrega a Ana en mañana: lun-vie 8-3.`}
            rows={6}
            disabled={disabled || loading}
          />
        </div>

        <Button
          type="button"
          onClick={() => void runAssistant()}
          disabled={disabled || loading || !instructions.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Procesando…
            </>
          ) : (
            <>
              <Sparkles className="size-4 mr-2" />
              Aplicar con IA
            </>
          )}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {lastSummary && !error && (
          <Alert>
            <AlertTitle>Listo</AlertTitle>
            <AlertDescription>{lastSummary}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
