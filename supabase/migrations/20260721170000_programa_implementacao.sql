-- Programa de Implementação: acompanhamento da jornada de adequação a um framework
-- (fases, itens/tarefas com esforço, custo, ferramenta, prazo, responsável e vínculos
-- com outros módulos). Multi-tenant por empresa_id via get_user_empresa_id().

-- 1. Programa (um por framework em implementação)
CREATE TABLE IF NOT EXISTS public.implementacao_programas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  framework_id UUID REFERENCES public.gap_analysis_frameworks(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  data_alvo DATE,
  orcamento_total NUMERIC,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Fases (ondas) do programa
CREATE TABLE IF NOT EXISTS public.programa_fases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  programa_id UUID NOT NULL REFERENCES public.implementacao_programas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Itens/tarefas (o que fazer para atender cada controle/requisito)
CREATE TABLE IF NOT EXISTS public.programa_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  programa_id UUID NOT NULL REFERENCES public.implementacao_programas(id) ON DELETE CASCADE,
  fase_id UUID REFERENCES public.programa_fases(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  -- vínculos com outros módulos (todos opcionais)
  requirement_id UUID,
  controle_id UUID,
  plano_acao_id UUID,
  responsavel_id UUID,
  prazo DATE,
  esforco TEXT,            -- baixo | medio | alto
  impacto TEXT,            -- baixo | medio | alto
  custo_estimado NUMERIC,
  ferramenta_sugerida TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',  -- pendente | em_andamento | concluido
  ordem INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prog_empresa ON public.implementacao_programas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_prog_fases_programa ON public.programa_fases(programa_id);
CREATE INDEX IF NOT EXISTS idx_prog_itens_programa ON public.programa_itens(programa_id);
CREATE INDEX IF NOT EXISTS idx_prog_itens_fase ON public.programa_itens(fase_id);

-- RLS multi-tenant (mesmo padrão do resto do sistema)
ALTER TABLE public.implementacao_programas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programa_fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programa_itens ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['implementacao_programas','programa_fases','programa_itens'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "%1$s_select" ON public.%1$s FOR SELECT USING (empresa_id = public.get_user_empresa_id());', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_insert" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "%1$s_insert" ON public.%1$s FOR INSERT WITH CHECK (empresa_id = public.get_user_empresa_id());', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_update" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "%1$s_update" ON public.%1$s FOR UPDATE USING (empresa_id = public.get_user_empresa_id()) WITH CHECK (empresa_id = public.get_user_empresa_id());', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_delete" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "%1$s_delete" ON public.%1$s FOR DELETE USING (empresa_id = public.get_user_empresa_id());', t);
  END LOOP;
END $$;

-- Trigger updated_at (função já existe no schema)
DROP TRIGGER IF EXISTS trg_prog_updated ON public.implementacao_programas;
CREATE TRIGGER trg_prog_updated BEFORE UPDATE ON public.implementacao_programas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_prog_fases_updated ON public.programa_fases;
CREATE TRIGGER trg_prog_fases_updated BEFORE UPDATE ON public.programa_fases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_prog_itens_updated ON public.programa_itens;
CREATE TRIGGER trg_prog_itens_updated BEFORE UPDATE ON public.programa_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
