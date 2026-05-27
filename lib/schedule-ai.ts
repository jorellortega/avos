import type {
  ScheduleDayKey,
  ScheduleShiftKey,
  StaffScheduleEmployeeRow,
  StaffScheduleRow,
} from "@/lib/schedule-types"
import {
  SCHEDULE_DAY_KEYS,
  SCHEDULE_DAY_LABELS,
  SCHEDULE_SHIFT_LABELS,
} from "@/lib/schedule-types"

export type ScheduleAiEmployeeMatch = {
  id?: string
  name?: string
}

export type ScheduleAiDayPatch = Partial<Record<ScheduleDayKey, string>>

export type ScheduleAiResult = {
  summary: string
  schedule?: {
    title?: string
    week_start?: string | null
  }
  employee_updates?: Array<{
    match: ScheduleAiEmployeeMatch
    name?: string
    days?: ScheduleAiDayPatch
  }>
  /** Same day patch applied to every existing employee row. */
  employee_updates_all?: {
    days?: ScheduleAiDayPatch
  }
  add_employees?: Array<{
    name: string
    shift?: ScheduleShiftKey
    days?: ScheduleAiDayPatch
  }>
  remove?: ScheduleAiEmployeeMatch[]
}

export const SCHEDULE_AI_SYSTEM_PROMPT = `Eres un asistente para llenar horarios semanales de empleados en un restaurante (Avos).
El manager describe en español quién trabaja qué días, quién no puede venir, días que el local cierra, turnos, etc.

Responde SOLO JSON válido con esta forma:
{
  "summary": "Breve resumen en español de lo que aplicaste",
  "schedule": { "title": "opcional", "week_start": "YYYY-MM-DD o null" },
  "employee_updates": [
    { "match": { "id": "uuid" } o { "name": "Nombre" }, "name": "Nombre completo (OBLIGATORIO)", "days": { "mon": "9-5", "tue": "Libre", ... todos los días que apliquen } }
  ],
  "employee_updates_all": { "days": { "sun": "Cerrado" } },
  "add_employees": [
    { "name": "Pedro", "shift": "manana|tarde", "days": { "mon": "9-3" } }
  ],
  "remove": [{ "id": "uuid" } o { "name": "Nombre" }]
}

Reglas:
- Días: solo las claves mon, tue, wed, thu, fri, sat, sun (lun→mon, mar→tue, mié→wed, jue→thu, vie→fri, sáb→sat, dom→sun).
- Valores cortos: horario ("9:00-14:30"), "Libre", "OFF", "Cerrado" (local cerrado), "—".
- En employee_updates SIEMPRE pon "name" con el nombre del empleado (ej. "Mariana"). Sin excepción.
- Para cada empleado, en "days" incluye los 7 días con su valor final (trabajo, OFF, Libre, Cerrado, etc.).
- UN solo registro por nombre y turno: nunca repitas el mismo nombre en add_employees ni en varios employee_updates.
- Si el nombre ya está en la lista, un solo employee_updates con match.name (no add_employees, no otra fila).
- Usa employee_updates_all solo si aplica a TODOS por igual (nunca para una sola persona).
- Persona nueva: un solo add_employees con name + shift; no rellenes varias filas vacías.
- match.id solo si ese id ya tiene ese mismo nombre.
- Si la semana tiene week_start, interpreta lunes/martes según esas fechas.
- Si no puedes aplicar nada útil, summary explica por qué y deja arrays vacíos.`

export function scheduleNormalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

function normalizeName(value: string): string {
  return scheduleNormalizeName(value)
}

export function scheduleEmployeeKey(
  name: string,
  shift: ScheduleShiftKey,
): string {
  return `${scheduleNormalizeName(name)}|${shift}`
}

export function scoreScheduleEmployeeRow(
  emp: StaffScheduleEmployeeRow,
): number {
  let score = emp.name.trim() ? 20 : 0
  for (const day of SCHEDULE_DAY_KEYS) {
    const v = emp[day]?.trim()
    if (v && v !== "—" && v !== "-") score += 1
  }
  return score
}

