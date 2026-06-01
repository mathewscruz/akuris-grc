
-- =========================================
-- PROJETOS — FASE 2 (Automações, Templates, SLA)
-- =========================================

-- 1) AUTOMAÇÕES
CREATE TABLE IF NOT EXISTS public.projeto_automacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  gatilho TEXT NOT NULL,           -- ex: tarefa_movida_para_coluna | prazo_vencido | sla_em_risco | tarefa_criada
  condicoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  acoes JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ex: [{tipo:'mover_para_coluna',coluna_id:'..'},{tipo:'notificar',user_id:'..'}]
  ativa BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID,
  ultima_execucao_em TIMESTAMPTZ,
  execucoes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projeto_automacoes_empresa ON public.projeto_automacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_projeto_automacoes_projeto ON public.projeto_automacoes(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_automacoes_gatilho ON public.projeto_automacoes(gatilho) WHERE ativa = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_automacoes TO authenticated;
GRANT ALL ON public.projeto_automacoes TO service_role;

ALTER TABLE public.projeto_automacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projeto_automacoes_all" ON public.projeto_automacoes
  FOR ALL TO authenticated
  USING (
    empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.projeto_membros pm WHERE pm.projeto_id = projeto_automacoes.projeto_id AND pm.user_id = auth.uid())
    )
  )
  WITH CHECK (
    empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE TRIGGER trg_projeto_automacoes_updated
  BEFORE UPDATE ON public.projeto_automacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) TEMPLATES DE PROJETO
CREATE TABLE IF NOT EXISTS public.projeto_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE, -- NULL = template global (super_admin)
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,                  -- ex: 'compliance', 'auditoria', 'incidente'
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {colunas:[...], tarefas:[...]}
  is_global BOOLEAN NOT NULL DEFAULT false,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projeto_templates_empresa ON public.projeto_templates(empresa_id);
CREATE INDEX IF NOT EXISTS idx_projeto_templates_global ON public.projeto_templates(is_global) WHERE is_global = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_templates TO authenticated;
GRANT ALL ON public.projeto_templates TO service_role;

ALTER TABLE public.projeto_templates ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem LER templates globais ou da própria empresa
CREATE POLICY "projeto_templates_select" ON public.projeto_templates
  FOR SELECT TO authenticated
  USING (
    is_global = true
    OR empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Apenas admins/super_admins podem gerenciar
CREATE POLICY "projeto_templates_insert" ON public.projeto_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    (is_global = true AND public.has_role(auth.uid(), 'super_admin'))
    OR (
      empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid())
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
    )
  );

CREATE POLICY "projeto_templates_update" ON public.projeto_templates
  FOR UPDATE TO authenticated
  USING (
    (is_global = true AND public.has_role(auth.uid(), 'super_admin'))
    OR (
      empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid())
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
    )
  );

CREATE POLICY "projeto_templates_delete" ON public.projeto_templates
  FOR DELETE TO authenticated
  USING (
    (is_global = true AND public.has_role(auth.uid(), 'super_admin'))
    OR (
      empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid())
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
    )
  );

CREATE TRIGGER trg_projeto_templates_updated
  BEFORE UPDATE ON public.projeto_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) SLA + Origem em projeto_tarefas
ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS sla_horas INTEGER,
  ADD COLUMN IF NOT EXISTS sla_status TEXT NOT NULL DEFAULT 'no_prazo' CHECK (sla_status IN ('no_prazo','em_risco','violado','sem_sla')),
  ADD COLUMN IF NOT EXISTS sla_violado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS origem_tipo TEXT,
  ADD COLUMN IF NOT EXISTS origem_id UUID;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_sla_status ON public.projeto_tarefas(sla_status);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_origem ON public.projeto_tarefas(origem_tipo, origem_id);

-- 4) Templates iniciais (seeds globais)
INSERT INTO public.projeto_templates (nome, descricao, categoria, is_global, dados)
VALUES
  ('Plano de Remediação de Gap', 'Estrutura padrão para tratar não-conformidades de Gap Analysis', 'compliance', true,
   '{"colunas":[{"nome":"Backlog","ordem":0},{"nome":"Em análise","ordem":1},{"nome":"Em execução","ordem":2},{"nome":"Validação","ordem":3},{"nome":"Concluído","ordem":4,"is_concluido":true}],"tarefas":[{"titulo":"Diagnóstico inicial","prioridade":"alta"},{"titulo":"Definir plano de ação","prioridade":"alta"},{"titulo":"Implementar controle","prioridade":"media"},{"titulo":"Validar evidências","prioridade":"alta"}]}'::jsonb),
  ('Resposta a Incidente', 'Resposta rápida a incidente de segurança', 'incidente', true,
   '{"colunas":[{"nome":"Triagem","ordem":0},{"nome":"Contenção","ordem":1},{"nome":"Erradicação","ordem":2},{"nome":"Recuperação","ordem":3},{"nome":"Lições aprendidas","ordem":4,"is_concluido":true}],"tarefas":[{"titulo":"Classificar severidade","prioridade":"critica"},{"titulo":"Conter incidente","prioridade":"critica"},{"titulo":"Remover causa raiz","prioridade":"alta"},{"titulo":"Documentar lições","prioridade":"media"}]}'::jsonb),
  ('Auditoria Interna', 'Workflow padrão para condução de auditoria', 'auditoria', true,
   '{"colunas":[{"nome":"Planejamento","ordem":0},{"nome":"Execução","ordem":1},{"nome":"Achados","ordem":2},{"nome":"Resposta","ordem":3},{"nome":"Encerrado","ordem":4,"is_concluido":true}],"tarefas":[{"titulo":"Definir escopo","prioridade":"alta"},{"titulo":"Coletar evidências","prioridade":"media"},{"titulo":"Documentar achados","prioridade":"alta"}]}'::jsonb)
ON CONFLICT DO NOTHING;
