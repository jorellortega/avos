"use client"

import { useMemo, useState } from "react"
import { CalendarDays, Copy, Check } from "lucide-react"
import type {
  StaffScheduleEmployeeRow,
  StaffScheduleRow,
} from "@/lib/schedule-types"
import {
  SCHEDULE_SHIFT_KEYS,
  SCHEDULE_SHIFT_LABELS,
} from "@/lib/schedule-types"
import {
  buildFullSchedulePlainText,
  formatScheduleCell,
  formatScheduleWeekRange,
  getScheduleDayDateLabels,
} from "@/lib/schedule-display"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

type ScheduleFullViewDialogProps = {
  schedule: StaffScheduleRow
  employees: StaffScheduleEmployeeRow[]
}

export function ScheduleFullViewDialog({
  schedule,
  employees,
}: ScheduleFullViewDialogProps) {
  const [copied, setCopied] = useState(false)
  const dayLabels = useMemo(
    () => getScheduleDayDateLabels(schedule.week_start),
    [schedule.week_start],
  )
  const weekRange = formatScheduleWeekRange(schedule.week_start)
  const plainText = useMemo(
    () => buildFullSchedulePlainText(schedule, employees),
    [schedule, employees],
  )

  const namedCount = employees.filter((e) => e.name.trim()).length

  async function copySchedule() {
    try {
      await navigator.clipboard.writeText(plainText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <CalendarDays className="size-4 mr-2" />
          Ver horario completo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[min(96vw,56rem)] max-h-[min(90vh,48rem)] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{schedule.title.trim() || "Horario de la semana"}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 text-left">
              {weekRange ? (
                <p className="capitalize text-foreground/80">{weekRange}</p>
              ) : (
                <p>
                  Sin fecha de inicio — los días muestran solo Lun–Dom. Añade
                  «Inicio de semana» para ver fechas.
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant={schedule.is_published ? "default" : "secondary"}>
                  {schedule.is_published ? "Publicado" : "Borrador"}
                </Badge>
                <Badge variant="outline">
                  {namedCount} empleado{namedCount === 1 ? "" : "s"}
                </Badge>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={() => void copySchedule()}>
            {copied ? (
              <>
                <Check className="size-4 mr-2 text-green-600" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="size-4 mr-2" />
                Copiar texto
              </>
            )}
          </Button>
        </div>

        <div className="overflow-auto flex-1 min-h-0 space-y-6 pr-1">
          {SCHEDULE_SHIFT_KEYS.map((shift) => {
            const rows = employees.filter(
              (e) => (e.shift ?? "manana") === shift && e.name.trim(),
            )
            return (
              <section key={shift} className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Turno de {SCHEDULE_SHIFT_LABELS[shift].toLowerCase()}
                </h3>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sin empleados en este turno.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px] sticky left-0 bg-background z-10">
                          Nombre
                        </TableHead>
                        {dayLabels.map(({ day, shortLabel, dateLine }) => (
                          <TableHead
                            key={day}
                            className="min-w-[88px] text-center whitespace-pre-line text-xs"
                          >
                            {shortLabel}
                            {dateLine ? (
                              <>
                                <br />
                                <span className="font-normal text-muted-foreground">
                                  {dateLine}
                                </span>
                              </>
                            ) : null}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium">
                            {emp.name.trim()}
                          </TableCell>
                          {dayLabels.map(({ day }) => (
                            <TableCell
                              key={day}
                              className="text-center text-sm whitespace-nowrap"
                            >
                              {formatScheduleCell(emp[day])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
