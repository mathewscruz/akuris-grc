-- Apuração com autor, reunião presencial, e o sigilo que faltava à trilha.
--
-- Três coisas, por ordem de gravidade.
--
-- ## 1. A trilha interna estava a ser mostrada a quem denunciou
--
-- `denuncias_movimentacoes.observacoes` é onde o investigador escreve o que
-- pensa do caso — "falei com o RH", "a versão do acusado não bate". O campo
-- chama-se «Observações da Movimentação» e nada, em lado nenhum do ecrã, diz
-- que sai do comité.
--
-- Sai. `consult_denuncia_publica` devolvia `m.observacoes` em todas as
-- movimentações, e a tela de consulta imprime-as. Ou seja: a deliberação
-- interna aparecia ao denunciante, palavra por palavra, desde que o módulo
-- existe.
--
-- A separação certa não é de campo, é de intenção: o que se diz A QUEM
-- DENUNCIOU já tem canal próprio (`denuncias_mensagens`). A trilha é do
-- comité. Passa a haver `visibilidade`, com 'interna' por omissão, e o
-- histórico existente é todo marcado como interno — porque foi escrito por
-- quem julgava estar a escrever para dentro.
--
-- ## 2. A trilha não dizia quem
--
-- `usuario_id` existe na tabela desde 2025, tem chave estrangeira para
-- `profiles`, e nenhuma das duas escritas da aplicação o preenchia. O
-- histórico respondia «o quê» e «quando» e nunca «quem» — que é precisamente
-- o que uma apuração com várias mãos precisa de responder.
--
-- O DEFAULT auth.uid() fecha isto no sítio certo: mesmo que uma escrita
-- futura se esqueça, a linha nasce assinada.
--
-- ## 3. A reunião presencial do art. 9.º/2
--
-- A Diretiva (UE) 2019/1937 manda o canal permitir, a pedido do denunciante,
-- uma reunião presencial. E o art. 18.º/2 diz o que fazer com ela: registo
-- completo e exacto, com CONSENTIMENTO, e oportunidade de a pessoa verificar,
-- rectificar e aceitar a acta. Sem o segundo, o primeiro é só uma marcação de
-- agenda.

-- ---------------------------------------------------------------------------
-- 1. Sigilo da trilha
-- ---------------------------------------------------------------------------

ALTER TABLE public.denuncias_movimentacoes
  ADD COLUMN IF NOT EXISTS visibilidade text NOT NULL DEFAULT 'interna';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'denuncias_movimentacoes_visibilidade_check'
  ) THEN
    ALTER TABLE public.denuncias_movimentacoes
      ADD CONSTRAINT denuncias_movimentacoes_visibilidade_check
      CHECK (visibilidade IN ('interna', 'publica'));
  END IF;
END $$;

-- Tudo o que já lá está foi escrito como nota interna. Fica interna.
UPDATE public.denuncias_movimentacoes SET visibilidade = 'interna'
WHERE visibilidade IS DISTINCT FROM 'interna';

COMMENT ON COLUMN public.denuncias_movimentacoes.visibilidade IS
  'interna = só o comité lê; publica = o texto acompanha a consulta por '
  'protocolo. Por omissão é interna: a deliberação da apuração não é retorno '
  'ao denunciante — para isso existe denuncias_mensagens.';

-- ---------------------------------------------------------------------------
-- 2. Autoria da trilha
-- ---------------------------------------------------------------------------

ALTER TABLE public.denuncias_movimentacoes
  ALTER COLUMN usuario_id SET DEFAULT auth.uid();

COMMENT ON COLUMN public.denuncias_movimentacoes.usuario_id IS
  'Quem registou. O DEFAULT auth.uid() assina a linha mesmo quando quem '
  'escreve se esquece — numa apuração com várias mãos, uma trilha sem autor '
  'não é trilha. Nulo quando a linha vem do próprio sistema (service_role).';

/*
  O registo da denúncia passa a ser a primeira linha da trilha.

  Sem isto a linha do tempo de quem denunciou nascia vazia e só ganhava o
  primeiro item quando alguém do comité mexia — podia demorar dias, e nesse
  intervalo a consulta por protocolo dizia «sem histórico» a uma pessoa que
  acabara de registar uma denúncia. É pública de propósito: é o facto dela.
*/
CREATE OR REPLACE FUNCTION public.tg_denuncia_trilha_inicial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.denuncias_movimentacoes
    (denuncia_id, acao, status_anterior, status_novo, visibilidade, usuario_id)
  VALUES (NEW.id, 'registada', NULL, NEW.status, 'publica', NULL);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_denuncia_trilha_inicial ON public.denuncias;
