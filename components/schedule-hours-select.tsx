"use client"

import { useMemo } from "react"
import { getSchedulePickerTimeOptions } from "@/lib/schedule-time-options"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ScheduleHoursSelectProps = {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function ScheduleHoursSelect({
  label,
  value,
  onChange,
  disabled,
}: ScheduleHoursSelectProps) {
  const options = useMemo(
    () => getSchedulePickerTimeOptions(value),
    [value],
  )

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-none">{label}</p>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecciona hora" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectGroup>
            <SelectLabel>{label}</SelectLabel>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
