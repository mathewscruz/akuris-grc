-- Centro operacional de privacidade.
--
-- Esta migration fecha o ciclo que antes terminava no cadastro: autorização
-- por operação, integridade, trilha imutável, avaliações (RIPD/DPIA, LIA,
-- TIA e Privacy by Design), terceiros, retenção, consentimentos, atendimento
-- ao titular e detalhe regulatório de incidentes.

-- O bucket existia na migration inicial, mas instalações que começaram por
-- snapshots posteriores podiam não o ter.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dados-documentos',
  'dados-documentos',
  false,
  10485760,
  ARRAY['application/pdf','image/png','image/jpeg','text/plain','text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- O enquadramento é jurídico, não uma inferência automática pelo número de
-- funcionários. A empresa o declara nas configurações quando cumpre a
-- Resolução CD/ANPD nº 2/2022 e então os prazos brasileiros são dobrados.
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS agente_tratamento_pequeno_porte boolean NOT NULL DEFAULT false;

-- ── Catálogo e linhagem ───────────────────────────────────────────────────
ALTER TABLE public.dados_pessoais
  ADD COLUMN IF NOT EXISTS nivel_catalogo text NOT NULL DEFAULT 'conjunto',
  ADD COLUMN IF NOT EXISTS registro_pai_id uuid REFERENCES public.dados_pessoais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS titulares_vulneraveis boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_validada boolean NOT NULL DEFAULT false;
-- Descoberta automática não conhece a hipótese legal: um valor nulo obriga a
-- revisão humana e evita declarar consentimento sem qualquer evidência.
ALTER TABLE public.dados_pessoais ALTER COLUMN base_legal DROP NOT NULL;

UPDATE public.dados_pessoais
   SET titulares_vulneraveis = true,
       tipo_dados = 'comum'
 WHERE tipo_dados = 'infantil';

-- Algumas cargas antigas usaram `tipo_dados` para listar os próprios campos
-- ("nome,cpf,email"). A informação não é descartada: vai para observações e
-- o tipo jurídico passa a refletir a classificação já registrada.
UPDATE public.dados_pessoais
   SET observacoes = concat_ws(E'\n', NULLIF(observacoes,''),
         'Tipos legados informados: ' || COALESCE(tipo_dados,'(não informado)')),
       tipo_dados = CASE
         WHEN sensibilidade IN ('sensivel','muito_sensivel') THEN 'sensivel'
         ELSE 'comum' END
 WHERE tipo_dados IS NULL OR tipo_dados NOT IN ('comum','sensivel');

ALTER TABLE public.dados_pessoais DROP CONSTRAINT IF EXISTS dados_pessoais_tipo_dados_conhecido;
ALTER TABLE public.dados_pessoais
  ADD CONSTRAINT dados_pessoais_tipo_dados_conhecido
  CHECK (tipo_dados IN ('comum','sensivel'));
ALTER TABLE public.dados_pessoais DROP CONSTRAINT IF EXISTS dados_pessoais_nivel_catalogo_conhecido;
ALTER TABLE public.dados_pessoais
  ADD CONSTRAINT dados_pessoais_nivel_catalogo_conhecido
  CHECK (nivel_catalogo IN ('conjunto','campo'));

DELETE FROM public.dados_mapeamento m
 WHERE NOT EXISTS (SELECT 1 FROM public.dados_pessoais d WHERE d.id = m.dados_pessoais_id)
    OR NOT EXISTS (SELECT 1 FROM public.ativos a WHERE a.id = m.ativo_id);
ALTER TABLE public.dados_mapeamento DROP CONSTRAINT IF EXISTS dados_mapeamento_dados_pessoais_id_fkey;
ALTER TABLE public.dados_mapeamento
  ADD CONSTRAINT dados_mapeamento_dados_pessoais_id_fkey
  FOREIGN KEY (dados_pessoais_id) REFERENCES public.dados_pessoais(id) ON DELETE CASCADE;
ALTER TABLE public.dados_mapeamento DROP CONSTRAINT IF EXISTS dados_mapeamento_ativo_id_fkey;
ALTER TABLE public.dados_mapeamento
  ADD CONSTRAINT dados_mapeamento_ativo_id_fkey
  FOREIGN KEY (ativo_id) REFERENCES public.ativos(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS dados_mapeamento_par_unico
  ON public.dados_mapeamento(dados_pessoais_id, ativo_id, tipo_armazenamento);
CREATE INDEX IF NOT EXISTS idx_dados_mapeamento_dado ON public.dados_mapeamento(dados_pessoais_id);
CREATE INDEX IF NOT EXISTS idx_dados_mapeamento_ativo ON public.dados_mapeamento(ativo_id);

DELETE FROM public.dados_fluxos f
 WHERE NOT EXISTS (SELECT 1 FROM public.dados_pessoais d WHERE d.id = f.dados_pessoais_id);
ALTER TABLE public.dados_fluxos DROP CONSTRAINT IF EXISTS dados_fluxos_dados_pessoais_id_fkey;
ALTER TABLE public.dados_fluxos
  ADD CONSTRAINT dados_fluxos_dados_pessoais_id_fkey
  FOREIGN KEY (dados_pessoais_id) REFERENCES public.dados_pessoais(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_dados_fluxos_empresa_status ON public.dados_fluxos(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_dados_pessoais_empresa_nome ON public.dados_pessoais(empresa_id, nome);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_empresa_status_prazo
  ON public.dados_solicitacoes_titular(empresa_id, status, prazo_resposta);
CREATE INDEX IF NOT EXISTS idx_dados_descobertas_autor_data
  ON public.dados_descobertas(created_by, created_at DESC);

-- ── Direitos dos titulares ────────────────────────────────────────────────
ALTER TABLE public.dados_solicitacoes_titular
  ADD COLUMN IF NOT EXISTS recebida_em timestamptz,
  ADD COLUMN IF NOT EXISTS identidade_status text NOT NULL DEFAULT 'nao_verificada',
  ADD COLUMN IF NOT EXISTS identidade_metodo text,
  ADD COLUMN IF NOT EXISTS prorrogada_ate date,
  ADD COLUMN IF NOT EXISTS motivo_prorrogacao text,
  ADD COLUMN IF NOT EXISTS motivo_recusa text,
  ADD COLUMN IF NOT EXISTS canal_resposta text,
  ADD COLUMN IF NOT EXISTS prazo_fonte text NOT NULL DEFAULT 'interno';

UPDATE public.dados_solicitacoes_titular
   SET recebida_em = COALESCE(data_solicitacao, created_at)
 WHERE recebida_em IS NULL;
ALTER TABLE public.dados_solicitacoes_titular ALTER COLUMN recebida_em SET DEFAULT now();
ALTER TABLE public.dados_solicitacoes_titular DROP CONSTRAINT IF EXISTS solicitacao_identidade_status_conhecido;
ALTER TABLE public.dados_solicitacoes_titular
  ADD CONSTRAINT solicitacao_identidade_status_conhecido
  CHECK (identidade_status IN ('nao_verificada','pendente','verificada','dispensada','falhou'));
ALTER TABLE public.dados_solicitacoes_titular DROP CONSTRAINT IF EXISTS solicitacao_prazo_fonte_conhecida;
ALTER TABLE public.dados_solicitacoes_titular
  ADD CONSTRAINT solicitacao_prazo_fonte_conhecida CHECK (prazo_fonte IN ('legal','interno','prorrogado'));

CREATE TABLE IF NOT EXISTS public.dados_solicitacao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  solicitacao_id uuid NOT NULL REFERENCES public.dados_solicitacoes_titular(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text NOT NULL,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT solicitacao_evento_tipo_conhecido CHECK (
    tipo IN ('recebida','identidade','atribuida','nota','prazo','resposta','conclusao','reabertura','anexo')
  )
);
CREATE INDEX IF NOT EXISTS idx_solicitacao_eventos_solicitacao
  ON public.dados_solicitacao_eventos(solicitacao_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.dados_solicitacao_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  solicitacao_id uuid NOT NULL REFERENCES public.dados_solicitacoes_titular(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  caminho text NOT NULL,
  mime_type text,
  tamanho bigint,
  categoria text NOT NULL DEFAULT 'evidencia',
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT solicitacao_anexo_categoria_conhecida CHECK (
    categoria IN ('identidade','pedido','evidencia','resposta')
  )
);

-- ── Terceiros, retenção, consentimento e avaliações ───────────────────────
CREATE TABLE IF NOT EXISTS public.privacidade_terceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  papel text NOT NULL DEFAULT 'operador',
  pais text,
  dados_categorias text[] NOT NULL DEFAULT '{}',
  finalidade text,
  mecanismo_transferencia text,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  ropa_id uuid REFERENCES public.ropa_registros(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'em_avaliacao',
  proxima_revisao date,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacidade_terceiro_papel_conhecido CHECK (
    papel IN ('controlador','controlador_conjunto','operador','suboperador','destinatario')
  ),
  CONSTRAINT privacidade_terceiro_status_conhecido CHECK (
    status IN ('em_avaliacao','aprovado','restrito','bloqueado','inativo')
  )
);

CREATE TABLE IF NOT EXISTS public.privacidade_retencoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  dado_id uuid REFERENCES public.dados_pessoais(id) ON DELETE CASCADE,
  ropa_id uuid REFERENCES public.ropa_registros(id) ON DELETE CASCADE,
  gatilho text NOT NULL,
  prazo_quantidade integer,
  prazo_unidade text,
  fundamento text NOT NULL,
  acao_destino text NOT NULL DEFAULT 'eliminar',
  legal_hold boolean NOT NULL DEFAULT false,
  proxima_execucao date,
  status text NOT NULL DEFAULT 'ativo',
  responsavel_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacidade_retencao_alvo CHECK (dado_id IS NOT NULL OR ropa_id IS NOT NULL),
  CONSTRAINT privacidade_retencao_unidade CHECK (
    prazo_unidade IS NULL OR prazo_unidade IN ('dias','meses','anos','evento')
  ),
  CONSTRAINT privacidade_retencao_acao CHECK (acao_destino IN ('eliminar','anonimizar','revisar','arquivar')),
  CONSTRAINT privacidade_retencao_status CHECK (status IN ('ativo','pausado','concluido'))
);

CREATE TABLE IF NOT EXISTS public.privacidade_consentimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  titular_referencia text NOT NULL,
  finalidade text NOT NULL,
  versao_aviso text NOT NULL,
  canal text NOT NULL,
  coletado_em timestamptz NOT NULL DEFAULT now(),
  revogado_em timestamptz,
  evidencia text,
  ropa_id uuid REFERENCES public.ropa_registros(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'valido',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacidade_consentimento_status CHECK (status IN ('valido','revogado','expirado','substituido'))
);

CREATE TABLE IF NOT EXISTS public.privacidade_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  ropa_id uuid REFERENCES public.ropa_registros(id) ON DELETE SET NULL,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  terceiro_id uuid REFERENCES public.privacidade_terceiros(id) ON DELETE SET NULL,
  necessidade text,
  proporcionalidade text,
  riscos text,
  medidas text,
  criterios jsonb NOT NULL DEFAULT '{}'::jsonb,
  nivel_risco text NOT NULL DEFAULT 'medio',
  status text NOT NULL DEFAULT 'rascunho',
  conclusao text,
  responsavel_id uuid,
  aprovado_por uuid,
  aprovado_em timestamptz,
  proxima_revisao date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacidade_avaliacao_tipo CHECK (tipo IN ('ripd','dpia','lia','tia','privacy_by_design')),
  CONSTRAINT privacidade_avaliacao_risco CHECK (nivel_risco IN ('baixo','medio','alto','critico')),
  CONSTRAINT privacidade_avaliacao_status CHECK (
    status IN ('rascunho','em_revisao','aprovada','reprovada','revisao_necessaria')
  ),
  CONSTRAINT privacidade_avaliacao_aprovacao CHECK (
    status <> 'aprovada' OR (aprovado_por IS NOT NULL AND aprovado_em IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.privacidade_incidente_detalhes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  incidente_id uuid NOT NULL UNIQUE REFERENCES public.incidentes(id) ON DELETE CASCADE,
  detectado_em timestamptz,
  conhecimento_em timestamptz,
  prazo_autoridade timestamptz,
  titulares_estimados integer,
  categorias_dados text[] NOT NULL DEFAULT '{}',
  ropa_ids uuid[] NOT NULL DEFAULT '{}',
  risco_titulares text,
  decisao_notificar text NOT NULL DEFAULT 'em_analise',
  justificativa_decisao text,
  autoridade_notificada_em timestamptz,
  titulares_notificados_em timestamptz,
  evidencia text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacidade_incidente_decisao CHECK (
    decisao_notificar IN ('em_analise','notificar','nao_notificar')
  )
);

ALTER TABLE public.privacidade_incidente_detalhes
  ADD COLUMN IF NOT EXISTS natureza_incidente text,
  ADD COLUMN IF NOT EXISTS medidas_mitigacao text,
  ADD COLUMN IF NOT EXISTS conteudo_comunicacao text,
  ADD COLUMN IF NOT EXISTS motivo_atraso text,
  ADD COLUMN IF NOT EXISTS prazo_regra text,
  ADD COLUMN IF NOT EXISTS reter_ate date;

CREATE OR REPLACE FUNCTION public.somar_dias_uteis(p_inicio timestamptz, p_dias integer)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_resultado timestamptz := p_inicio; v_somados integer := 0;
BEGIN
  WHILE v_somados < p_dias LOOP
    v_resultado := v_resultado + interval '1 day';
    IF extract(isodow FROM v_resultado) < 6 THEN v_somados := v_somados + 1; END IF;
  END LOOP;
  RETURN v_resultado;
END $$;

CREATE OR REPLACE FUNCTION public.tg_prazo_incidente_privacidade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_jurisdicao text; v_pequeno_porte boolean;
BEGIN
  IF NEW.conhecimento_em IS NOT NULL AND (NEW.prazo_autoridade IS NULL OR NEW.conhecimento_em IS DISTINCT FROM OLD.conhecimento_em) THEN
    SELECT COALESCE(jurisdicao,'BR'), COALESCE(agente_tratamento_pequeno_porte,false)
      INTO v_jurisdicao,v_pequeno_porte FROM public.empresas WHERE id=NEW.empresa_id;
    IF v_jurisdicao IN ('PT_EU','INTL') THEN
      NEW.prazo_autoridade := NEW.conhecimento_em + interval '72 hours';
      NEW.prazo_regra := '72 horas (RGPD/GDPR)';
    ELSIF v_pequeno_porte THEN
      NEW.prazo_autoridade := public.somar_dias_uteis(NEW.conhecimento_em, 6);
      NEW.prazo_regra := '6 dias úteis — prazo em dobro (Resoluções CD/ANPD nº 2/2022 e 15/2024)';
    ELSE
      NEW.prazo_autoridade := public.somar_dias_uteis(NEW.conhecimento_em, 3);
      NEW.prazo_regra := '3 dias úteis (Resolução CD/ANPD nº 15/2024)';
    END IF;
  END IF;
  NEW.reter_ate := COALESCE(NEW.reter_ate, (COALESCE(NEW.conhecimento_em, now()) + interval '5 years')::date);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_prazo_incidente_privacidade ON public.privacidade_incidente_detalhes;
CREATE TRIGGER tg_prazo_incidente_privacidade BEFORE INSERT OR UPDATE OF conhecimento_em
  ON public.privacidade_incidente_detalhes FOR EACH ROW EXECUTE FUNCTION public.tg_prazo_incidente_privacidade();

ALTER TABLE public.privacidade_avaliacoes
  ADD COLUMN IF NOT EXISTS risco_id uuid REFERENCES public.riscos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plano_acao_id uuid REFERENCES public.planos_acao(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_privacidade_avaliacoes_risco ON public.privacidade_avaliacoes(risco_id);
CREATE INDEX IF NOT EXISTS idx_privacidade_avaliacoes_plano ON public.privacidade_avaliacoes(plano_acao_id);

CREATE TABLE IF NOT EXISTS public.privacidade_portais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  titulo text NOT NULL DEFAULT 'Portal de Privacidade',
  introducao text,
  contato_dpo text,
  ativo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacidade_portal_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$')
);

CREATE TABLE IF NOT EXISTS public.privacidade_auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id uuid NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  acao text NOT NULL,
  antes jsonb,
  depois jsonb,
  autor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privacidade_avaliacoes_empresa_status
  ON public.privacidade_avaliacoes(empresa_id, status, tipo);
CREATE INDEX IF NOT EXISTS idx_privacidade_terceiros_empresa_status
  ON public.privacidade_terceiros(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_privacidade_retencoes_empresa_execucao
  ON public.privacidade_retencoes(empresa_id, status, proxima_execucao);
CREATE INDEX IF NOT EXISTS idx_privacidade_consentimentos_empresa_status
  ON public.privacidade_consentimentos(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_privacidade_auditoria_entidade
  ON public.privacidade_auditoria(empresa_id, entidade, entidade_id, created_at DESC);

-- ── RLS por empresa + permissão funcional ─────────────────────────────────
DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'dados_solicitacao_eventos','dados_solicitacao_anexos','privacidade_terceiros',
    'privacidade_retencoes','privacidade_consentimentos','privacidade_avaliacoes',
    'privacidade_incidente_detalhes','privacidade_portais','privacidade_auditoria'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', v_table);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Empresa le ' || v_table, v_table);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id())', 'Empresa le ' || v_table, v_table);
    IF v_table <> 'privacidade_auditoria' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Empresa cria ' || v_table, v_table);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Empresa atualiza ' || v_table, v_table);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Empresa apaga ' || v_table, v_table);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id())', 'Empresa cria ' || v_table, v_table);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id()) WITH CHECK (empresa_id = public.get_user_empresa_id())', 'Empresa atualiza ' || v_table, v_table);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id())', 'Empresa apaga ' || v_table, v_table);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE v_table text; v_action text; v_cmd text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'dados_pessoais','dados_mapeamento','dados_fluxos','dados_solicitacoes_titular',
    'dados_solicitacao_eventos','dados_solicitacao_anexos','dados_descobertas',
    'ropa_registros','ropa_dados_vinculados','ropa_bases_legais','ropa_exercicios',
    'ropa_exercicio_anexos','privacidade_terceiros','privacidade_retencoes',
    'privacidade_consentimentos','privacidade_avaliacoes','privacidade_incidente_detalhes',
    'privacidade_portais','privacidade_auditoria'
  ] LOOP
    FOREACH v_action IN ARRAY ARRAY['read','create','update','delete'] LOOP
      IF v_table = 'privacidade_auditoria' AND v_action <> 'read' THEN CONTINUE; END IF;
      v_cmd := CASE v_action WHEN 'read' THEN 'SELECT' WHEN 'create' THEN 'INSERT'
                            WHEN 'update' THEN 'UPDATE' ELSE 'DELETE' END;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Permissão privacidade ' || v_action, v_table);
      IF v_action = 'create' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated WITH CHECK (public.usuario_tem_permissao_modulo(''dados'', %L))',
          'Permissão privacidade ' || v_action, v_table, v_cmd, v_action);
      ELSIF v_action = 'update' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated USING (public.usuario_tem_permissao_modulo(''dados'', %L)) WITH CHECK (public.usuario_tem_permissao_modulo(''dados'', %L))',
          'Permissão privacidade ' || v_action, v_table, v_cmd, v_action, v_action);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated USING (public.usuario_tem_permissao_modulo(''dados'', %L))',
          'Permissão privacidade ' || v_action, v_table, v_cmd, v_action);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Storage: o primeiro segmento é sempre a empresa, e não o utilizador.