export function findEmployeesByNameAndShift(
  employees: StaffScheduleEmployeeRow[],
  name: string,
  shift: ScheduleShiftKey,
): StaffScheduleEmployeeRow[] {
  const target = normalizeName(name)
  if (!target) return []
  return employees.filter(
    (e) =>
      (e.shift ?? "manana") === shift && normalizeName(e.name) === target,
  )
}

export function pickBestScheduleEmployee(
  rows: StaffScheduleEmployeeRow[],
): StaffScheduleEmployeeRow | undefined {
  if (rows.length === 0) return undefined
  return [...rows].sort(
    (a, b) => scoreScheduleEmployeeRow(b) - scoreScheduleEmployeeRow(a),
  )[0]
}

/** Groups of duplicate ids to remove (same name + shift); keeper is first in each group. */
export function findDuplicateEmployeeIds(
  employees: StaffScheduleEmployeeRow[],
): { keeperId: string; removeIds: string[] }[] {
  const groups = new Map<string, StaffScheduleEmployeeRow[]>()

  for (const emp of employees) {
    const name = emp.name.trim()
    if (!name) continue
    const key = scheduleEmployeeKey(name, (emp.shift ?? "manana") as ScheduleShiftKey)
    const list = groups.get(key) ?? []
    list.push(emp)
    groups.set(key, list)
  }

  const out: { keeperId: string; removeIds: string[] }[] = []
  for (const group of groups.values()) {
    if (group.length <= 1) continue
    const keeper = pickBestScheduleEmployee(group)!
    out.push({
      keeperId: keeper.id,
      removeIds: group.filter((e) => e.id !== keeper.id).map((e) => e.id),
    })
  }
  return out
}

function mergeDayPatches(
  ...patches: (ScheduleAiDayPatch | undefined)[]
): ScheduleAiDayPatch | undefined {
  const merged: ScheduleAiDayPatch = {}
  for (const patch of patches) {
    if (!patch) continue
    Object.assign(merged, patch)
  }
  return Object.keys(merged).length > 0 ? merged : undefined
}

function formatWeekStartLabel(weekStart: string | null): string {
  if (!weekStart) return "Sin fecha de inicio (lun=calendario genérico)"
  const start = new Date(`${weekStart}T12:00:00`)
  if (Number.isNaN(start.getTime())) return `Inicio de semana: ${weekStart}`
  const parts = SCHEDULE_DAY_KEYS.map((key, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const label = d.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
    })
    return `${SCHEDULE_DAY_LABELS[key]} (${key})=${label}`
  })
  return `Semana desde ${weekStart}: ${parts.join(", ")}`
}

export function buildScheduleAiContext(
  schedule: StaffScheduleRow,
  employees: StaffScheduleEmployeeRow[],
): string {
  const header = [
    `Título: ${schedule.title}`,
    formatWeekStartLabel(schedule.week_start),
    `Publicado: ${schedule.is_published ? "sí" : "no"}`,
  ].join("\n")

  const rows =
    employees.length === 0
      ? "(Sin empleados en la lista — puedes proponer add_employees.)"
      : employees
          .map((e) => {
            const days = SCHEDULE_DAY_KEYS.map(
              (d) => `${d}:${JSON.stringify(e[d] ?? "")}`,
            ).join(" ")
            const nameLabel = e.name.trim()
              ? JSON.stringify(e.name)
              : '"" (SIN NOMBRE — si es persona nueva usa add_employees con name, no solo id)'
            return [
              `- id=${e.id}`,
              `name=${nameLabel}`,
              `shift=${e.shift ?? "manana"} (${SCHEDULE_SHIFT_LABELS[(e.shift ?? "manana") as ScheduleShiftKey]})`,
              days,
            ].join(" | ")
          })
          .join("\n")

  return `${header}\n\nEmpleados actuales:\n${rows}`
}

