/* Indicadores-chave de risco (KRI) e as respetivas medições. */
CREATE TABLE IF NOT EXISTS public.riscos_kris (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  risco_id uuid NOT NULL REFERENCES public.riscos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  unidade text,
  direcao text NOT NULL DEFAULT 'maximo' CHECK (direcao IN ('maximo', 'minimo')),
  limite numeric NOT NULL,
  valor_atual numeric,
  periodicidade text NOT NULL DEFAULT 'mensal'
    CHECK (periodicidade IN ('semanal', 'mensal', 'trimestral', 'semestral', 'anual')),
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  proxima_medicao date,
  ultima_medicao_em timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT riscos_kris_nome_unico UNIQUE (risco_id, nome)
);

CREATE TABLE IF NOT EXISTS public.riscos_kri_medicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kri_id uuid NOT NULL REFERENCES public.riscos_kris(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  observacao text,
  medido_em timestamptz NOT NULL DEFAULT now(),
  medido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS riscos_kris_risco_idx ON public.riscos_kris (risco_id, ativo);
CREATE INDEX IF NOT EXISTS riscos_kris_empresa_idx ON public.riscos_kris (empresa_id);
CREATE INDEX IF NOT EXISTS riscos_kri_medicoes_kri_idx
  ON public.riscos_kri_medicoes (kri_id, medido_em DESC);

ALTER TABLE public.riscos_kris ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riscos_kri_medicoes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tg_risco_kri_validar_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM public.riscos WHERE id = NEW.risco_id;
  IF v_empresa_id IS NULL OR v_empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'RISCO_FORA_DA_EMPRESA';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_risco_kri_validar_empresa ON public.riscos_kris;
CREATE TRIGGER trg_risco_kri_validar_empresa
  BEFORE INSERT OR UPDATE OF risco_id, empresa_id ON public.riscos_kris
  FOR EACH ROW EXECUTE FUNCTION public.tg_risco_kri_validar_empresa();

CREATE OR REPLACE FUNCTION public.tg_risco_kri_registrar_medicao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM public.riscos_kris WHERE id = NEW.kri_id;
  IF v_empresa_id IS NULL OR v_empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'KRI_FORA_DA_EMPRESA';
  END IF;

  UPDATE public.riscos_kris
     SET valor_atual = NEW.valor,
         ultima_medicao_em = NEW.medido_em,
         updated_at = now()
   WHERE id = NEW.kri_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_risco_kri_registrar_medicao ON public.riscos_kri_medicoes;
CREATE TRIGGER trg_risco_kri_registrar_medicao
  AFTER INSERT ON public.riscos_kri_medicoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_risco_kri_registrar_medicao();

CREATE TRIGGER update_riscos_kris_updated_at
  BEFORE UPDATE ON public.riscos_kris
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "KRI da empresa" ON public.riscos_kris
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Criar KRI da empresa" ON public.riscos_kris
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Atualizar KRI da empresa" ON public.riscos_kris
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Excluir KRI da empresa" ON public.riscos_kris
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Medições KRI da empresa" ON public.riscos_kri_medicoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Criar medição KRI da empresa" ON public.riscos_kri_medicoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Excluir medição KRI da empresa" ON public.riscos_kri_medicoes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "MFA válido para KRI" ON public.riscos_kris
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_valid_mfa_session())
  WITH CHECK (public.has_valid_mfa_session());
CREATE POLICY "MFA válido para medições KRI" ON public.riscos_kri_medicoes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_valid_mfa_session())
  WITH CHECK (public.has_valid_mfa_session());

CREATE POLICY "Permissão de leitura de KRI" ON public.riscos_kris
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_modulo('riscos', 'read'));
CREATE POLICY "Permissão para criar KRI" ON public.riscos_kris
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_permissao_modulo('riscos', 'create'));
CREATE POLICY "Permissão para atualizar KRI" ON public.riscos_kris
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.usuario_tem_permissao_modulo('riscos', 'update'))
  WITH CHECK (public.usuario_tem_permissao_modulo('riscos', 'update'));
CREATE POLICY "Permissão para excluir KRI" ON public.riscos_kris
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.usuario_tem_permissao_modulo('riscos', 'delete'));

CREATE POLICY "Permissão de leitura de medições KRI" ON public.riscos_kri_medicoes
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_modulo('riscos', 'read'));
CREATE POLICY "Permissão para criar medições KRI" ON public.riscos_kri_medicoes
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_permissao_modulo('riscos', 'update'));
CREATE POLICY "Permissão para excluir medições KRI" ON public.riscos_kri_medicoes
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.usuario_tem_permissao_modulo('riscos', 'delete'));
