import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { isStaffOrdersRole } from "@/lib/profile-types"

export async function requirePortalStaff() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json({ error: "Inicia sesión de personal." }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || !isStaffOrdersRole(profile.role)) {
    return {
      error: NextResponse.json({ error: "Sin permiso de personal." }, { status: 403 }),
    }
  }

  return { user, profile }
}

export async function loadPortalAiSettings(): Promise<Record<string, string>> {
  const settings: Record<string, string> = {}
  try {
    const service = createServiceRoleClient()
    const { data, error } = await service.rpc("get_ai_settings")
    if (!error && Array.isArray(data)) {
      for (const row of data as { setting_key: string; setting_value: string }[]) {
        if (row?.setting_key) settings[row.setting_key] = row.setting_value ?? ""
      }
    }
  } catch (e) {
    console.error("portal ai settings", e)
  }
  return settings
}

export async function callOpenAIJson(
  system: string,
  user: string,
  apiKey: string,
  model: string,
): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })
  if (!res.ok) {
    console.error("portal ai OpenAI", res.status, await res.text())
    return null
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return data?.choices?.[0]?.message?.content?.trim() ?? null
}

export async function callAnthropicJson(
  system: string,
  user: string,
  apiKey: string,
  model: string,
): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: user }],
    }),
  })
  if (!res.ok) {
    console.error("portal ai Anthropic", res.status, await res.text())
    return null
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[]
  }
  return data?.content?.find((b) => b.type === "text")?.text?.trim() ?? null
}

export function parseAiJsonObject<T>(raw: string): T | null {
  try {
    const j = JSON.parse(raw) as T
    if (!j || typeof j !== "object") return null
    return j
  } catch {
    const start = raw.indexOf("{")
    const end = raw.lastIndexOf("}")
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(raw.slice(start, end + 1)) as T
    } catch {
      return null
    }
  }
}

export async function callPortalAiJson(
  system: string,
  user: string,
  settings: Record<string, string>,
): Promise<string | null> {
  const openaiKey = settings.openai_api_key?.trim()
  const anthropicKey = settings.anthropic_api_key?.trim()
  if (!openaiKey && !anthropicKey) return null

  if (openaiKey) {
    const raw = await callOpenAIJson(
      system,
      user,
      openaiKey,
      settings.openai_model?.trim() || "gpt-4o-mini",
    )
    if (raw) return raw
  }
  if (anthropicKey) {
    return callAnthropicJson(
      system + "\n\nResponde solo JSON, sin texto extra.",
      user,
      anthropicKey,
      settings.anthropic_model?.trim() || "claude-3-5-sonnet-20241022",
    )
  }
  return null
}
