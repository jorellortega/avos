import { NextResponse } from "next/server"
import {
  SCHEDULE_AI_ROW_SYSTEM_PROMPT,
  SCHEDULE_AI_SYSTEM_PROMPT,
  buildScheduleAiContext,
  buildScheduleAiRowContext,
  normalizeScheduleAiPlan,
  normalizeScheduleAiRowPlan,
  parseScheduleAiJson,
} from "@/lib/schedule-ai"
import type {
  StaffScheduleEmployeeRow,
  StaffScheduleRow,
} from "@/lib/schedule-types"
import { isManagerOrCeo } from "@/lib/profile-types"
import { callPortalAiJson, loadPortalAiSettings } from "@/lib/portal-ai-request"
import { createServerSupabase } from "@/lib/supabase/server"

const MAX_INSTRUCTIONS_LEN = 4000

export async function POST(req: Request) {
  let body: {
    instructions?: string
    schedule?: StaffScheduleRow
    employees?: StaffScheduleEmployeeRow[]
    focusEmployeeId?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (!isManagerOrCeo(profile?.role)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 })
  }

  const instructions =
    typeof body.instructions === "string" ? body.instructions.trim() : ""
  if (!instructions) {
    return NextResponse.json(
      { error: "Escribe las instrucciones para la IA." },
      { status: 400 },
    )
  }
  if (instructions.length > MAX_INSTRUCTIONS_LEN) {
    return NextResponse.json(
      { error: `Máximo ${MAX_INSTRUCTIONS_LEN} caracteres.` },
      { status: 400 },
    )
  }

  const schedule = body.schedule
  const employees = Array.isArray(body.employees) ? body.employees : []
  if (!schedule?.id || typeof schedule.title !== "string") {
    return NextResponse.json({ error: "Horario no válido." }, { status: 400 })
  }

  const focusEmployeeId =
    typeof body.focusEmployeeId === "string" ? body.focusEmployeeId.trim() : ""
  const focusEmployee = focusEmployeeId
    ? employees.find((e) => e.id === focusEmployeeId)
    : undefined

  if (focusEmployeeId && !focusEmployee) {
    return NextResponse.json(
      { error: "Empleado no encontrado en esta lista." },
      { status: 400 },
    )
  }

  const settings = await loadPortalAiSettings()
  if (
    !settings.openai_api_key?.trim() &&
    !settings.anthropic_api_key?.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "Configura OpenAI o Anthropic en Ajustes de IA (/ai-settings).",
      },
      { status: 503 },
    )
  }

  const rowMode = Boolean(focusEmployee)
  const context = rowMode
    ? buildScheduleAiRowContext(schedule, focusEmployee!)
    : buildScheduleAiContext(schedule, employees)
  const userPrompt = rowMode
    ? `${context}\n\nInstrucciones del manager (solo esta fila):\n${instructions}`
    : `Contexto actual del horario:\n${context}\n\nInstrucciones del manager:\n${instructions}`

  const raw = await callPortalAiJson(
    rowMode ? SCHEDULE_AI_ROW_SYSTEM_PROMPT : SCHEDULE_AI_SYSTEM_PROMPT,
    userPrompt,
    settings,
    4096,
  )

  if (!raw) {
    return NextResponse.json(
      { error: "La IA no respondió. Revisa la clave API o intenta de nuevo." },
      { status: 502 },
    )
  }

  const parsed = parseScheduleAiJson(raw)

  if (parsed) {
    if (rowMode && focusEmployee) {
      normalizeScheduleAiRowPlan(parsed, focusEmployee, instructions)
    } else {
      normalizeScheduleAiPlan(parsed, instructions, employees)
    }
  }

  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "No se pudo interpretar la respuesta de la IA. Intenta ser más específico.",
        raw,
      },
      { status: 422 },
    )
  }

  return NextResponse.json({ plan: parsed })
}
