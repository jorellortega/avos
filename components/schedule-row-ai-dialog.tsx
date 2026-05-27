"use client"

import { useEffect, useState } from "react"
import { Brain, Loader2, Sparkles } from "lucide-react"
import type { ScheduleAiResult } from "@/lib/schedule-ai"
import type {
  StaffScheduleEmployeeRow,
  StaffScheduleRow,
} from "@/lib/schedule-types"
import {
  SCHEDULE_SHIFT_LABELS,
  type ScheduleShiftKey,
} from "@/lib/schedule-types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type ScheduleRowAiDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: StaffScheduleRow
  employee: StaffScheduleEmployeeRow | null
  onApply: (
    employee: StaffScheduleEmployeeRow,
    plan: ScheduleAiResult,
  ) => Promise<string | null>
}

export function ScheduleRowAiDialog({
  open,
  onOpenChange,
  schedule,
  employee,
  onApply,
}: ScheduleRowAiDialogProps) {
  const [instructions, setInstructions] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSummary, setLastSummary] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setInstructions("")
      setError(null)
      setLastSummary(null)
      setLoading(false)
    }
  }, [open])

  const rowLabel = employee?.name.trim() || "esta fila"
  const shiftLabel = employee
    ? SCHEDULE_SHIFT_LABELS[(employee.shift ?? "manana") as ScheduleShiftKey]
    : ""

  async function runRowAssistant() {
    if (!employee) return
    const text = instructions.trim()
    if (!text) {
      setError("Escribe las instrucciones para esta fila.")
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
          employees: [employee],
          focusEmployeeId: employee.id,
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

      const applyNote = await onApply(employee, data.plan)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            IA — {rowLabel}
          </DialogTitle>
          <DialogDescription>
            {shiftLabel
              ? `Turno de ${shiftLabel.toLowerCase()}. Solo se editará esta fila.`
              : "Solo se editará esta fila."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-row-ai-instructions">Instrucciones</Label>
            <Textarea
              id="schedule-row-ai-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={`Ejemplo:
Miércoles, jueves y sábado 9:00–14:30 en parrilla.
Lunes, viernes y domingo OFF.
Martes el local está cerrado.`}
              rows={7}
              disabled={loading || !employee}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {lastSummary && !error && (
            <Alert>
              <AlertTitle>Listo</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">
                {lastSummary}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={() => void runRowAssistant()}
            disabled={loading || !employee || !instructions.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Procesando…
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                Aplicar a esta fila
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