CREATE TRIGGER trg_denuncia_trilha_inicial
  AFTER INSERT ON public.denuncias
  FOR EACH ROW EXECUTE FUNCTION public.tg_denuncia_trilha_inicial();

-- ---------------------------------------------------------------------------
-- 3. Identificação em três níveis
-- ---------------------------------------------------------------------------

/*
  `anonima` é booleano e obriga a escolher entre extremos: dar o nome sem
  saber quem o vai ver, ou desaparecer e perder o contacto directo.

  A Diretiva trata os dois separadamente: a CONFIDENCIALIDADE é obrigatória
  (art. 16.º) e o ANONIMATO é opcional (art. 6.º/2). O meio-termo —
  identifico-me ao comité, e a minha identidade não sai dali — é o caso
  normal, e era o único que o canal não sabia representar. Passa a haver três
  níveis, e o booleano continua a existir, sincronizado, para nada do que já
  lê `anonima` se partir.
*/
ALTER TABLE public.denuncias
  ADD COLUMN IF NOT EXISTS nivel_identificacao text;

UPDATE public.denuncias
SET nivel_identificacao = CASE WHEN anonima THEN 'anonima' ELSE 'identificada' END
WHERE nivel_identificacao IS NULL;

ALTER TABLE public.denuncias
  ALTER COLUMN nivel_identificacao SET DEFAULT 'anonima';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'denuncias_nivel_identificacao_check'
  ) THEN
    ALTER TABLE public.denuncias
      ADD CONSTRAINT denuncias_nivel_identificacao_check
      CHECK (nivel_identificacao IN ('identificada', 'confidencial', 'anonima'));
  END IF;
END $$;

COMMENT ON COLUMN public.denuncias.nivel_identificacao IS
  'identificada = pode ser contactada e não pediu reserva; confidencial = '
  'identifica-se ao comité e a identidade NÃO sai dele (art. 16.º); anonima = '
  'não se identifica (art. 6.º/2). `anonima` é mantido em sincronia por '
  'trigger para o código antigo continuar a ler.';

CREATE OR REPLACE FUNCTION public.tg_denuncia_sincroniza_anonimato()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.nivel_identificacao IS NULL THEN
    NEW.nivel_identificacao := CASE WHEN NEW.anonima THEN 'anonima' ELSE 'identificada' END;
  END IF;
  NEW.anonima := (NEW.nivel_identificacao = 'anonima');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_denuncia_sincroniza_anonimato ON public.denuncias;
CREATE TRIGGER trg_denuncia_sincroniza_anonimato
  BEFORE INSERT OR UPDATE ON public.denuncias
  FOR EACH ROW EXECUTE FUNCTION public.tg_denuncia_sincroniza_anonimato();

-- ---------------------------------------------------------------------------
-- 4. Reunião presencial (art. 9.º/2 e art. 18.º/2)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.denuncias_reunioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'solicitada',
  modalidade text NOT NULL DEFAULT 'presencial',
  -- Escrito por quem denunciou: quando lhe dá jeito, como prefere ser contactada.
  preferencia text,
  solicitada_em timestamptz NOT NULL DEFAULT now(),
  agendada_para timestamptz,
  local text,
  -- A resposta do comité, incluindo a recusa fundamentada.
  resposta text,
  realizada_em timestamptz,
  -- art. 18.º/2: registo completo e exacto, mediante consentimento.
  ata text,
  consentimento_registo boolean NOT NULL DEFAULT false,
  -- ...e a oportunidade de verificar, rectificar e aceitar.
  ata_partilhada_em timestamptz,
  ata_confirmada_em timestamptz,
  criado_por uuid,
  atualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT denuncias_reunioes_estado_check
    CHECK (estado IN ('solicitada', 'agendada', 'realizada', 'recusada', 'cancelada')),
  CONSTRAINT denuncias_reunioes_modalidade_check
    CHECK (modalidade IN ('presencial', 'videochamada', 'telefone')),
  -- A acta só se partilha quando existe e quando houve consentimento.
  CONSTRAINT denuncias_reunioes_ata_consentida_check
    CHECK (ata_partilhada_em IS NULL OR (ata IS NOT NULL AND consentimento_registo))
);