DROP POLICY IF EXISTS "Users can view dados documents from their empresa" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload dados documents in their empresa" ON storage.objects;
DROP POLICY IF EXISTS "Users can update dados documents from their empresa" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete dados documents from their empresa" ON storage.objects;
DROP POLICY IF EXISTS "Empresa le ropa docs storage" ON storage.objects;
DROP POLICY IF EXISTS "Empresa envia ropa docs storage" ON storage.objects;
DROP POLICY IF EXISTS "Empresa apaga ropa docs storage" ON storage.objects;
DROP POLICY IF EXISTS "Privacidade le documentos" ON storage.objects;
DROP POLICY IF EXISTS "Privacidade envia documentos" ON storage.objects;
DROP POLICY IF EXISTS "Privacidade atualiza documentos" ON storage.objects;
DROP POLICY IF EXISTS "Privacidade apaga documentos" ON storage.objects;
CREATE POLICY "Privacidade le documentos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dados-documentos'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
    AND public.usuario_tem_permissao_modulo('dados','read'));
CREATE POLICY "Privacidade envia documentos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dados-documentos'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
    AND public.usuario_tem_permissao_modulo('dados','create'));
CREATE POLICY "Privacidade atualiza documentos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dados-documentos'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
    AND public.usuario_tem_permissao_modulo('dados','update'));
