import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

export async function GET() {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("ordering_settings")
      .select("ordering_enabled, closed_message")
      .eq("id", 1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ enabled: true, message: "" }, { status: 200 })
    }

    return NextResponse.json(
      {
        enabled: Boolean(data?.ordering_enabled ?? true),
        message: String(data?.closed_message ?? ""),
      },
      { status: 200 },
    )
  } catch {
    return NextResponse.json({ enabled: true, message: "" }, { status: 200 })
  }
}