export const SCHEDULE_AI_ROW_SYSTEM_PROMPT = `Eres un asistente para editar UNA sola fila de horario semanal (un empleado) en Avos.
El manager describe en español el horario de ESA persona solamente.

Responde SOLO JSON válido:
{
  "summary": "Breve resumen en español",
  "employee_updates": [
    {
      "match": { "id": "uuid de la fila" },
      "name": "Nombre del empleado (OBLIGATORIO si lo mencionan o la fila no tiene nombre)",
      "days": { "mon": "...", "tue": "...", "wed": "...", "thu": "...", "fri": "...", "sat": "...", "sun": "..." }
    }
  ]
}

Reglas:
- Modifica SOLO esta fila. No uses add_employees, remove ni employee_updates_all.
- En "days" pon los 7 días (mon–sun) con el valor final: horario ("9:00-14:30"), "OFF", "Libre", "Cerrado", "—".
- lun→mon, mar→tue, mié→wed, jue→thu, vie→fri, sáb→sat, dom→sun.
- match.id debe ser el id de la fila del contexto.
- Si cambian el nombre, inclúyelo en "name".`

export function buildScheduleAiRowContext(
  schedule: StaffScheduleRow,
  employee: StaffScheduleEmployeeRow,
): string {
  const header = [
    `Título de la semana: ${schedule.title}`,
    formatWeekStartLabel(schedule.week_start),
  ].join("\n")

  const days = SCHEDULE_DAY_KEYS.map(
    (d) => `${SCHEDULE_DAY_LABELS[d]} (${d}): ${JSON.stringify(employee[d] ?? "")}`,
  ).join("\n")

  const shift = (employee.shift ?? "manana") as ScheduleShiftKey
  const row = [
    `id=${employee.id}`,
    `name=${JSON.stringify(employee.name)}`,
    `shift=${shift} (${SCHEDULE_SHIFT_LABELS[shift]})`,
    "Horario actual por día:",
    days,
  ].join("\n")

  return `${header}\n\nFila a editar (solo esta persona):\n${row}`
}

/** Restrict AI plan to a single employee row. */
export function normalizeScheduleAiRowPlan(
  plan: ScheduleAiResult,
  employee: StaffScheduleEmployeeRow,
  instructions: string,
): ScheduleAiResult {
  normalizeScheduleAiPlan(plan, instructions, [employee])

  delete plan.schedule
  delete plan.employee_updates_all
  delete plan.add_employees
  delete plan.remove

  let name =
    plan.employee_updates?.[0]?.name?.trim() ||
    plan.employee_updates?.[0]?.match.name?.trim() ||
    employee.name.trim()

  const namesFromText = extractEmployeeNamesFromInstructions(instructions)
  if (!name && namesFromText.length === 1) name = namesFromText[0]
  if (!name && namesFromText.length > 0) name = namesFromText[0]

  const days = mergeDayPatches(
    ...(plan.employee_updates ?? []).map((u) => u.days),
  )

  plan.employee_updates = [
    {
      match: { id: employee.id, ...(name ? { name } : {}) },
      ...(name ? { name } : {}),
      ...(days ? { days } : {}),
    },
  ]

  return plan
}

