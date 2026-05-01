-- Printable QR targets for promos, homepage, etc. Editable by manager + CEO only.

CREATE TABLE IF NOT EXISTS public.site_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  -- Full URL (https://...) or site path starting with / (e.g. /, /cuenta/ofertas)
  target_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS site_barcodes_sort_idx ON public.site_barcodes (sort_order, id);

DROP TRIGGER IF EXISTS set_site_barcodes_updated_at ON public.site_barcodes;
CREATE TRIGGER set_site_barcodes_updated_at
  BEFORE UPDATE ON public.site_barcodes
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.site_barcodes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.jwt_user_is_manager_or_ceo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN (
        'manager'::public.app_user_role,
        'ceo'::public.app_user_role
      )
  );
$$;

REVOKE ALL ON FUNCTION public.jwt_user_is_manager_or_ceo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jwt_user_is_manager_or_ceo() TO authenticated;

CREATE POLICY "Manager or CEO can read site_barcodes"
  ON public.site_barcodes FOR SELECT
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo());

CREATE POLICY "Manager or CEO can insert site_barcodes"
  ON public.site_barcodes FOR INSERT
  TO authenticated
  WITH CHECK (public.jwt_user_is_manager_or_ceo());

CREATE POLICY "Manager or CEO can update site_barcodes"
  ON public.site_barcodes FOR UPDATE
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo())
  WITH CHECK (public.jwt_user_is_manager_or_ceo());

CREATE POLICY "Manager or CEO can delete site_barcodes"
  ON public.site_barcodes FOR DELETE
  TO authenticated
  USING (public.jwt_user_is_manager_or_ceo());

COMMENT ON TABLE public.site_barcodes IS 'QR code targets for print materials; managed at /barcodes.';

INSERT INTO public.site_barcodes (label, target_url, enabled, sort_order)
SELECT 'Página principal', '/', true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.site_barcodes LIMIT 1);
