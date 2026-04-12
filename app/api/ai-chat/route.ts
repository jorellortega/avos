import { NextResponse } from 'next/server'
import type { AIMessage, AISettingsMap } from '@/lib/ai-types'
import { createServiceRoleClient } from '@/lib/supabase-server'

const MAX_MESSAGE_LEN = 8000

function mapSettings(
  rows: { setting_key: string; setting_value: string }[] | null,
): AISettingsMap {
  const out: AISettingsMap = {}
  if (!rows) return out
  for (const row of rows) {
    out[row.setting_key] = row.setting_value
  }
  return out
}

function sanitizeHistory(raw: unknown): AIMessage[] {
  if (!Array.isArray(raw)) return []
  const out: AIMessage[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const role = (item as { role?: string }).role
    const content = (item as { content?: string }).content
    if (role !== 'user' && role !== 'assistant') continue
    if (typeof content !== 'string' || !content.trim()) continue
    out.push({ role, content: content.trim() })
    if (out.length >= 40) break
  }
  return out
}

async function callOpenAI(
  messages: AIMessage[],
  settings: AISettingsMap,
): Promise<{ message: string } | null> {
  const key = settings['openai_api_key']?.trim()
  if (!key) return null
  const model = settings['openai_model']?.trim() || 'gpt-4o-mini'
  const openaiMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('OpenAI error', res.status, err)
    return null
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) return null
  return { message: content }
}

async function callAnthropic(
  messages: AIMessage[],
  settings: AISettingsMap,
  systemPrompt: string | undefined,
): Promise<{ message: string } | null> {
  const key = settings['anthropic_api_key']?.trim()
  if (!key) return null
  const model =
    settings['anthropic_model']?.trim() || 'claude-3-5-sonnet-20241022'
  const conversation = messages.filter((m) => m.role !== 'system')
  const anthropicMessages = conversation.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: anthropicMessages,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Anthropic error', res.status, err)
    return null
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[]
  }
  const text = data?.content?.find((b) => b.type === 'text')?.text?.trim()
  if (!text) return null
  return { message: text }
}

export async function POST(req: Request) {
  let body: { message?: string; conversationHistory?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
  }

  const rawMessage = typeof body.message === 'string' ? body.message.trim() : ''
  if (!rawMessage) {
    return NextResponse.json({ error: 'Escribe un mensaje.' }, { status: 400 })
  }
  if (rawMessage.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: 'Mensaje demasiado largo.' }, { status: 400 })
  }

  const conversationHistory = sanitizeHistory(body.conversationHistory)

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error('Supabase client', e)
    return NextResponse.json(
      { error: 'El asistente no está configurado en el servidor.' },
      { status: 503 },
    )
  }

  const { data: settingsData, error: settingsError } =
    await supabase.rpc('get_ai_settings')
  if (settingsError) {
    console.error('get_ai_settings', settingsError)
    return NextResponse.json(
      { error: 'No se pudo cargar la configuración de IA.' },
      { status: 503 },
    )
  }

  const settings = mapSettings(settingsData as { setting_key: string; setting_value: string }[] | null)
  const systemPrompt = settings['system_prompt']?.trim()

  const messages: AIMessage[] = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push(...conversationHistory, { role: 'user', content: rawMessage })

  let responsePayload = await callOpenAI(messages, settings)
  if (!responsePayload) {
    responsePayload = await callAnthropic(messages, settings, systemPrompt)
  }

  if (!responsePayload) {
    return NextResponse.json(
      {
        error:
          'El asistente no está disponible. Comprueba las claves de API en Supabase o inténtalo más tarde.',
      },
      { status: 502 },
    )
  }

  const cleaned = responsePayload.message.replace(/\*\*(.*?)\*\*/g, '$1')
  return NextResponse.json({ message: cleaned })
}
