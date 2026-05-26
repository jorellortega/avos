import { isBrowserSpeechRecognitionSupported } from "@/lib/browser-speech-recognition"

/** When true, portal mic uploads audio to ElevenLabs STT (requires speech_to_text on API key). */
export function portalPrefersElevenLabsStt(): boolean {
  return process.env.NEXT_PUBLIC_PORTAL_STT_PROVIDER === "elevenlabs"
}

export function portalShouldUseBrowserStt(
  preferBrowserFromSession = false,
): boolean {
  if (preferBrowserFromSession) {
    return isBrowserSpeechRecognitionSupported()
  }
  if (portalPrefersElevenLabsStt()) return false
  return isBrowserSpeechRecognitionSupported()
}
