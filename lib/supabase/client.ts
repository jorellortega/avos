import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

type AuthLockFn = <R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
) => Promise<R>

/**
 * Serialize auth in one tab. Avoids navigator.locks deadlocks when many
 * components mount (React Strict Mode) or multiple clients were created.
 */
let authLockTail: Promise<unknown> = Promise.resolve()

const inProcessAuthLock: AuthLockFn = async (_name, _acquireTimeout, fn) => {
  const run = authLockTail.then(fn, fn)
  authLockTail = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

let browserClient: SupabaseClient | undefined

export function createBrowserSupabase(): SupabaseClient {
  if (typeof window !== "undefined" && browserClient) {
    return browserClient
  }

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: inProcessAuthLock,
      },
    },
  )

  if (typeof window !== "undefined") {
    browserClient = client
  }

  return client
}
