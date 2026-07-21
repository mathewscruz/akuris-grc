-- Programa de Implementação: orçamento por fase + ferramentas técnicas a contratar.

-- 1. Orçamento por fase (quanto o usuário quer gastar em cada fase)
ALTER TABLE public.programa_fases ADD COLUMN IF NOT EXISTS orcamento NUMERIC;

-- 2. Ferramentas técnicas que a empresa está ou irá contratar para se adequar
CREATE TABLE IF NOT EXISTS public.programa_ferramentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  programa_id UUID NOT NULL REFERENCES public.implementacao_programas(id) ON DELETE CASCADE,
  fase_id UUID REFERENCES public.programa_fases(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  fornecedor TEXT,
  custo NUMERIC,
  recorrencia TEXT NOT NULL DEFAULT 'anual',   -- unica | mensal | anual
  status TEXT NOT NULL DEFAULT 'planejada',      -- planejada | avaliando | contratada
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prog_ferramentas_programa ON public.programa_ferramentas(programa_id);

ALTER TABLE public.programa_ferramentas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programa_ferramentas_select" ON public.programa_ferramentas;
CREATE POLICY "programa_ferramentas_select" ON public.programa_ferramentas FOR SELECT USING (empresa_id = public.get_user_empresa_id());
DROP POLICY IF EXISTS "programa_ferramentas_insert" ON public.programa_ferramentas;
CREATE POLICY "programa_ferramentas_insert" ON public.programa_ferramentas FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id());
DROP POLICY IF EXISTS "programa_ferramentas_update" ON public.programa_ferramentas;
CREATE POLICY "programa_ferramentas_update" ON public.programa_ferramentas FOR UPDATE USING (empresa_id = public.get_user_empresa_id()) WITH CHECK (empresa_id = public.get_user_empresa_id());
DROP POLICY IF EXISTS "programa_ferramentas_delete" ON public.programa_ferramentas;
CREATE POLICY "programa_ferramentas_delete" ON public.programa_ferramentas FOR DELETE USING (empresa_id = public.get_user_empresa_id());

DROP TRIGGER IF EXISTS trg_prog_ferramentas_updated ON public.programa_ferramentas;
CREATE TRIGGER trg_prog_ferramentas_updated BEFORE UPDATE ON public.programa_ferramentas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
