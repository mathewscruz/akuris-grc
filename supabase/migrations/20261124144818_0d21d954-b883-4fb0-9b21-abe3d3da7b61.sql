ALTER TABLE public.projeto_tarefa_anexos ADD COLUMN IF NOT EXISTS documento_id uuid REFERENCES public.documentos(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resumo_semanal boolean NOT NULL DEFAULT true;

CREATE TABLE public.projeto_tarefa_anexo_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anexo_id uuid NOT NULL REFERENCES public.projeto_tarefa_anexos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES public.gap_analysis_requirements(id) ON DELETE CASCADE,
  controle_id uuid REFERENCES public.controles(id) ON DELETE CASCADE,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alvo_unico CHECK ((requirement_id IS NULL) <> (controle_id IS NULL))
);
CREATE UNIQUE INDEX projeto_tarefa_anexo_evid_uq ON public.projeto_tarefa_anexo_evidencias (anexo_id, coalesce(requirement_id, controle_id));
CREATE INDEX ON public.projeto_tarefa_anexo_evidencias (empresa_id, requirement_id);
CREATE INDEX ON public.projeto_tarefa_anexo_evidencias (empresa_id, controle_id);
GRANT SELECT, INSERT, DELETE ON public.projeto_tarefa_anexo_evidencias TO authenticated;
GRANT ALL ON public.projeto_tarefa_anexo_evidencias TO service_role;
ALTER TABLE public.projeto_tarefa_anexo_evidencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver da empresa" ON public.projeto_tarefa_anexo_evidencias FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "criar com acesso à tarefa" ON public.projeto_tarefa_anexo_evidencias FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND EXISTS (SELECT 1 FROM public.projeto_tarefa_anexos a WHERE a.id = anexo_id AND public.can_access_tarefa(a.tarefa_id))
    AND (controle_id IS NULL OR EXISTS (SELECT 1 FROM public.controles c WHERE c.id = controle_id AND c.empresa_id = public.get_user_empresa_id()))
  );
CREATE POLICY "remover com acesso à tarefa" ON public.projeto_tarefa_anexo_evidencias FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id()
    AND EXISTS (SELECT 1 FROM public.projeto_tarefa_anexos a WHERE a.id = anexo_id AND public.can_access_tarefa(a.tarefa_id)));

-- documento referenciado precisa ser da mesma empresa do projeto
CREATE OR REPLACE FUNCTION public.projeto_anexo_documento_mesma_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.documento_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM documentos d JOIN projeto_tarefas t ON t.id = NEW.tarefa_id JOIN projetos p ON p.id = t.projeto_id
    WHERE d.id = NEW.documento_id AND d.empresa_id = p.empresa_id) THEN
    RAISE EXCEPTION 'DOCUMENTO_OUTRA_EMPRESA';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER projeto_anexo_documento_mesma_empresa BEFORE INSERT OR UPDATE OF documento_id ON public.projeto_tarefa_anexos
FOR EACH ROW EXECUTE FUNCTION public.projeto_anexo_documento_mesma_empresa();