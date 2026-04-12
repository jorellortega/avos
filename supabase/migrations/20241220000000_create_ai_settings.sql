-- AI settings storage + RPC for server-side chat (run in Supabase SQL editor or via CLI)

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ai_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DROP TRIGGER IF EXISTS set_ai_settings_updated_at ON public.ai_settings;
CREATE TRIGGER set_ai_settings_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

INSERT INTO public.ai_settings (setting_key, setting_value, description)
VALUES
  ('openai_api_key', '', 'OpenAI API key for the Avos assistant.'),
  ('openai_model', 'gpt-4o-mini', 'Default OpenAI model.'),
  ('anthropic_api_key', '', 'Anthropic API key for optional fallback.'),
  ('anthropic_model', 'claude-3-5-sonnet-20241022', 'Default Anthropic model when configured.'),
  ('system_prompt', $prompt$### Role
You are the friendly assistant for Avos Mexican Grill. Help guests with the menu (tacos, tortas, burritos, quesadillas, platillos), proteins (asada, pollo, pastor, camarón), ordering options (comer aquí, para llevar), and general questions. Keep answers concise, warm, and accurate. If you do not know something specific about the restaurant, say so and suggest they ask staff.$prompt$, 'System prompt for the Avos assistant.')
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- CEO-only direct table access (matches app_metadata or user_metadata role)
CREATE POLICY "CEO can select ai_settings"
  ON public.ai_settings
  FOR SELECT
  TO authenticated
  USING (
    COALESCE((auth.jwt()->'user_metadata'->>'role'), '') = 'ceo'
    OR COALESCE((auth.jwt()->'app_metadata'->>'role'), '') = 'ceo'
  );

CREATE POLICY "CEO can insert ai_settings"
  ON public.ai_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt()->'user_metadata'->>'role'), '') = 'ceo'
    OR COALESCE((auth.jwt()->'app_metadata'->>'role'), '') = 'ceo'
  );

CREATE POLICY "CEO can update ai_settings"
  ON public.ai_settings
  FOR UPDATE
  TO authenticated
  USING (
    COALESCE((auth.jwt()->'user_metadata'->>'role'), '') = 'ceo'
    OR COALESCE((auth.jwt()->'app_metadata'->>'role'), '') = 'ceo'
  )
  WITH CHECK (
    COALESCE((auth.jwt()->'user_metadata'->>'role'), '') = 'ceo'
    OR COALESCE((auth.jwt()->'app_metadata'->>'role'), '') = 'ceo'
  );

CREATE OR REPLACE FUNCTION public.get_ai_settings()
RETURNS SETOF public.ai_settings
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.ai_settings;
$$;

REVOKE ALL ON FUNCTION public.get_ai_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_settings() TO service_role;
