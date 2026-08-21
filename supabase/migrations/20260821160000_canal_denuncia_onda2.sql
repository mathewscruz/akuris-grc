-- Canal de Denúncia, onda 2: o que o cliente precisa para PROVAR que cumpriu.
--
-- O que ele compra não é o formulário — é a evidência de conformidade. Faltava
-- tudo o que a produz:
--
--  · **Diálogo.** A consulta por protocolo era só leitura. Quem denunciou não
--    conseguia acrescentar informação, responder a uma dúvida do investigador
--    nem enviar o ficheiro que faltou. Não havia sequer tabela de mensagens.
--
--  · **Relógio.** A Diretiva (UE) 2019/1937 exige acusar o recebimento em 7
--    dias e dar retorno em 3 meses. Não havia coluna de prazo nem de acusação.
--
--  · **Desfecho.** O parecer era um campo de texto solto: nada dizia se a
--    denúncia foi procedente, que medidas foram tomadas, nem quando se
--    concluiu.
--
--  · **Ligação ao resto do Akuris.** Uma denúncia procedente morria na própria
--    ficha, quando devia virar risco, plano de ação ou incidente.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Diálogo com quem denunciou
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.denuncias_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  /*
    Quem falou. `denunciante` chega pela função de borda, autenticado pelo
    código de acompanhamento — nunca por sessão, porque ele é anónimo e não
    tem conta. Por isso `autor_id` fica nulo desse lado: guardar um id ali
    seria identificar quem o canal promete não identificar.
  */
  autor_tipo text NOT NULL,
  autor_id uuid,
  mensagem text NOT NULL,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT denuncias_mensagens_autor_check CHECK (autor_tipo IN ('denunciante','comite')),
  CONSTRAINT denuncias_mensagens_anonimato_check
    CHECK (autor_tipo <> 'denunciante' OR autor_id IS NULL)
);

COMMENT ON TABLE public.denuncias_mensagens IS
  'Conversa entre quem denunciou e o comité, pelo protocolo. É o que a '
  'Diretiva (UE) 2019/1937 chama de retorno ao informante, e o que permite '
  'pedir-lhe informação sem quebrar o anonimato.';

CREATE INDEX IF NOT EXISTS idx_denuncias_mensagens_denuncia
  ON public.denuncias_mensagens(denuncia_id, created_at);

ALTER TABLE public.denuncias_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comite ve mensagens" ON public.denuncias_mensagens;
CREATE POLICY "Comite ve mensagens" ON public.denuncias_mensagens
  FOR SELECT TO authenticated
  USING (public.pode_ver_denuncia(denuncia_id));

DROP POLICY IF EXISTS "Comite escreve mensagens" ON public.denuncias_mensagens;
CREATE POLICY "Comite escreve mensagens" ON public.denuncias_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_ver_denuncia(denuncia_id) AND autor_tipo = 'comite');

DROP POLICY IF EXISTS "Comite marca lida" ON public.denuncias_mensagens;
CREATE POLICY "Comite marca lida" ON public.denuncias_mensagens
  FOR UPDATE TO authenticated
  USING (public.pode_ver_denuncia(denuncia_id))
  WITH CHECK (public.pode_ver_denuncia(denuncia_id));

-- ─────────────────────────────────────────────────────────────────────────
-- 2. O relógio
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.denuncias_configuracoes
  ADD COLUMN IF NOT EXISTS prazo_acusacao_dias integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS prazo_retorno_dias integer NOT NULL DEFAULT 90;

COMMENT ON COLUMN public.denuncias_configuracoes.prazo_acusacao_dias IS
  'Dias para acusar o recebimento. 7 é o da Diretiva (UE) 2019/1937; fica '
  'configurável porque a regra muda com a jurisdição.';
COMMENT ON COLUMN public.denuncias_configuracoes.prazo_retorno_dias IS
  'Dias para dar retorno ao informante. 90 ≈ os 3 meses da Diretiva.';

ALTER TABLE public.denuncias
  ADD COLUMN IF NOT EXISTS data_acusacao_recebimento timestamptz,
  ADD COLUMN IF NOT EXISTS prazo_acusacao date,
  ADD COLUMN IF NOT EXISTS prazo_retorno date,
  ADD COLUMN IF NOT EXISTS resultado text,
  ADD COLUMN IF NOT EXISTS medidas_adotadas text,
  ADD COLUMN IF NOT EXISTS data_parecer timestamptz;

