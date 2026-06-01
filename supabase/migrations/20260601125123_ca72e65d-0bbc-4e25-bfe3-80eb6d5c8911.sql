-- ============================================================
-- Projetos Fase 3: Sprints, Tempo, Reações, Arquivamento, Extensions
-- ============================================================

-- Habilitar extensões para cron + http
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- 1) Sprints
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_sprints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  objetivo text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  ativa boolean NOT NULL DEFAULT false,
  concluida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_sprints_projeto ON public.projeto_sprints(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_sprints_empresa ON public.projeto_sprints(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_sprints TO authenticated;
GRANT ALL ON public.projeto_sprints TO service_role;

ALTER TABLE public.projeto_sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projeto_sprints_select" ON public.projeto_sprints
  FOR SELECT TO authenticated
  USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "projeto_sprints_manage" ON public.projeto_sprints
  FOR ALL TO authenticated
  USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE TRIGGER trg_projeto_sprints_updated_at BEFORE UPDATE ON public.projeto_sprints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adiciona sprint_id em tarefas
ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS sprint_id uuid REFERENCES public.projeto_sprints(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_sprint ON public.projeto_tarefas(sprint_id);

-- ============================================================
-- 2) Time tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_tempo_entradas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  horas numeric(8,2) NOT NULL CHECK (horas > 0),
  descricao text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_tempo_tarefa ON public.projeto_tempo_entradas(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tempo_user ON public.projeto_tempo_entradas(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tempo_entradas TO authenticated;
GRANT ALL ON public.projeto_tempo_entradas TO service_role;

ALTER TABLE public.projeto_tempo_entradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projeto_tempo_select" ON public.projeto_tempo_entradas
  FOR SELECT TO authenticated
  USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "projeto_tempo_insert" ON public.projeto_tempo_entradas
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "projeto_tempo_owner_modify" ON public.projeto_tempo_entradas
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "projeto_tempo_owner_delete" ON public.projeto_tempo_entradas
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Soma automática em projeto_tarefas.tempo_gasto_horas
CREATE OR REPLACE FUNCTION public.recalcula_tempo_gasto_tarefa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tarefa uuid;
  v_total numeric;
BEGIN
  v_tarefa := COALESCE(NEW.tarefa_id, OLD.tarefa_id);
  SELECT COALESCE(SUM(horas), 0) INTO v_total
  FROM public.projeto_tempo_entradas WHERE tarefa_id = v_tarefa;
  UPDATE public.projeto_tarefas SET tempo_gasto_horas = v_total WHERE id = v_tarefa;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_recalc_tempo_tarefa
AFTER INSERT OR UPDATE OR DELETE ON public.projeto_tempo_entradas
FOR EACH ROW EXECUTE FUNCTION public.recalcula_tempo_gasto_tarefa();

-- ============================================================
-- 3) Reações em comentários
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projeto_comentario_reacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  comentario_id uuid NOT NULL REFERENCES public.projeto_tarefa_comentarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comentario_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_projeto_reacoes_comentario ON public.projeto_comentario_reacoes(comentario_id);

GRANT SELECT, INSERT, DELETE ON public.projeto_comentario_reacoes TO authenticated;
GRANT ALL ON public.projeto_comentario_reacoes TO service_role;

ALTER TABLE public.projeto_comentario_reacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projeto_reacoes_select" ON public.projeto_comentario_reacoes
  FOR SELECT TO authenticated
  USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "projeto_reacoes_insert" ON public.projeto_comentario_reacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "projeto_reacoes_delete" ON public.projeto_comentario_reacoes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 4) Notificações: prazo próximo, SLA violado, comentário com menção
-- ============================================================
-- Trigger: comentário com menções -> notifica cada user mencionado
CREATE OR REPLACE FUNCTION public.notifica_mencao_comentario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
  v_tarefa record;
BEGIN
  IF NEW.mencionados IS NULL OR array_length(NEW.mencionados, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.titulo, t.projeto_id, t.empresa_id INTO v_tarefa
  FROM public.projeto_tarefas t WHERE t.id = NEW.tarefa_id;

  FOREACH v_user IN ARRAY NEW.mencionados LOOP
    IF v_user <> NEW.user_id THEN
      INSERT INTO public.notifications (empresa_id, user_id, tipo, titulo, mensagem, link, prioridade)
      VALUES (
        v_tarefa.empresa_id, v_user, 'projeto_mencao',
        'Você foi mencionado',
        'Em: ' || COALESCE(v_tarefa.titulo, 'tarefa'),
        '/projetos/' || v_tarefa.projeto_id,
        'media'
      );
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_projeto_mencao_notify ON public.projeto_tarefa_comentarios;
CREATE TRIGGER trg_projeto_mencao_notify AFTER INSERT ON public.projeto_tarefa_comentarios
FOR EACH ROW EXECUTE FUNCTION public.notifica_mencao_comentario();

-- ============================================================
-- 5) Permitir status 'arquivado' em projetos (constraint check)
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.projetos DROP CONSTRAINT IF EXISTS projetos_status_check;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- (não impõe novo check — status é texto livre controlado pelo app)