CREATE INDEX IF NOT EXISTS idx_denuncias_reunioes_denuncia
  ON public.denuncias_reunioes(denuncia_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_reunioes_empresa_estado
  ON public.denuncias_reunioes(empresa_id, estado);

COMMENT ON TABLE public.denuncias_reunioes IS
  'A reunião que o art. 9.º/2 da Diretiva (UE) 2019/1937 manda permitir a '
  'pedido do denunciante, com o registo que o art. 18.º/2 exige: acta, '
  'consentimento, e confirmação por quem denunciou.';

ALTER TABLE public.denuncias_reunioes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comite ve reunioes" ON public.denuncias_reunioes;
CREATE POLICY "Comite ve reunioes" ON public.denuncias_reunioes
  FOR SELECT TO authenticated
  USING (public.pode_ver_denuncia(denuncia_id));

DROP POLICY IF EXISTS "Comite marca reunioes" ON public.denuncias_reunioes;
CREATE POLICY "Comite marca reunioes" ON public.denuncias_reunioes
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_ver_denuncia(denuncia_id));

DROP POLICY IF EXISTS "Comite atualiza reunioes" ON public.denuncias_reunioes;
CREATE POLICY "Comite atualiza reunioes" ON public.denuncias_reunioes
  FOR UPDATE TO authenticated
  USING (public.pode_ver_denuncia(denuncia_id))
  WITH CHECK (public.pode_ver_denuncia(denuncia_id));

DROP POLICY IF EXISTS "Require valid MFA session" ON public.denuncias_reunioes;
CREATE POLICY "Require valid MFA session" ON public.denuncias_reunioes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_valid_mfa_session())
  WITH CHECK (public.has_valid_mfa_session());

DROP TRIGGER IF EXISTS trg_denuncias_reunioes_updated ON public.denuncias_reunioes;
CREATE TRIGGER trg_denuncias_reunioes_updated
  BEFORE UPDATE ON public.denuncias_reunioes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. As três tabelas da onda 1 e 2 que ficaram fora do MFA
-- ---------------------------------------------------------------------------

/*
  `denuncias` exige sessão com MFA válido. `denuncias_mensagens`, que carrega
  o que o denunciante escreveu, e `denuncias_comite`, que diz quem tem acesso
  a tudo, não exigiam — foram criadas nas ondas anteriores e a política
  restritiva não foi replicada. Uma sessão sem MFA não conseguia abrir a
  denúncia e conseguia ler a conversa dela.
*/
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['denuncias_mensagens', 'denuncias_comite', 'denuncias_impedimentos']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Require valid MFA session', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (public.has_valid_mfa_session()) WITH CHECK (public.has_valid_mfa_session())',
      'Require valid MFA session', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. A consulta pública deixa de expor a deliberação
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consult_denuncia_publica(
  p_empresa_slug text, p_protocolo text, p_tracking_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_denuncia public.denuncias%ROWTYPE;
BEGIN
  SELECT d.* INTO v_denuncia
  FROM public.denuncias d
  JOIN public.empresas e ON e.id = d.empresa_id
  WHERE e.slug = p_empresa_slug
    AND upper(d.protocolo) = upper(p_protocolo)
    AND d.token_acompanhamento_hash = p_tracking_hash
    AND d.token_acompanhamento_revoked_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_denuncia.id,
    'protocolo', v_denuncia.protocolo,
    'titulo', v_denuncia.titulo,
    'descricao', v_denuncia.descricao,
    'status', v_denuncia.status,
    'gravidade', v_denuncia.gravidade,
    'created_at', v_denuncia.created_at,
    'data_atribuicao', v_denuncia.data_atribuicao,
    'data_inicio_investigacao', v_denuncia.data_inicio_investigacao,
    'data_conclusao', v_denuncia.data_conclusao,
    'nivel_identificacao', v_denuncia.nivel_identificacao,
    'categoria', (
      SELECT jsonb_build_object('nome', c.nome, 'cor', c.cor)
      FROM public.denuncias_categorias c WHERE c.id = v_denuncia.categoria_id
    ),
    'data_acusacao_recebimento', v_denuncia.data_acusacao_recebimento,
    'prazo_retorno', v_denuncia.prazo_retorno,
    'resultado', v_denuncia.resultado,
    -- O QUE aconteceu é direito de quem denunciou; o que o comité ESCREVEU
    -- sobre o caso não é. Só sai o texto marcado como público.
    'movimentacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'acao', m.acao,
        'status_anterior', m.status_anterior, 'status_novo', m.status_novo,
        'observacoes', CASE WHEN m.visibilidade = 'publica' THEN m.observacoes END,
        'created_at', m.created_at
      ) ORDER BY m.created_at)
      FROM public.denuncias_movimentacoes m
      WHERE m.denuncia_id = v_denuncia.id
    ), '[]'::jsonb),
    'mensagens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', msg.id, 'autor_tipo', msg.autor_tipo,
        'mensagem', msg.mensagem, 'created_at', msg.created_at
      ) ORDER BY msg.created_at)
      FROM public.denuncias_mensagens msg
      WHERE msg.denuncia_id = v_denuncia.id
    ), '[]'::jsonb),
    -- A reunião, do lado de quem a pediu: estado, quando, onde, e a acta
    -- quando já lhe foi partilhada para verificar.
    'reunioes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'estado', r.estado, 'modalidade', r.modalidade,
        'solicitada_em', r.solicitada_em, 'agendada_para', r.agendada_para,
        'local', r.local, 'resposta', r.resposta,
        'ata', CASE WHEN r.ata_partilhada_em IS NOT NULL THEN r.ata END,
        'ata_partilhada_em', r.ata_partilhada_em,
        'ata_confirmada_em', r.ata_confirmada_em
      ) ORDER BY r.solicitada_em)
      FROM public.denuncias_reunioes r
      WHERE r.denuncia_id = v_denuncia.id
    ), '[]'::jsonb)
  );
