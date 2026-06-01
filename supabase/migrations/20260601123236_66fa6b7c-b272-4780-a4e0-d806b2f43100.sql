
-- ============================================================
-- MÓDULO PROJETOS — Gestão de Atividades (Jira/ClickUp-like)
-- ============================================================

-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.projeto_status AS ENUM ('ativo', 'pausado', 'concluido', 'arquivado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.projeto_membro_papel AS ENUM ('owner', 'admin', 'membro', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.projeto_tarefa_prioridade AS ENUM ('baixa', 'media', 'alta', 'critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.projeto_dependencia_tipo AS ENUM ('FS', 'SS', 'FF', 'SF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.projeto_vinculo_entidade AS ENUM (
    'risco', 'controle', 'incidente', 'auditoria', 'auditoria_item',
    'gap_requirement', 'gap_assessment', 'contrato', 'fornecedor',
    'due_diligence', 'documento', 'ativo', 'denuncia', 'plano_acao',
    'dados_pessoais', 'conta_privilegiada', 'continuidade'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 1. PROJETOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  status public.projeto_status NOT NULL DEFAULT 'ativo',
  owner_id uuid NOT NULL,
  data_inicio date,
  data_fim_prevista date,
  cor text DEFAULT '#7552FF',
  icone text DEFAULT 'kanban',
  configuracoes jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projetos_empresa ON public.projetos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_projetos_owner ON public.projetos(owner_id);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON public.projetos(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT ALL ON public.projetos TO service_role;

ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. PROJETO_MEMBROS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  papel public.projeto_membro_papel NOT NULL DEFAULT 'membro',
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(projeto_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_projeto_membros_projeto ON public.projeto_membros(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_membros_user ON public.projeto_membros(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_membros TO authenticated;
GRANT ALL ON public.projeto_membros TO service_role;

ALTER TABLE public.projeto_membros ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Funções SECURITY DEFINER (evitar recursão RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_projeto_member(_projeto_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_membros
    WHERE projeto_id = _projeto_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.projeto_pertence_empresa(_projeto_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projetos
    WHERE id = _projeto_id AND empresa_id = public.get_user_empresa_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_projeto(_projeto_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.projeto_pertence_empresa(_projeto_id)
    AND (
      public.is_admin_or_super_admin()
      OR public.is_projeto_member(_projeto_id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.projetos WHERE id = _projeto_id AND owner_id = auth.uid())
    );
$$;

-- ============================================================
-- 3. PROJETO_COLUNAS (Kanban)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_colunas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  cor text DEFAULT '#64748b',
  wip_limit int,
  is_concluido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_colunas_projeto ON public.projeto_colunas(projeto_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_colunas TO authenticated;
GRANT ALL ON public.projeto_colunas TO service_role;

ALTER TABLE public.projeto_colunas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. PROJETO_TAREFAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  coluna_id uuid REFERENCES public.projeto_colunas(id) ON DELETE SET NULL,
  parent_task_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  prioridade public.projeto_tarefa_prioridade NOT NULL DEFAULT 'media',
  responsavel_id uuid,
  criador_id uuid,
  data_inicio date,
  data_fim date,
  prazo timestamptz,
  estimativa_horas numeric(8,2),
  tempo_gasto_horas numeric(8,2) DEFAULT 0,
  progresso_pct int NOT NULL DEFAULT 0 CHECK (progresso_pct BETWEEN 0 AND 100),
  tags text[] DEFAULT '{}',
  ordem int NOT NULL DEFAULT 0,
  bloqueada boolean NOT NULL DEFAULT false,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_projeto ON public.projeto_tarefas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_coluna ON public.projeto_tarefas(coluna_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_responsavel ON public.projeto_tarefas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_parent ON public.projeto_tarefas(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_prazo ON public.projeto_tarefas(prazo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefas TO authenticated;
GRANT ALL ON public.projeto_tarefas TO service_role;

ALTER TABLE public.projeto_tarefas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. SEGUIDORES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_seguidores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tarefa_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_seguidores_tarefa ON public.projeto_tarefa_seguidores(tarefa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefa_seguidores TO authenticated;
GRANT ALL ON public.projeto_tarefa_seguidores TO service_role;

ALTER TABLE public.projeto_tarefa_seguidores ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. DEPENDÊNCIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_dependencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  depende_de_tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  tipo public.projeto_dependencia_tipo NOT NULL DEFAULT 'FS',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tarefa_id, depende_de_tarefa_id)
);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_dependencias_tarefa ON public.projeto_tarefa_dependencias(tarefa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefa_dependencias TO authenticated;
GRANT ALL ON public.projeto_tarefa_dependencias TO service_role;

ALTER TABLE public.projeto_tarefa_dependencias ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. CHECKLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  texto text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_checklist_tarefa ON public.projeto_tarefa_checklist(tarefa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefa_checklist TO authenticated;
GRANT ALL ON public.projeto_tarefa_checklist TO service_role;

ALTER TABLE public.projeto_tarefa_checklist ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. COMENTÁRIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  conteudo text NOT NULL,
  mencionados uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_comentarios_tarefa ON public.projeto_tarefa_comentarios(tarefa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefa_comentarios TO authenticated;
GRANT ALL ON public.projeto_tarefa_comentarios TO service_role;

ALTER TABLE public.projeto_tarefa_comentarios ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. ANEXOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  storage_path text NOT NULL,
  tipo text,
  tamanho_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_anexos_tarefa ON public.projeto_tarefa_anexos(tarefa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefa_anexos TO authenticated;
GRANT ALL ON public.projeto_tarefa_anexos TO service_role;

ALTER TABLE public.projeto_tarefa_anexos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. VÍNCULOS POLIMÓRFICOS GRC
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  entidade_tipo public.projeto_vinculo_entidade NOT NULL,
  entidade_id uuid NOT NULL,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tarefa_id, entidade_tipo, entidade_id)
);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_vinculos_tarefa ON public.projeto_tarefa_vinculos(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_vinculos_entidade ON public.projeto_tarefa_vinculos(entidade_tipo, entidade_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefa_vinculos TO authenticated;
GRANT ALL ON public.projeto_tarefa_vinculos TO service_role;

ALTER TABLE public.projeto_tarefa_vinculos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 11. ATIVIDADE / TIMELINE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_atividade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id uuid,
  campo text NOT NULL,
  valor_antigo text,
  valor_novo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_atividade_tarefa ON public.projeto_tarefa_atividade(tarefa_id);

GRANT SELECT, INSERT ON public.projeto_tarefa_atividade TO authenticated;
GRANT ALL ON public.projeto_tarefa_atividade TO service_role;

ALTER TABLE public.projeto_tarefa_atividade ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROJETOS
CREATE POLICY "projetos_select" ON public.projetos
FOR SELECT TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.is_admin_or_super_admin()
    OR owner_id = auth.uid()
    OR public.is_projeto_member(id, auth.uid())
  )
);

CREATE POLICY "projetos_insert" ON public.projetos
FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "projetos_update" ON public.projetos
FOR UPDATE TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (
    public.is_admin_or_super_admin()
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros
      WHERE projeto_id = projetos.id AND user_id = auth.uid()
        AND papel IN ('owner', 'admin')
    )
  )
);

CREATE POLICY "projetos_delete" ON public.projetos
FOR DELETE TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
  AND (public.is_admin_or_super_admin() OR owner_id = auth.uid())
);

-- PROJETO_MEMBROS
CREATE POLICY "projeto_membros_select" ON public.projeto_membros
FOR SELECT TO authenticated
USING (public.can_access_projeto(projeto_id));

CREATE POLICY "projeto_membros_manage" ON public.projeto_membros
FOR ALL TO authenticated
USING (
  public.projeto_pertence_empresa(projeto_id)
  AND (
    public.is_admin_or_super_admin()
    OR EXISTS (SELECT 1 FROM public.projetos WHERE id = projeto_id AND owner_id = auth.uid())
  )
)
WITH CHECK (
  public.projeto_pertence_empresa(projeto_id)
  AND (
    public.is_admin_or_super_admin()
    OR EXISTS (SELECT 1 FROM public.projetos WHERE id = projeto_id AND owner_id = auth.uid())
  )
);

-- PROJETO_COLUNAS
CREATE POLICY "projeto_colunas_select" ON public.projeto_colunas
FOR SELECT TO authenticated USING (public.can_access_projeto(projeto_id));

CREATE POLICY "projeto_colunas_manage" ON public.projeto_colunas
FOR ALL TO authenticated
USING (public.can_access_projeto(projeto_id))
WITH CHECK (public.can_access_projeto(projeto_id));

-- PROJETO_TAREFAS
CREATE POLICY "projeto_tarefas_select" ON public.projeto_tarefas
FOR SELECT TO authenticated USING (public.can_access_projeto(projeto_id));

CREATE POLICY "projeto_tarefas_manage" ON public.projeto_tarefas
FOR ALL TO authenticated
USING (public.can_access_projeto(projeto_id))
WITH CHECK (public.can_access_projeto(projeto_id));

-- Demais tabelas filhas (via tarefa -> projeto)
CREATE OR REPLACE FUNCTION public.can_access_tarefa(_tarefa_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_tarefas t
    WHERE t.id = _tarefa_id AND public.can_access_projeto(t.projeto_id)
  );
$$;

CREATE POLICY "projeto_tarefa_seguidores_all" ON public.projeto_tarefa_seguidores
FOR ALL TO authenticated
USING (public.can_access_tarefa(tarefa_id))
WITH CHECK (public.can_access_tarefa(tarefa_id));

CREATE POLICY "projeto_tarefa_dependencias_all" ON public.projeto_tarefa_dependencias
FOR ALL TO authenticated
USING (public.can_access_tarefa(tarefa_id))
WITH CHECK (public.can_access_tarefa(tarefa_id));

CREATE POLICY "projeto_tarefa_checklist_all" ON public.projeto_tarefa_checklist
FOR ALL TO authenticated
USING (public.can_access_tarefa(tarefa_id))
WITH CHECK (public.can_access_tarefa(tarefa_id));

CREATE POLICY "projeto_tarefa_comentarios_select" ON public.projeto_tarefa_comentarios
FOR SELECT TO authenticated USING (public.can_access_tarefa(tarefa_id));

CREATE POLICY "projeto_tarefa_comentarios_insert" ON public.projeto_tarefa_comentarios
FOR INSERT TO authenticated
WITH CHECK (public.can_access_tarefa(tarefa_id) AND user_id = auth.uid());

CREATE POLICY "projeto_tarefa_comentarios_update_own" ON public.projeto_tarefa_comentarios
FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "projeto_tarefa_comentarios_delete_own" ON public.projeto_tarefa_comentarios
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_admin_or_super_admin());

CREATE POLICY "projeto_tarefa_anexos_all" ON public.projeto_tarefa_anexos
FOR ALL TO authenticated
USING (public.can_access_tarefa(tarefa_id))
WITH CHECK (public.can_access_tarefa(tarefa_id));

CREATE POLICY "projeto_tarefa_vinculos_all" ON public.projeto_tarefa_vinculos
FOR ALL TO authenticated
USING (public.can_access_tarefa(tarefa_id))
WITH CHECK (public.can_access_tarefa(tarefa_id));

CREATE POLICY "projeto_tarefa_atividade_select" ON public.projeto_tarefa_atividade
FOR SELECT TO authenticated USING (public.can_access_tarefa(tarefa_id));

CREATE POLICY "projeto_tarefa_atividade_insert" ON public.projeto_tarefa_atividade
FOR INSERT TO authenticated WITH CHECK (public.can_access_tarefa(tarefa_id));

-- ============================================================
-- TRIGGERS
-- ============================================================

-- updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_projetos_updated_at BEFORE UPDATE ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_projeto_tarefas_updated_at BEFORE UPDATE ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_projeto_comentarios_updated_at BEFORE UPDATE ON public.projeto_tarefa_comentarios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ao criar projeto, owner vira membro automaticamente + colunas padrão
CREATE OR REPLACE FUNCTION public.projeto_bootstrap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.projeto_membros (projeto_id, user_id, papel, added_by)
  VALUES (NEW.id, NEW.owner_id, 'owner', NEW.created_by)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.projeto_colunas (projeto_id, nome, ordem, cor, is_concluido) VALUES
    (NEW.id, 'A Fazer', 0, '#94a3b8', false),
    (NEW.id, 'Em Andamento', 1, '#3b82f6', false),
    (NEW.id, 'Em Revisão', 2, '#f59e0b', false),
    (NEW.id, 'Concluído', 3, '#22c55e', true);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projeto_bootstrap AFTER INSERT ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.projeto_bootstrap();

-- Auto-set concluida_em quando coluna é de conclusão
CREATE OR REPLACE FUNCTION public.projeto_tarefa_check_conclusao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_concluido boolean;
BEGIN
  IF NEW.coluna_id IS NOT NULL THEN
    SELECT is_concluido INTO v_concluido FROM public.projeto_colunas WHERE id = NEW.coluna_id;
    IF v_concluido AND NEW.concluida_em IS NULL THEN
      NEW.concluida_em = now();
      NEW.progresso_pct = 100;
    ELSIF NOT v_concluido AND NEW.concluida_em IS NOT NULL THEN
      NEW.concluida_em = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projeto_tarefa_check_conclusao BEFORE INSERT OR UPDATE OF coluna_id ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.projeto_tarefa_check_conclusao();

-- Notificação ao atribuir responsável
CREATE OR REPLACE FUNCTION public.projeto_tarefa_notify_atribuicao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_projeto_nome text;
BEGIN
  IF NEW.responsavel_id IS NOT NULL
     AND NEW.responsavel_id <> COALESCE(OLD.responsavel_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND NEW.responsavel_id <> auth.uid() THEN
    SELECT nome INTO v_projeto_nome FROM public.projetos WHERE id = NEW.projeto_id;
    INSERT INTO public.notifications (user_id, title, message, type, link_to, metadata)
    VALUES (
      NEW.responsavel_id,
      'Nova tarefa atribuída',
      'Você foi designado para: ' || NEW.titulo,
      'info',
      '/projetos/' || NEW.projeto_id,
      jsonb_build_object('projeto_id', NEW.projeto_id, 'tarefa_id', NEW.id, 'projeto_nome', v_projeto_nome)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projeto_tarefa_notify AFTER INSERT OR UPDATE OF responsavel_id ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.projeto_tarefa_notify_atribuicao();

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('projeto-anexos', 'projeto-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "projeto_anexos_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'projeto-anexos'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "projeto_anexos_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'projeto-anexos'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

CREATE POLICY "projeto_anexos_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'projeto-anexos'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
);

-- ============================================================
-- RBAC: registrar módulo "projetos"
-- ============================================================
INSERT INTO public.system_modules (name, display_name, description, icon, is_active)
VALUES ('projetos', 'Projetos', 'Gestão de atividades, Kanban e projetos', 'kanban', true)
ON CONFLICT (name) DO NOTHING;
