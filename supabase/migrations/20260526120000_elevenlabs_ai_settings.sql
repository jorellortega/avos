-- ElevenLabs text-to-speech (CEO configures at /ai-settings).

INSERT INTO public.ai_settings (setting_key, setting_value, description)
VALUES
  (
    'elevenlabs_api_key',
    '',
    'API key from elevenlabs.io → Profile → API keys. Used for voice synthesis.'
  ),
  (
    'elevenlabs_voice_id',
    '',
    'Voice ID from ElevenLabs → Voices (e.g. Rachel, Adam). Required for TTS.'
  ),
  (
    'elevenlabs_model',
    'eleven_multilingual_v2',
    'TTS model: multilingual v2 (quality), turbo v2.5 (faster), or flash v2.5 (low latency).'
  )
ON CONFLICT (setting_key) DO NOTHING;