END $function$;

-- ---------------------------------------------------------------------------
-- 7. O registo público aceita o nível de identificação
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_denuncia_publica(
  text, uuid, text, text, boolean, boolean, text, text, text, text, date,
  text, text, text, text, inet, text
);

CREATE FUNCTION public.create_denuncia_publica(
  p_empresa_slug text, p_categoria_id uuid, p_titulo text, p_descricao text,
  p_anonima boolean, p_politica_aceita boolean, p_denunciante_nome text,
  p_denunciante_email text, p_denunciante_telefone text, p_local_ocorrencia text,
  p_data_ocorrencia date, p_testemunhas text, p_evidencias_descricao text,
  p_tracking_hash text, p_fingerprint_hash text, p_client_ip inet,
  p_user_agent text, p_nivel_identificacao text DEFAULT NULL
)
RETURNS TABLE(id uuid, protocolo text, empresa_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_portal_active boolean;
  v_allow_anonymous boolean;
  v_require_email boolean;
  v_id uuid;
  v_protocol text;
  v_attempt integer := 0;
  v_recent integer;
  v_nivel text;
  v_anonima boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- O nível manda; `p_anonima` fica como forma antiga de dizer o mesmo.
  v_nivel := COALESCE(
    nullif(btrim(p_nivel_identificacao), ''),
    CASE WHEN p_anonima THEN 'anonima' ELSE 'identificada' END
  );
  IF v_nivel NOT IN ('identificada', 'confidencial', 'anonima') THEN
    RAISE EXCEPTION 'invalid report' USING ERRCODE = '22023';
  END IF;
  v_anonima := (v_nivel = 'anonima');

  IF p_empresa_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
     OR length(btrim(p_titulo)) NOT BETWEEN 8 AND 160
     OR length(btrim(p_descricao)) NOT BETWEEN 20 AND 10000
     OR p_politica_aceita IS DISTINCT FROM true
     OR p_tracking_hash !~ '^[0-9a-f]{64}$'
     OR p_fingerprint_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid report' USING ERRCODE = '22023';
  END IF;

  SELECT e.id, c.ativo, c.permitir_anonimas, c.requerer_email
    INTO v_empresa_id, v_portal_active, v_allow_anonymous, v_require_email
  FROM public.empresas e
  JOIN public.denuncias_configuracoes c ON c.empresa_id = e.id
  WHERE e.slug = p_empresa_slug AND e.ativo = true
  LIMIT 1;

  IF v_empresa_id IS NULL OR v_portal_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'portal unavailable' USING ERRCODE = '22023';
  END IF;
  IF v_anonima AND v_allow_anonymous IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'anonymous reports disabled' USING ERRCODE = '22023';
  END IF;
  -- Quem se identifica — mesmo pedindo reserva — tem de deixar nome.
  IF NOT v_anonima AND nullif(btrim(p_denunciante_nome), '') IS NULL THEN
    RAISE EXCEPTION 'invalid report' USING ERRCODE = '22023';
  END IF;
  IF v_require_email AND (v_anonima OR nullif(btrim(p_denunciante_email), '') IS NULL) THEN
    RAISE EXCEPTION 'email required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.denuncias_categorias dc
    WHERE dc.id = p_categoria_id AND dc.empresa_id = v_empresa_id AND dc.ativo = true
  ) THEN
    RAISE EXCEPTION 'invalid category' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':' || p_fingerprint_hash, 0)
  );
  DELETE FROM public.denuncia_submission_limits dsl
  WHERE dsl.created_at < now() - interval '24 hours';

  SELECT count(*) INTO v_recent
  FROM public.denuncia_submission_limits dsl
  WHERE dsl.empresa_id = v_empresa_id
    AND dsl.fingerprint_hash = p_fingerprint_hash
    AND dsl.created_at >= now() - interval '1 hour';

  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'rate limit exceeded' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.denuncia_submission_limits (empresa_id, fingerprint_hash)
  VALUES (v_empresa_id, p_fingerprint_hash);

  LOOP
    v_attempt := v_attempt + 1;
    v_protocol := 'DEN-' || to_char(now(), 'YYYYMMDD') || '-' ||
      upper(encode(extensions.gen_random_bytes(8), 'hex'));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.denuncias d WHERE d.protocolo = v_protocol
    );
    IF v_attempt >= 5 THEN
      RAISE EXCEPTION 'protocol generation failed';
    END IF;
  END LOOP;

  INSERT INTO public.denuncias (
    empresa_id, categoria_id, titulo, descricao, anonima, nivel_identificacao,
    nome_denunciante, email_denunciante, denunciante_telefone,
    local_ocorrencia, data_ocorrencia, testemunhas, evidencias_descricao,
    politica_aceita, protocolo, token_publico, token_acompanhamento_hash,
    ip_origem, user_agent, status
  ) VALUES (
    v_empresa_id, p_categoria_id, btrim(p_titulo), btrim(p_descricao),
    v_anonima, v_nivel,
    CASE WHEN v_anonima THEN NULL ELSE nullif(btrim(p_denunciante_nome), '') END,
    CASE WHEN v_anonima THEN NULL ELSE nullif(lower(btrim(p_denunciante_email)), '') END,
    CASE WHEN v_anonima THEN NULL ELSE nullif(btrim(p_denunciante_telefone), '') END,
    nullif(btrim(p_local_ocorrencia), ''), p_data_ocorrencia,
    nullif(btrim(p_testemunhas), ''), nullif(btrim(p_evidencias_descricao), ''),
    true, v_protocol, encode(extensions.gen_random_bytes(32), 'hex'), p_tracking_hash,
    CASE WHEN v_anonima THEN NULL ELSE p_client_ip END,
    CASE WHEN v_anonima THEN NULL ELSE left(p_user_agent, 500) END,
    'nova'
  ) RETURNING denuncias.id INTO v_id;

  RETURN QUERY SELECT v_id, v_protocol, v_empresa_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_denuncia_publica(
  text, uuid, text, text, boolean, boolean, text, text, text, text, date,
  text, text, text, text, inet, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_denuncia_publica(
  text, uuid, text, text, boolean, boolean, text, text, text, text, date,
  text, text, text, text, inet, text, text
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_denuncia_publica(
  text, uuid, text, text, boolean, boolean, text, text, text, text, date,
  text, text, text, text, inet, text, text
) TO service_role;

-- ---------------------------------------------------------------------------
-- 8. O pedido de reunião, do lado de quem não tem conta
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.solicitar_reuniao_denuncia(
  p_denuncia_id uuid, p_tracking_hash text, p_modalidade text, p_preferencia text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_denuncia public.denuncias%ROWTYPE;
  v_permite boolean;
  v_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_modalidade NOT IN ('presencial', 'videochamada', 'telefone') THEN
    RAISE EXCEPTION 'invalid request' USING ERRCODE = '22023';
  END IF;

  SELECT d.* INTO v_denuncia FROM public.denuncias d
  WHERE d.id = p_denuncia_id
    AND d.token_acompanhamento_hash = p_tracking_hash
    AND d.token_acompanhamento_revoked_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT c.permitir_reuniao INTO v_permite
  FROM public.denuncias_configuracoes c WHERE c.empresa_id = v_denuncia.empresa_id;
  IF v_permite IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'meetings disabled' USING ERRCODE = '22023';
  END IF;

  -- Um pedido em aberto de cada vez: dois pedidos idênticos não são dois
  -- direitos, são a mesma pessoa a carregar duas vezes.
  IF EXISTS (
    SELECT 1 FROM public.denuncias_reunioes r
    WHERE r.denuncia_id = v_denuncia.id AND r.estado IN ('solicitada', 'agendada')
  ) THEN
    RAISE EXCEPTION 'meeting already requested' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.denuncias_reunioes
    (denuncia_id, empresa_id, modalidade, preferencia, estado)
  VALUES (
    v_denuncia.id, v_denuncia.empresa_id, p_modalidade,
    nullif(btrim(left(p_preferencia, 2000)), ''), 'solicitada'
  ) RETURNING denuncias_reunioes.id INTO v_id;

  INSERT INTO public.denuncias_movimentacoes
    (denuncia_id, acao, status_anterior, status_novo, visibilidade, usuario_id)
  VALUES (v_denuncia.id, 'reuniao_solicitada', v_denuncia.status, v_denuncia.status,
          'publica', NULL);

  RETURN jsonb_build_object('id', v_id);
END $function$;

REVOKE ALL ON FUNCTION public.solicitar_reuniao_denuncia(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.solicitar_reuniao_denuncia(uuid, text, text, text)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_reuniao_denuncia(uuid, text, text, text)
  TO service_role;

/* A confirmação da acta — a metade do art. 18.º/2 que costuma faltar. */
CREATE OR REPLACE FUNCTION public.confirmar_ata_reuniao(
  p_reuniao_id uuid, p_tracking_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_denuncia_id uuid;
  v_status text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT r.denuncia_id, d.status INTO v_denuncia_id, v_status
  FROM public.denuncias_reunioes r
  JOIN public.denuncias d ON d.id = r.denuncia_id
  WHERE r.id = p_reuniao_id
    AND d.token_acompanhamento_hash = p_tracking_hash
    AND d.token_acompanhamento_revoked_at IS NULL
    AND r.ata_partilhada_em IS NOT NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.denuncias_reunioes
  SET ata_confirmada_em = now()
  WHERE id = p_reuniao_id AND ata_confirmada_em IS NULL;

  INSERT INTO public.denuncias_movimentacoes
    (denuncia_id, acao, status_anterior, status_novo, visibilidade, usuario_id)
  VALUES (v_denuncia_id, 'ata_confirmada', v_status, v_status, 'publica', NULL);

  RETURN jsonb_build_object('ok', true);
END $function$;

REVOKE ALL ON FUNCTION public.confirmar_ata_reuniao(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirmar_ata_reuniao(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_ata_reuniao(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 9. Guardas
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_publicas integer;
  v_default text;
BEGIN
  -- A deliberação não pode sair na consulta pública.
  SELECT count(*) INTO v_publicas
  FROM public.denuncias_movimentacoes
  WHERE visibilidade = 'publica' AND observacoes IS NOT NULL;
  IF v_publicas > 0 THEN
    RAISE EXCEPTION 'canal: % movimentações antigas ficaram públicas com texto', v_publicas;
  END IF;

  -- A trilha tem de nascer assinada.
  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'denuncias_movimentacoes'
    AND column_name = 'usuario_id';
  IF v_default IS NULL OR v_default NOT LIKE '%uid()%' THEN
    RAISE EXCEPTION 'canal: a trilha voltou a aceitar movimentação sem autor';
  END IF;

  -- As quatro tabelas do canal têm de exigir MFA como `denuncias` exige.
  IF (SELECT count(*) FROM pg_policies
      WHERE policyname = 'Require valid MFA session'
        AND tablename IN ('denuncias_mensagens', 'denuncias_comite',
                          'denuncias_impedimentos', 'denuncias_reunioes')) < 4 THEN
    RAISE EXCEPTION 'canal: há tabela do canal sem exigência de MFA';
  END IF;

  RAISE NOTICE 'canal: trilha assinada e reservada, reunião disponível';
END $$;
