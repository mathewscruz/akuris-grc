ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS jurisdicao text;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_jurisdicao_check
  CHECK (jurisdicao IS NULL OR jurisdicao IN ('BR', 'PT_EU', 'INTL'));

COMMENT ON COLUMN public.empresas.jurisdicao IS 'Regime de proteção de dados: BR (LGPD), PT_EU (RGPD) ou INTL (GDPR/internacional). NULL = inferido pelo idioma/fuso do utilizador.';