/** Web Speech API dictation (Chrome / Safari). Primary portal STT when ElevenLabs is unavailable. */

type SpeechRecognitionCtor = new () => SpeechRecognition

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isBrowserSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null
}

const LANG_CANDIDATES = ["es-MX", "es-ES", "es-US", "es"]

export type BrowserSpeechSession = {
  /** Tap mic again (or square button) to finish and send. */
  stop: () => void
  done: Promise<string>
}

export function startBrowserSpeechSession(
  timeoutMs = 60_000,
): BrowserSpeechSession {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) {
    return {
      stop: () => {},
      done: Promise.reject(
        new Error(
          "Dictado del navegador no disponible. Usa Chrome o Safari, o habilita speech_to_text en tu clave de ElevenLabs.",
        ),
      ),
    }
  }

  let settled = false
  let transcript = ""
  let langIndex = 0
  let userStopped = false
  let recognition: SpeechRecognition

  const finish = (fn: () => void) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    fn()
  }

  let resolveDone!: (value: string) => void
  let rejectDone!: (reason: Error) => void
  const done = new Promise<string>((resolve, reject) => {
    resolveDone = resolve
    rejectDone = reject
  })

  const timer = setTimeout(() => {
    try {
      recognition.abort()
    } catch {
      /* ignore */
    }
    finish(() => {
      if (transcript.trim()) resolveDone(transcript.trim())
      else {
        rejectDone(
          new Error("Tiempo agotado. Habla el pedido y vuelve a intentar."),
        )
      }
    })
  }, timeoutMs)

  const applyLang = () => {
    recognition.lang = LANG_CANDIDATES[langIndex] ?? "es-MX"
  }

  const completeWithTranscript = () => {
    const text = transcript.trim()
    if (text) {
      finish(() => resolveDone(text))
      return true
    }
    return false
  }

  recognition = new Ctor()
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    transcript = Array.from(event.results)
      .map((r) => r[0]?.transcript ?? "")
      .join("")
      .trim()
    const last = event.results[event.results.length - 1]
    if (last?.isFinal && transcript) {
      finish(() => resolveDone(transcript))
    }
  }

  recognition.onerror = (event) => {
    const code = event.error
    if (
      code === "language-not-supported" &&
      langIndex < LANG_CANDIDATES.length - 1
    ) {
      langIndex += 1
      applyLang()
      try {
        recognition.start()
      } catch {
        finish(() =>
          rejectDone(new Error("No se pudo iniciar el dictado del navegador.")),
        )
      }
      return
    }
    if (code === "aborted" && userStopped) {
      return
    }
    finish(() => {
      if (code === "not-allowed" || code === "service-not-allowed") {
        rejectDone(new Error("Permite el micrófono para dictar el pedido."))
      } else if (code === "no-speech") {
        rejectDone(new Error("No se escuchó nada. Intenta de nuevo."))
      } else if (code !== "aborted") {
        rejectDone(new Error("Error de dictado del navegador."))
      }
    })
  }

  recognition.onend = () => {
    if (settled) return
    if (completeWithTranscript()) return
    finish(() => {
      if (userStopped) {
        rejectDone(new Error("Dictado cancelado."))
      } else {
        rejectDone(
          new Error("No se detectó texto. Habla más cerca del micrófono."),
        )
      }
    })
  }

  const stop = () => {
    if (settled) return
    userStopped = true
    try {
      recognition.stop()
    } catch {
      try {
        recognition.abort()
      } catch {
        /* ignore */
      }
    }
  }

  applyLang()
  try {
    recognition.start()
  } catch {
    finish(() =>
      rejectDone(new Error("No se pudo iniciar el dictado. Intenta de nuevo.")),
    )
  }

  return { stop, done }
}

/** @deprecated Use startBrowserSpeechSession for tap-to-stop control. */
export function listenWithBrowserSpeech(timeoutMs?: number): Promise<string> {
  const session = startBrowserSpeechSession(timeoutMs)
  return session.done
}
