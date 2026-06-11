"use client"

import { useMemo } from "react"
import type {
  ScheduleHoursOfOperation,
  ScheduleShiftKey,
} from "@/lib/schedule-types"
import { DEFAULT_SCHEDULE_HOURS } from "@/lib/schedule-types"
import {
  composeScheduleDayValue,
  getScheduleEntryOptions,
  getScheduleExitOptions,
  isScheduleStatusValue,
  isExitAfterEntry,
  parseScheduleDayParts,
} from "@/lib/schedule-time-options"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const EMPTY_VALUE = "__empty__"

function toSelectValue(value: string): string {
  return value === "" ? EMPTY_VALUE : value
}

function fromSelectValue(value: string): string {
  return value === EMPTY_VALUE ? "" : value
}

type ScheduleDaySelectProps = {
  shift: ScheduleShiftKey
  hours?: ScheduleHoursOfOperation
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function ScheduleDaySelect({
  shift,
  hours = DEFAULT_SCHEDULE_HOURS,
  value,
  onChange,
  disabled,
}: ScheduleDaySelectProps) {
  const { entry, exit } = useMemo(
    () => parseScheduleDayParts(value),
    [value],
  )
  const isStatus = isScheduleStatusValue(entry)

  const { status: statusOptions, times: entryTimeOptions } = useMemo(
    () => getScheduleEntryOptions(shift, hours, value),
    [shift, hours, value],
  )

  const exitOptions = useMemo(
    () => getScheduleExitOptions(shift, hours, entry, exit),
    [shift, hours, entry, exit],
  )

  function handleEntryChange(next: string) {
    const entryValue = fromSelectValue(next)
    if (!entryValue) {
      onChange("")
      return
    }
    if (isScheduleStatusValue(entryValue)) {
      onChange(entryValue)
      return
    }
    const keptExit =
      exit && isExitAfterEntry(entryValue, exit) ? exit : ""
    onChange(composeScheduleDayValue(entryValue, keptExit))
  }

  function handleExitChange(next: string) {
    const exitValue = fromSelectValue(next)
    if (!entry || isScheduleStatusValue(entry)) return
    onChange(composeScheduleDayValue(entry, exitValue))
  }

  return (
    <div className="flex flex-col gap-1 min-w-[7.5rem]">
      <Select
        value={toSelectValue(entry)}
        onValueChange={handleEntryChange}
        disabled={disabled}
      >
        <SelectTrigger
          size="sm"
          className="w-full text-[11px] justify-between px-2 h-8"
          aria-label="Entrada"
        >
          <SelectValue placeholder="Entrada">
            {entry || "Entrada"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectGroup>
            <SelectLabel>Estado</SelectLabel>
            {statusOptions.map((opt) => (
              <SelectItem
                key={`status-${opt.value || EMPTY_VALUE}`}
                value={toSelectValue(opt.value)}
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Entrada</SelectLabel>
            {entryTimeOptions.map((opt) => (
              <SelectItem key={`entry-${opt.value}`} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        value={toSelectValue(exit)}
        onValueChange={handleExitChange}
        disabled={disabled || isStatus || !entry}
      >
        <SelectTrigger
          size="sm"
          className="w-full text-[11px] justify-between px-2 h-8"
          aria-label="Salida"
        >
          <SelectValue placeholder="Salida">
            {exit || "Salida"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectGroup>
            <SelectLabel>Salida</SelectLabel>
            {exitOptions.map((opt) => (
              <SelectItem
                key={`exit-${opt.value || EMPTY_VALUE}`}
                value={toSelectValue(opt.value)}
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