CREATE POLICY "Privacidade apaga documentos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dados-documentos'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
    AND public.usuario_tem_permissao_modulo('dados','delete'));

-- ── Auditoria imutável ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_auditar_privacidade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $$
DECLARE v_row jsonb; v_empresa uuid; v_id uuid;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_empresa := NULLIF(v_row->>'empresa_id','')::uuid;
  IF v_empresa IS NULL AND TG_TABLE_NAME IN ('dados_mapeamento','ropa_dados_vinculados','ropa_bases_legais') THEN
    IF TG_TABLE_NAME = 'dados_mapeamento' THEN
      SELECT empresa_id INTO v_empresa FROM public.dados_pessoais WHERE id = NULLIF(v_row->>'dados_pessoais_id','')::uuid;
    ELSE
      SELECT empresa_id INTO v_empresa FROM public.ropa_registros WHERE id = NULLIF(v_row->>'ropa_id','')::uuid;
    END IF;
  END IF;
  v_id := NULLIF(v_row->>'id','')::uuid;
  IF v_empresa IS NOT NULL THEN
    INSERT INTO public.privacidade_auditoria(empresa_id, entidade, entidade_id, acao, antes, depois, autor_id)
    VALUES (v_empresa, TG_TABLE_NAME, v_id, lower(TG_OP),
      CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
      CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
      auth.uid());
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'dados_pessoais','dados_mapeamento','dados_fluxos','dados_solicitacoes_titular',
    'dados_solicitacao_eventos','dados_solicitacao_anexos','dados_descobertas',
    'ropa_registros','ropa_dados_vinculados','ropa_bases_legais','ropa_exercicios',
    'ropa_exercicio_anexos','privacidade_terceiros','privacidade_retencoes',
    'privacidade_consentimentos','privacidade_avaliacoes','privacidade_incidente_detalhes',
    'privacidade_portais'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tg_auditoria_privacidade ON public.%I', v_table);
    EXECUTE format('CREATE TRIGGER tg_auditoria_privacidade AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_auditar_privacidade()', v_table);
  END LOOP;