ALTER TABLE public.denuncias DROP CONSTRAINT IF EXISTS denuncias_resultado_check;
ALTER TABLE public.denuncias
  ADD CONSTRAINT denuncias_resultado_check
  CHECK (resultado IS NULL OR resultado IN (
    'procedente','parcialmente_procedente','improcedente','inconclusiva'
  ));

COMMENT ON COLUMN public.denuncias.resultado IS
  'Desfecho da apuração. O parecer era um campo de texto solto: não dava para '
  'contar quantas denúncias foram procedentes, que é a primeira pergunta de '
  'qualquer auditoria ao canal.';

/*
  Os prazos nascem com a denúncia, a partir da configuração da empresa.

  Coluna simples e não gerada: `created_at + interval` depende do fuso, logo
  não é imutável e o Postgres recusaria a coluna gerada. E há a vantagem de a
  empresa poder mudar os dias sem reescrever o passado — um prazo que já
  correu não deve mudar retroactivamente.
*/
CREATE OR REPLACE FUNCTION public.tg_denuncia_prazos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acusacao integer := 7;
  v_retorno integer := 90;
BEGIN
  SELECT COALESCE(c.prazo_acusacao_dias, 7), COALESCE(c.prazo_retorno_dias, 90)
    INTO v_acusacao, v_retorno
  FROM public.denuncias_configuracoes c
  WHERE c.empresa_id = NEW.empresa_id
  LIMIT 1;

  NEW.prazo_acusacao := (COALESCE(NEW.created_at, now()) + make_interval(days => v_acusacao))::date;
  NEW.prazo_retorno  := (COALESCE(NEW.created_at, now()) + make_interval(days => v_retorno))::date;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_denuncia_prazos ON public.denuncias;
CREATE TRIGGER trg_denuncia_prazos
  BEFORE INSERT ON public.denuncias
  FOR EACH ROW EXECUTE FUNCTION public.tg_denuncia_prazos();

-- As que já existem também precisam de relógio.
UPDATE public.denuncias d
SET prazo_acusacao = (d.created_at + interval '7 days')::date,
    prazo_retorno  = (d.created_at + interval '90 days')::date
WHERE d.prazo_acusacao IS NULL OR d.prazo_retorno IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Onde a denúncia desemboca
-- ─────────────────────────────────────────────────────────────────────────
/*
  O concorrente termina no parecer. Aqui a denúncia procedente tem para onde
  ir — e o vínculo é o que permite mostrar ao auditor que houve consequência,
  não só conclusão.

  `ON DELETE SET NULL`: apagar o risco não pode apagar a denúncia.
*/
ALTER TABLE public.denuncias
  ADD COLUMN IF NOT EXISTS risco_id uuid REFERENCES public.riscos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plano_acao_id uuid REFERENCES public.planos_acao(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS incidente_id uuid REFERENCES public.incidentes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_denuncias_prazo_retorno ON public.denuncias(empresa_id, prazo_retorno);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Consulta pública devolve também a conversa
-- ─────────────────────────────────────────────────────────────────────────
/*
  A função existente devolve a denúncia e as movimentações. Passa a devolver
  as mensagens — sem `autor_id`, que não interessa a quem consulta e é dado
  de pessoa identificável.
*/
CREATE OR REPLACE FUNCTION public.consult_denuncia_publica(
  p_empresa_slug text,
  p_protocolo text,
  p_tracking_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    'categoria', (
      SELECT jsonb_build_object('nome', c.nome, 'cor', c.cor)
      FROM public.denuncias_categorias c WHERE c.id = v_denuncia.categoria_id
    ),
    -- Novo na onda 2: o relógio e o desfecho passam a ser visíveis a quem
    -- denunciou. Saber ATÉ QUANDO haverá resposta é metade do direito.
    'data_acusacao_recebimento', v_denuncia.data_acusacao_recebimento,
    'prazo_retorno', v_denuncia.prazo_retorno,
    'resultado', v_denuncia.resultado,
    'movimentacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'acao', m.acao,
        'status_anterior', m.status_anterior, 'status_novo', m.status_novo,
        'observacoes', m.observacoes,
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
    ), '[]'::jsonb)
  );
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Rede de segurança
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_sem_prazo integer;
BEGIN
  SELECT count(*) INTO v_sem_prazo
  FROM public.denuncias WHERE prazo_acusacao IS NULL OR prazo_retorno IS NULL;

  IF v_sem_prazo > 0 THEN
    RAISE EXCEPTION 'canal de denúncia: % denúncias ficaram sem prazo', v_sem_prazo;
  END IF;

  RAISE NOTICE 'canal de denúncia onda 2: diálogo, relógio e desfecho no lugar';
END $$;