export function parseScheduleAiJson(raw: string): ScheduleAiResult | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const start = raw.indexOf("{")
    const end = raw.lastIndexOf("}")
    if (start < 0 || end <= start) return null
    try {
      parsed = JSON.parse(raw.slice(start, end + 1))
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed !== "object") return null
  const o = parsed as Record<string, unknown>
  const summary = typeof o.summary === "string" ? o.summary.trim() : ""
  if (!summary) return null

  const result: ScheduleAiResult = { summary }

  if (o.schedule && typeof o.schedule === "object") {
    const s = o.schedule as Record<string, unknown>
    const patch: NonNullable<ScheduleAiResult["schedule"]> = {}
    if (typeof s.title === "string" && s.title.trim()) {
      patch.title = s.title.trim()
    }
    if (s.week_start === null) {
      patch.week_start = null
    } else if (typeof s.week_start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.week_start)) {
      patch.week_start = s.week_start
    }
    if (Object.keys(patch).length > 0) result.schedule = patch
  }

  const parseDays = (rawDays: unknown): ScheduleAiDayPatch | undefined => {
    if (!rawDays || typeof rawDays !== "object") return undefined
    const days: ScheduleAiDayPatch = {}
    for (const key of SCHEDULE_DAY_KEYS) {
      const v = (rawDays as Record<string, unknown>)[key]
      if (typeof v === "string") days[key] = v
    }
    return Object.keys(days).length > 0 ? days : undefined
  }

  const parseMatch = (raw: unknown): ScheduleAiEmployeeMatch | null => {
    if (!raw || typeof raw !== "object") return null
    const m = raw as Record<string, unknown>
    const id = typeof m.id === "string" ? m.id.trim() : ""
    const name = typeof m.name === "string" ? m.name.trim() : ""
    if (!id && !name) return null
    return { ...(id ? { id } : {}), ...(name ? { name } : {}) }
  }

  if (Array.isArray(o.employee_updates)) {
    const updates: NonNullable<ScheduleAiResult["employee_updates"]> = []
    for (const item of o.employee_updates) {
      if (!item || typeof item !== "object") continue
      const row = item as Record<string, unknown>
      const match = parseMatch(row.match)
      if (!match) continue
      const days = parseDays(row.days)
      const explicitName =
        typeof row.name === "string" ? row.name.trim() : ""
      const name = explicitName || match.name || ""
      if (!days && !name) continue
      updates.push({
        match,
        ...(name ? { name } : {}),
        ...(days ? { days } : {}),
      })
    }
    if (updates.length > 0) result.employee_updates = updates
  }

  if (o.employee_updates_all && typeof o.employee_updates_all === "object") {
    const days = parseDays(
      (o.employee_updates_all as Record<string, unknown>).days,
    )
    if (days) result.employee_updates_all = { days }
  }

  if (Array.isArray(o.add_employees)) {
    const adds: NonNullable<ScheduleAiResult["add_employees"]> = []
    for (const item of o.add_employees) {
      if (!item || typeof item !== "object") continue
      const row = item as Record<string, unknown>
      const name = typeof row.name === "string" ? row.name.trim() : ""
      if (!name) continue
      const shift =
        row.shift === "tarde" || row.shift === "manana" ? row.shift : undefined
      const days = parseDays(row.days)
      adds.push({
        name,
        ...(shift ? { shift } : {}),
        ...(days ? { days } : {}),
      })
    }
    if (adds.length > 0) result.add_employees = adds
  }

  if (Array.isArray(o.remove)) {
    const remove: ScheduleAiEmployeeMatch[] = []
    for (const item of o.remove) {
      const match = parseMatch(item)
      if (match) remove.push(match)
    }
    if (remove.length > 0) result.remove = remove
  }

  return result
}