END $$;

-- Eventos automáticos quando uma solicitação muda de etapa.
CREATE OR REPLACE FUNCTION public.tg_evento_solicitacao_privacidade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.dados_solicitacao_eventos(empresa_id, solicitacao_id, tipo, descricao, created_by)
    VALUES (NEW.empresa_id, NEW.id, 'recebida', 'Solicitação recebida e prazo inicial calculado.', auth.uid());
    INSERT INTO public.notifications(user_id,title,message,type,link_to,metadata)
    SELECT p.user_id, 'Nova solicitação de privacidade',
           'Uma solicitação de titular foi recebida e precisa de triagem.',
           'info', '/privacidade',
           jsonb_build_object('tipo','privacidade_solicitacao','solicitacao_id',NEW.id)
      FROM public.profiles p
      JOIN auth.users au ON au.id=p.user_id
     WHERE p.empresa_id=NEW.empresa_id AND p.ativo
       AND COALESCE(p.notificar_na_aplicacao,true)
       AND p.role::text IN ('admin','super_admin');
  ELSE
    IF NEW.identidade_status IS DISTINCT FROM OLD.identidade_status THEN
      INSERT INTO public.dados_solicitacao_eventos(empresa_id,solicitacao_id,tipo,descricao,metadados,created_by)
      VALUES(NEW.empresa_id,NEW.id,'identidade','Verificação de identidade atualizada.',jsonb_build_object('antes',OLD.identidade_status,'depois',NEW.identidade_status,'metodo',NEW.identidade_metodo),auth.uid());
    END IF;
    IF NEW.responsavel_analise IS DISTINCT FROM OLD.responsavel_analise THEN
      INSERT INTO public.dados_solicitacao_eventos(empresa_id,solicitacao_id,tipo,descricao,metadados,created_by)
      VALUES(NEW.empresa_id,NEW.id,'atribuida','Responsável pelo atendimento atualizado.',jsonb_build_object('antes',OLD.responsavel_analise,'depois',NEW.responsavel_analise),auth.uid());
      IF NEW.responsavel_analise IS NOT NULL THEN
        INSERT INTO public.notifications(user_id,title,message,type,link_to,metadata)
        SELECT NEW.responsavel_analise, 'Solicitação de privacidade atribuída',
               'Você foi definido como responsável pelo atendimento de uma solicitação de titular.',
               'info', '/privacidade',
               jsonb_build_object('tipo','privacidade_atribuicao','solicitacao_id',NEW.id)
         WHERE NOT EXISTS (
           SELECT 1 FROM public.notifications n
            WHERE n.user_id=NEW.responsavel_analise
              AND n.metadata->>'tipo'='privacidade_atribuicao'
              AND n.metadata->>'solicitacao_id'=NEW.id::text
         )
           AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id=NEW.responsavel_analise);
      END IF;
    END IF;
    IF NEW.prazo_resposta IS DISTINCT FROM OLD.prazo_resposta OR NEW.prorrogada_ate IS DISTINCT FROM OLD.prorrogada_ate THEN
      INSERT INTO public.dados_solicitacao_eventos(empresa_id,solicitacao_id,tipo,descricao,metadados,created_by)
      VALUES(NEW.empresa_id,NEW.id,'prazo','Prazo de resposta atualizado.',jsonb_build_object('prazo',NEW.prazo_resposta,'prorrogada_ate',NEW.prorrogada_ate,'motivo',NEW.motivo_prorrogacao),auth.uid());
    END IF;
    IF NEW.data_resposta IS DISTINCT FROM OLD.data_resposta OR NEW.resposta_titular IS DISTINCT FROM OLD.resposta_titular THEN
      INSERT INTO public.dados_solicitacao_eventos(empresa_id,solicitacao_id,tipo,descricao,metadados,created_by)
      VALUES(NEW.empresa_id,NEW.id,'resposta','Resposta ao titular registrada ou atualizada.',jsonb_build_object('data_resposta',NEW.data_resposta,'canal',NEW.canal_resposta),auth.uid());
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.dados_solicitacao_eventos(empresa_id, solicitacao_id, tipo, descricao, metadados, created_by)
      VALUES (NEW.empresa_id, NEW.id,
        CASE WHEN NEW.status IN ('atendida','rejeitada') THEN 'conclusao' ELSE 'nota' END,
        'Status alterado de ' || OLD.status || ' para ' || NEW.status || '.',
        jsonb_build_object('antes', OLD.status, 'depois', NEW.status), auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_evento_solicitacao_privacidade ON public.dados_solicitacoes_titular;
CREATE TRIGGER tg_evento_solicitacao_privacidade
  AFTER INSERT OR UPDATE ON public.dados_solicitacoes_titular
  FOR EACH ROW EXECUTE FUNCTION public.tg_evento_solicitacao_privacidade();

-- Alertas diários sem serviço externo nem chave embutida. O mesmo caso pode
-- reaparecer no dia seguinte enquanto continuar pendente, mas nunca duplica
-- dentro do mesmo dia para o mesmo destinatário.
CREATE OR REPLACE FUNCTION public.processar_alertas_privacidade()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $$
DECLARE v_inseridos integer := 0; v_linhas integer;
BEGIN
  INSERT INTO public.notifications(user_id,title,message,type,link_to,metadata)
  SELECT p.user_id,
         CASE WHEN COALESCE(s.prorrogada_ate,s.prazo_resposta) < CURRENT_DATE
              THEN 'Solicitação de privacidade vencida'
              ELSE 'Prazo de privacidade próximo' END,
         CASE WHEN COALESCE(s.prorrogada_ate,s.prazo_resposta) < CURRENT_DATE
              THEN 'Uma solicitação de titular está fora do prazo.'
              ELSE 'Uma solicitação de titular vence em até 3 dias.' END,
         CASE WHEN COALESCE(s.prorrogada_ate,s.prazo_resposta) < CURRENT_DATE THEN 'error' ELSE 'warning' END,
         '/privacidade',
         jsonb_build_object('tipo','privacidade_prazo','solicitacao_id',s.id,
           'prazo',COALESCE(s.prorrogada_ate,s.prazo_resposta),
           'alerta_chave',s.id::text || ':' || CURRENT_DATE::text)
    FROM public.dados_solicitacoes_titular s
    JOIN public.profiles p ON p.empresa_id=s.empresa_id AND p.ativo
     AND COALESCE(p.notificar_na_aplicacao,true)
     AND ((s.responsavel_analise IS NOT NULL AND p.user_id=s.responsavel_analise)
       OR (s.responsavel_analise IS NULL AND p.role::text IN ('admin','super_admin')))
    JOIN auth.users au ON au.id=p.user_id
   WHERE s.status NOT IN ('atendida','rejeitada')
     AND COALESCE(s.prorrogada_ate,s.prazo_resposta) <= CURRENT_DATE + 3
     AND NOT EXISTS (
       SELECT 1 FROM public.notifications n WHERE n.user_id=p.user_id
         AND n.metadata->>'alerta_chave'=s.id::text || ':' || CURRENT_DATE::text
     );
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  v_inseridos := v_inseridos + v_linhas;

  INSERT INTO public.notifications(user_id,title,message,type,link_to,metadata)
  SELECT p.user_id, 'Prazo de comunicação de incidente',
         CASE WHEN d.prazo_autoridade < now()
              THEN 'O prazo de comunicação do incidente de privacidade venceu.'
              ELSE 'O prazo de comunicação do incidente de privacidade vence em até 24 horas.' END,
         CASE WHEN d.prazo_autoridade < now() THEN 'error' ELSE 'warning' END,
         '/privacidade',
         jsonb_build_object('tipo','privacidade_incidente_prazo','incidente_id',i.id,
           'prazo',d.prazo_autoridade,
           'alerta_chave','incidente:' || i.id::text || ':' || CURRENT_DATE::text)
    FROM public.privacidade_incidente_detalhes d
    JOIN public.incidentes i ON i.id=d.incidente_id
    JOIN public.profiles p ON p.empresa_id=d.empresa_id AND p.ativo
     AND COALESCE(p.notificar_na_aplicacao,true)
     AND ((i.responsavel_tratamento IS NOT NULL AND p.user_id=i.responsavel_tratamento)
       OR (i.responsavel_tratamento IS NULL AND p.role::text IN ('admin','super_admin')))
    JOIN auth.users au ON au.id=p.user_id
   WHERE d.prazo_autoridade <= now() + interval '24 hours'
     AND d.autoridade_notificada_em IS NULL
     AND d.decisao_notificar='notificar'
     AND NOT EXISTS (
       SELECT 1 FROM public.notifications n WHERE n.user_id=p.user_id
         AND n.metadata->>'alerta_chave'='incidente:' || i.id::text || ':' || CURRENT_DATE::text
     );
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  RETURN v_inseridos + v_linhas;
END $$;
REVOKE ALL ON FUNCTION public.processar_alertas_privacidade() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.processar_alertas_privacidade() TO service_role;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='daily-privacy-deadline-alerts';
    PERFORM cron.schedule(
      'daily-privacy-deadline-alerts',
      '0 11 * * *',
      'SELECT public.processar_alertas_privacidade();'
    );
  END IF;
END $$;

-- ── Escritas atómicas ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.criar_tratamento_ropa_completo(
  p_empresa_id uuid,
  p_exercicio_id uuid,
  p_payload jsonb,
  p_dados_ids uuid[],
  p_ativos_ids uuid[],
  p_bases jsonb DEFAULT '[]'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'public','pg_temp' AS $$
DECLARE v_ropa_id uuid; v_dado uuid; v_ativo uuid; v_base jsonb;
BEGIN
  IF p_empresa_id IS DISTINCT FROM public.get_user_empresa_id()
     OR NOT public.usuario_tem_permissao_modulo('dados','create') THEN
    RAISE EXCEPTION 'Sem permissão para criar tratamentos de dados';
  END IF;
  IF COALESCE(btrim(p_payload->>'nome_tratamento'),'') = ''
     OR COALESCE(btrim(p_payload->>'finalidade'),'') = ''
     OR COALESCE(btrim(p_payload->>'categoria_titulares'),'') = ''
     OR COALESCE(btrim(p_payload->>'prazo_retencao'),'') = '' THEN
    RAISE EXCEPTION 'Nome, finalidade, categoria de titulares e retenção são obrigatórios';
  END IF;

  INSERT INTO public.ropa_registros(
    empresa_id, exercicio_id, nome_tratamento, finalidade, base_legal,
    categoria_titulares, prazo_retencao, medidas_seguranca, status, created_by
  ) VALUES (
    p_empresa_id, p_exercicio_id, btrim(p_payload->>'nome_tratamento'),
    btrim(p_payload->>'finalidade'), COALESCE(NULLIF(p_payload->>'base_legal',''),'a_definir'),
    btrim(p_payload->>'categoria_titulares'), btrim(p_payload->>'prazo_retencao'),
    NULLIF(btrim(p_payload->>'medidas_seguranca'),''), COALESCE(NULLIF(p_payload->>'status',''),'ativo'), auth.uid()
  ) RETURNING id INTO v_ropa_id;

  FOREACH v_dado IN ARRAY COALESCE(p_dados_ids, ARRAY[]::uuid[]) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.dados_pessoais WHERE id=v_dado AND empresa_id=p_empresa_id) THEN
      RAISE EXCEPTION 'Dado pessoal não pertence à empresa';
    END IF;
    INSERT INTO public.ropa_dados_vinculados(ropa_id,dados_pessoais_id)
    VALUES(v_ropa_id,v_dado) ON CONFLICT DO NOTHING;
    FOREACH v_ativo IN ARRAY COALESCE(p_ativos_ids, ARRAY[]::uuid[]) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.ativos WHERE id=v_ativo AND empresa_id=p_empresa_id) THEN
        RAISE EXCEPTION 'Ativo não pertence à empresa';
      END IF;
      INSERT INTO public.dados_mapeamento(dados_pessoais_id,ativo_id,tipo_armazenamento,observacoes)
      VALUES(v_dado,v_ativo,'primario','Vinculado via ROPA: ' || btrim(p_payload->>'nome_tratamento'))
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  IF jsonb_array_length(COALESCE(p_bases,'[]'::jsonb)) = 0 THEN
    p_bases := jsonb_build_array(jsonb_build_object(
      'base_legal', p_payload->>'base_legal',
      'justificativa', p_payload->>'justificativa_base_legal',
      'abrangencia', 'Tratamento completo'));
  END IF;
  FOR v_base IN SELECT value FROM jsonb_array_elements(p_bases) LOOP
    IF COALESCE(btrim(v_base->>'base_legal'),'') = ''
       OR COALESCE(btrim(v_base->>'justificativa'),'') = ''
       OR COALESCE(btrim(v_base->>'abrangencia'),'') = '' THEN
      RAISE EXCEPTION 'Cada base legal precisa de justificativa e abrangência';
    END IF;
    INSERT INTO public.ropa_bases_legais(ropa_id,empresa_id,base_legal,justificativa,abrangencia,ordem)
    VALUES(v_ropa_id,p_empresa_id,btrim(v_base->>'base_legal'),btrim(v_base->>'justificativa'),
           btrim(v_base->>'abrangencia'),
           (SELECT count(*) FROM public.ropa_bases_legais WHERE ropa_id=v_ropa_id));
  END LOOP;
  RETURN v_ropa_id;
