INSERT INTO public.ai_settings (setting_key, setting_value, description)
VALUES
  (
    'elevenlabs_stt_model',
    'scribe_v2',
    'Speech-to-text model for portal voice orders (ElevenLabs Scribe).'
  )
ON CONFLICT (setting_key) DO NOTHING;
