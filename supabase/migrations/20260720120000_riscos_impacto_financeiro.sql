-- Exposição financeira do risco: impacto financeiro estimado (perda potencial).
-- Usado, junto da probabilidade, para calcular a exposição em moeda e permitir
-- priorização por valor (não só por cor/severidade).
ALTER TABLE public.riscos
  ADD COLUMN IF NOT EXISTS impacto_financeiro numeric;

COMMENT ON COLUMN public.riscos.impacto_financeiro IS
  'Impacto financeiro estimado (perda potencial) em moeda local. Exposição = impacto_financeiro × fator de probabilidade.';