END $$;
REVOKE ALL ON FUNCTION public.criar_tratamento_ropa_completo(uuid,uuid,jsonb,uuid[],uuid[],jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_tratamento_ropa_completo(uuid,uuid,jsonb,uuid[],uuid[],jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.substituir_bases_ropa(p_ropa_id uuid, p_bases jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'public','pg_temp' AS $$
DECLARE v_empresa uuid; v_base jsonb; v_ordem integer := 0;
BEGIN
  SELECT empresa_id INTO v_empresa FROM public.ropa_registros WHERE id=p_ropa_id;
  IF v_empresa IS NULL OR v_empresa IS DISTINCT FROM public.get_user_empresa_id()
     OR NOT public.usuario_tem_permissao_modulo('dados','update') THEN
    RAISE EXCEPTION 'Sem permissão para alterar as bases legais';
  END IF;
  IF jsonb_array_length(COALESCE(p_bases,'[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Informe pelo menos uma base legal';
  END IF;
  DELETE FROM public.ropa_bases_legais WHERE ropa_id=p_ropa_id;
  FOR v_base IN SELECT value FROM jsonb_array_elements(p_bases) LOOP
    IF COALESCE(btrim(v_base->>'base_legal'),'') = ''
       OR COALESCE(btrim(v_base->>'justificativa'),'') = ''
       OR COALESCE(btrim(v_base->>'abrangencia'),'') = '' THEN
      RAISE EXCEPTION 'Cada base legal precisa de justificativa e abrangência';
    END IF;
    INSERT INTO public.ropa_bases_legais(ropa_id,empresa_id,base_legal,justificativa,abrangencia,ordem)
    VALUES(p_ropa_id,v_empresa,btrim(v_base->>'base_legal'),btrim(v_base->>'justificativa'),btrim(v_base->>'abrangencia'),v_ordem);
    v_ordem := v_ordem + 1;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.substituir_bases_ropa(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.substituir_bases_ropa(uuid,jsonb) TO authenticated;

-- ── Portal público do titular ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.portal_privacidade_publico(text);
CREATE FUNCTION public.portal_privacidade_publico(p_slug text)
RETURNS TABLE(titulo text, introducao text, contato_dpo text, jurisdicao text, empresa_nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT p.titulo, p.introducao, p.contato_dpo, COALESCE(e.jurisdicao,'BR'), e.nome
    FROM public.privacidade_portais p
    JOIN public.empresas e ON e.id=p.empresa_id
   WHERE p.slug=p_slug AND p.ativo
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.portal_privacidade_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_privacidade_publico(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.criar_solicitacao_privacidade_publica(
  p_slug text, p_tipo text, p_dados_titular jsonb, p_dados_solicitados text,
  p_justificativa text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $$
DECLARE v_empresa uuid; v_jurisdicao text; v_pequeno_porte boolean; v_id uuid; v_prazo date; v_nome text; v_email text;
BEGIN
  SELECT p.empresa_id, COALESCE(e.jurisdicao,'BR'), COALESCE(e.agente_tratamento_pequeno_porte,false)
    INTO v_empresa,v_jurisdicao,v_pequeno_porte
    FROM public.privacidade_portais p JOIN public.empresas e ON e.id=p.empresa_id
   WHERE p.slug=p_slug AND p.ativo;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Portal não encontrado ou inativo'; END IF;
  v_nome := btrim(COALESCE(p_dados_titular->>'nome',''));
  v_email := btrim(COALESCE(p_dados_titular->>'email',''));
  IF v_nome = '' OR v_email = '' OR position('@' in v_email) < 2 THEN
    RAISE EXCEPTION 'Nome e e-mail válido são obrigatórios';
  END IF;
  IF p_tipo NOT IN ('confirmacao','acesso','correcao','retificacao','anonimizacao','apagamento','limitacao','portabilidade','eliminacao','informacao','revogacao','oposicao','decisaoAutomatizada') THEN
    RAISE EXCEPTION 'Direito solicitado inválido';
  END IF;
  IF (SELECT count(*) FROM public.dados_solicitacoes_titular s
       WHERE s.empresa_id=v_empresa
         AND lower(COALESCE(s.dados_titular->>'email',''))=lower(v_email)
         AND s.created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'Limite temporário de solicitações atingido. Tente novamente mais tarde.';
  END IF;
  v_prazo := CASE
    WHEN v_jurisdicao IN ('PT_EU','INTL') THEN (CURRENT_DATE + interval '1 month')::date
    WHEN v_jurisdicao='BR' AND p_tipo='confirmacao' THEN CURRENT_DATE
    WHEN v_jurisdicao='BR' AND v_pequeno_porte THEN CURRENT_DATE + 30
    ELSE CURRENT_DATE + 15 END;
  INSERT INTO public.dados_solicitacoes_titular(
    empresa_id,tipo_solicitacao,dados_titular,dados_solicitados,justificativa,
    canal_solicitacao,status,data_solicitacao,recebida_em,prazo_resposta,prazo_fonte,identidade_status
  ) VALUES (
    v_empresa,p_tipo,p_dados_titular,p_dados_solicitados,p_justificativa,
    'portal','pendente',now(),now(),v_prazo,
    'legal',
    'pendente'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.criar_solicitacao_privacidade_publica(text,text,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_solicitacao_privacidade_publica(text,text,jsonb,text,text) TO anon, authenticated;

-- Consulta pública deliberadamente mínima: o protocolo UUID, o endereço do
-- portal e o e-mail precisam coincidir. Nenhuma nota interna, documento ou
-- conteúdo da resposta atravessa esta fronteira anônima.
DROP FUNCTION IF EXISTS public.consultar_solicitacao_privacidade_publica(text,uuid,text);
CREATE FUNCTION public.consultar_solicitacao_privacidade_publica(
  p_slug text, p_protocolo uuid, p_email text
) RETURNS TABLE(
  tipo_solicitacao text,
  status text,
  data_solicitacao timestamptz,
  prazo_resposta date,
  prorrogada_ate date,
  data_resposta timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $$
  SELECT s.tipo_solicitacao, s.status, s.data_solicitacao,
         s.prazo_resposta, s.prorrogada_ate, s.data_resposta
    FROM public.dados_solicitacoes_titular s
    JOIN public.privacidade_portais p ON p.empresa_id=s.empresa_id
   WHERE p.slug=p_slug
     AND p.ativo
     AND s.id=p_protocolo
     AND lower(COALESCE(s.dados_titular->>'email',''))=lower(btrim(p_email))
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.consultar_solicitacao_privacidade_publica(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultar_solicitacao_privacidade_publica(text,uuid,text) TO anon, authenticated;

-- Uma abertura da jornada fazia treze chamadas REST independentes. Esta
-- leitura reúne o painel em um único snapshot do banco, ainda como INVOKER:
-- as RLS de cada tabela continuam valendo e nenhuma empresa atravessa tenant.
CREATE OR REPLACE FUNCTION public.obter_centro_privacidade(p_empresa_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO 'public','pg_temp' AS $$
DECLARE v_resultado jsonb;
BEGIN
  IF p_empresa_id IS DISTINCT FROM public.get_user_empresa_id()
     OR NOT public.usuario_tem_permissao_modulo('dados','read') THEN
    RAISE EXCEPTION 'Sem permissão para consultar o programa de privacidade';
  END IF;
  SELECT jsonb_build_object(
    'avaliacoes', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.privacidade_avaliacoes x WHERE x.empresa_id=p_empresa_id),'[]'::jsonb),
    'fluxos', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.dados_fluxos x WHERE x.empresa_id=p_empresa_id),'[]'::jsonb),
    'terceiros', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.nome) FROM public.privacidade_terceiros x WHERE x.empresa_id=p_empresa_id),'[]'::jsonb),
    'retencoes', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.proxima_execucao NULLS LAST) FROM public.privacidade_retencoes x WHERE x.empresa_id=p_empresa_id),'[]'::jsonb),
    'consentimentos', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.coletado_em DESC) FROM public.privacidade_consentimentos x WHERE x.empresa_id=p_empresa_id),'[]'::jsonb),
    'detalhesIncidentes', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.privacidade_incidente_detalhes x WHERE x.empresa_id=p_empresa_id),'[]'::jsonb),
    'portal', (SELECT to_jsonb(x) FROM public.privacidade_portais x WHERE x.empresa_id=p_empresa_id LIMIT 1),
    'auditoria', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT * FROM public.privacidade_auditoria a WHERE a.empresa_id=p_empresa_id ORDER BY a.created_at DESC LIMIT 100) x),'[]'::jsonb),
    'incidentes', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'titulo',x.titulo,'status',x.status,'criticidade',x.criticidade,'data_ocorrencia',x.data_ocorrencia) ORDER BY x.created_at DESC) FROM public.incidentes x WHERE x.empresa_id=p_empresa_id AND x.tipo_incidente='privacidade'),'[]'::jsonb),
    'projetos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.nome,'status',x.status) ORDER BY x.nome) FROM public.projetos x WHERE x.empresa_id=p_empresa_id),'[]'::jsonb),
    'riscos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.nome,'status',x.status) ORDER BY x.nome) FROM public.riscos x WHERE x.empresa_id=p_empresa_id),'[]'::jsonb),
    'planos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'titulo',x.titulo,'status',x.status) ORDER BY x.titulo) FROM public.planos_acao x WHERE x.empresa_id=p_empresa_id),'[]'::jsonb),
    'contratos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.nome,'status',x.status) ORDER BY x.nome) FROM public.contratos x WHERE x.empresa_id=p_empresa_id),'[]'::jsonb)
  ) INTO v_resultado;
  RETURN v_resultado;
END $$;
REVOKE ALL ON FUNCTION public.obter_centro_privacidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_centro_privacidade(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_dsar_email_recente
  ON public.dados_solicitacoes_titular (empresa_id, lower((dados_titular->>'email')), created_at DESC);

-- updated_at nas novas tabelas editáveis.
DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'privacidade_terceiros','privacidade_retencoes','privacidade_consentimentos',
    'privacidade_avaliacoes','privacidade_incidente_detalhes','privacidade_portais'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', v_table);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', v_table);
  END LOOP;
END $$;