/** Names from markdown headings like "# Mariana" in pasted instructions. */
export function extractEmployeeNamesFromInstructions(text: string): string[] {
  const names = new Set<string>()
  const skip =
    /^(descansos?|turno|semana|d[ií]as?|horario|puesto|mañana|tarde|lun|mar|mié|mie|jue|vie|sáb|sab|dom)$/i

  for (const m of text.matchAll(/^#{1,3}\s+([^\n#|]+?)\s*$/gim)) {
    const n = m[1].trim()
    if (n.length >= 2 && n.length <= 60 && !skip.test(n)) names.add(n)
  }

  return [...names]
}

export function resolveUpdateShift(
  update: NonNullable<ScheduleAiResult["employee_updates"]>[number],
  employees: StaffScheduleEmployeeRow[],
): ScheduleShiftKey {
  if (update.match.id) {
    const row = employees.find((e) => e.id === update.match.id)
    if (row) return (row.shift ?? "manana") as ScheduleShiftKey
  }
  return "manana"
}

/** Fill missing names, merge duplicate ops, one row per name+shift. */
export function normalizeScheduleAiPlan(
  plan: ScheduleAiResult,
  instructions: string,
  employees: StaffScheduleEmployeeRow[],
): ScheduleAiResult {
  const namesFromText = extractEmployeeNamesFromInstructions(instructions)
  const singleInferredName =
    namesFromText.length === 1 ? namesFromText[0] : undefined

  if (plan.employee_updates) {
    plan.employee_updates = plan.employee_updates.map((update) => {
      let name = update.name?.trim() || update.match.name?.trim() || ""

      if (!name && update.match.id) {
        const row = employees.find((e) => e.id === update.match.id)
        if (row && !row.name.trim() && singleInferredName) {
          name = singleInferredName
        }
      }

      if (!name && singleInferredName && plan.employee_updates!.length === 1) {
        name = singleInferredName
      }

      return name ? { ...update, name, match: { ...update.match, name } } : update
    })
  }

  const hasNamedUpdates = (plan.employee_updates ?? []).some(
    (u) => (u.name?.trim() || u.match.name?.trim() || "").length > 0,
  )
  if (hasNamedUpdates && plan.employee_updates_all) {
    delete plan.employee_updates_all
  }

  const updatesByKey = new Map<
    string,
    NonNullable<ScheduleAiResult["employee_updates"]>[number]
  >()

  for (const update of plan.employee_updates ?? []) {
    const name = update.name?.trim() || update.match.name?.trim() || ""
    const shift = resolveUpdateShift(update, employees)
    if (!name) {
      const id = update.match.id
      if (id) updatesByKey.set(`id:${id}`, update)
      continue
    }

    const key = scheduleEmployeeKey(name, shift)
    const existing = findEmployeesByNameAndShift(employees, name, shift)
    const canonical = pickBestScheduleEmployee(existing)
    const merged: NonNullable<ScheduleAiResult["employee_updates"]>[number] = {
      name,
      match: {
        name,
        ...(canonical ? { id: canonical.id } : {}),
      },
      days: mergeDayPatches(updatesByKey.get(key)?.days, update.days),
    }
    updatesByKey.set(key, merged)
  }

  const addsByKey = new Map<
    string,
    NonNullable<ScheduleAiResult["add_employees"]>[number]
  >()

  for (const add of plan.add_employees ?? []) {
    const name = add.name.trim()
    if (!name) continue
    const shift = add.shift ?? "manana"
    const key = scheduleEmployeeKey(name, shift)
    const existing = findEmployeesByNameAndShift(employees, name, shift)

    if (existing.length > 0) {
      const canonical = pickBestScheduleEmployee(existing)!
      const prev = updatesByKey.get(key)
      updatesByKey.set(key, {
        name,
        match: { name, id: canonical.id },
        days: mergeDayPatches(prev?.days, add.days),
      })
      continue
    }

    const prev = addsByKey.get(key)
    addsByKey.set(key, {
      name,
      shift,
      days: mergeDayPatches(prev?.days, add.days),
    })
  }

  plan.add_employees =
    addsByKey.size > 0 ? [...addsByKey.values()] : undefined
  if (plan.add_employees?.length === 0) delete plan.add_employees

  if (updatesByKey.size > 0) {
    plan.employee_updates = [...updatesByKey.values()]
  }

  return plan
}

export function findScheduleEmployee(
  employees: StaffScheduleEmployeeRow[],
  match: ScheduleAiEmployeeMatch,
  shift?: ScheduleShiftKey,
): StaffScheduleEmployeeRow | undefined {
  if (match.name?.trim()) {
    const target = normalizeName(match.name)
    const inShift = shift
      ? employees.filter((e) => (e.shift ?? "manana") === shift)
      : employees
    const exact = inShift.filter((e) => normalizeName(e.name) === target)
    if (exact.length > 0) return pickBestScheduleEmployee(exact)
    const fuzzy = inShift.filter((e) => {
      const n = normalizeName(e.name)
      return n.includes(target) || target.includes(n)
    })
    if (fuzzy.length > 0) return pickBestScheduleEmployee(fuzzy)
  }

  if (match.id) {
    const byId = employees.find((e) => e.id === match.id)
    if (byId) {
      if (match.name?.trim()) {
        const name = match.name.trim()
        const shiftKey = (byId.shift ?? "manana") as ScheduleShiftKey
        const sameName = findEmployeesByNameAndShift(employees, name, shiftKey)
        const canonical = pickBestScheduleEmployee(sameName)
        if (canonical && canonical.id !== byId.id) return canonical
      }
      return byId
    }
  }

  return undefined
}
