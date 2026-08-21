-- O canal como produto que se vende sozinho: comité de nascença, retenção
-- cumprida, e um plano que contém só isto.
--
-- ## 1. A empresa nova recebia denúncias que ninguém conseguia abrir
--
-- `provisionar_canal_denuncia` corre em toda a empresa nova e cria a
-- configuração **já ativa**, com token público e seis categorias. Não cria
-- comité. E `pode_ver_denuncia` exige estar no comité ou ser o responsável
-- designado.
--
-- Ou seja: empresa criada, canal no ar, link a funcionar, denúncias a entrar —
-- e nenhuma pessoa dentro da empresa com permissão para as ler. As sete
-- empresas de hoje têm comité porque a migration da onda 1 as preencheu; uma
-- empresa nova não ganhava nada.
--
-- Na venda em pacote isto resolvia-se sozinho, porque alguém já usava o
-- produto. Na venda avulsa do canal é o caminho por omissão do primeiro dia.
--
-- ## 2. A retenção era declarada e nunca cumprida
--
-- `retencao_meses` (60 por omissão) é mostrado a quem denuncia como promessa:
-- «Os registos são conservados por 60 meses». Nada apagava coisa nenhuma. Sob
-- RGPD/LGPD, declarar prazo e não o cumprir é pior do que não declarar — passa
-- a ser prova documentada de que a promessa foi quebrada.
--
-- ## 3. Não havia plano que contivesse só o canal
--
-- O mais barato (`compliance_start`, 590) nem inclui `denuncia`; ela só aparece
-- no `grc_manager`, a 1290, com mais dez módulos ao lado.

-- ---------------------------------------------------------------------------
-- 1. Comité de nascença
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.semear_comite_denuncias(p_empresa_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_inseridos integer := 0;
BEGIN
  /*
    Só semeia quando está vazio. Um comité com uma pessoa a menos é decisão de
    quem o gere; um comité vazio é uma denúncia que ninguém pode ler.
  */
  IF EXISTS (SELECT 1 FROM public.denuncias_comite c WHERE c.empresa_id = p_empresa_id) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.denuncias_comite (empresa_id, user_id, papel)
  SELECT p_empresa_id, p.user_id, 'gestor'
  FROM public.profiles p
  WHERE p.empresa_id = p_empresa_id
    AND p.role IN ('admin', 'super_admin')
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inseridos = ROW_COUNT;
  RETURN v_inseridos;
END $function$;

COMMENT ON FUNCTION public.semear_comite_denuncias(uuid) IS
  'Põe os administradores da empresa no comité quando ele está vazio. É o '
  'ponto de partida, não a configuração final: quem gere o canal deve depois '
  'nomear quem deve mesmo lá estar.';

/* Ao provisionar a empresa. */
CREATE OR REPLACE FUNCTION public.provisionar_canal_denuncia(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.denuncias_configuracoes (
    empresa_id, ativo, token_publico, permitir_anonimas, requerer_email,
    texto_apresentacao, notificar_administradores
  )
  VALUES (
    p_empresa_id, true, public.gerar_token_publico(), true, false,
    'Este canal permite comunicar, de forma segura e confidencial, situações que violem as normas internas ou a legislação aplicável.',
    true
  )
  ON CONFLICT (empresa_id) DO NOTHING;

  INSERT INTO public.denuncias_categorias (empresa_id, nome, descricao, cor, ativo)
  SELECT p_empresa_id, v.nome, v.descricao, v.cor, true
  FROM (VALUES
    ('Assédio', 'Assédio moral ou sexual', '#EF4444'),
    ('Fraude', 'Fraude, furto ou desvio de recursos', '#F59E0B'),
    ('Corrupção', 'Suborno, corrupção ou conflito de interesses', '#8B5CF6'),
    ('Discriminação', 'Discriminação ou preconceito', '#EC4899'),
    ('Segurança', 'Segurança da informação ou do trabalho', '#3B82F6'),
    ('Outros', 'Outras situações', '#64748B')
  ) AS v(nome, descricao, cor)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.denuncias_categorias c
    WHERE c.empresa_id = p_empresa_id AND lower(c.nome) = lower(v.nome)
  );

  -- O que faltava: sem isto o canal nascia a aceitar denúncias ilegíveis.
  PERFORM public.semear_comite_denuncias(p_empresa_id);
END $function$;

/*
  E quando o primeiro administrador aparece DEPOIS da empresa.

  A ordem normal de criação é empresa primeiro, pessoas a seguir — altura em
  que `provisionar_canal_denuncia` já correu e não encontrou ninguém para pôr
  no comité.
*/
CREATE OR REPLACE FUNCTION public.tg_profile_semeia_comite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.empresa_id IS NOT NULL AND NEW.role IN ('admin', 'super_admin') THEN
    PERFORM public.semear_comite_denuncias(NEW.empresa_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Falha ao semear comité da empresa %: %', NEW.empresa_id, SQLERRM;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_profile_semeia_comite ON public.profiles;
CREATE TRIGGER trg_profile_semeia_comite
  AFTER INSERT OR UPDATE OF role, empresa_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profile_semeia_comite();

-- Empresas que já existem e ficaram sem comité (nenhuma hoje, mas a guarda
-- abaixo passa a exigir que continue assim).
SELECT public.semear_comite_denuncias(e.id)
FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.denuncias_comite c WHERE c.empresa_id = e.id
);

COMMENT ON COLUMN public.denuncias_configuracoes.notificar_administradores IS
  'Apesar do nome, avisa o COMITÉ — desde a onda 1 quem vê a denúncia é quem '
  'está em denuncias_comite, e avisar administradores era avisar quem não '
  'consegue abrir o caso. Mantido o nome para não partir integrações.';

-- ---------------------------------------------------------------------------
-- 2. A retenção passa a ser cumprida
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expurgar_denuncias_vencidas()
RETURNS TABLE(empresa_id uuid, apagadas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r record;
  v_apagadas integer;
BEGIN
  FOR r IN
    SELECT c.empresa_id, c.retencao_meses
    FROM public.denuncias_configuracoes c
    WHERE c.retencao_meses IS NOT NULL AND c.retencao_meses > 0
  LOOP
    /*
      Conta-se do fim do caso, não do início.

      Uma denúncia aberta há seis anos e ainda em investigação não pode ser
      apagada por causa da data de entrada — o prazo de conservação começa
      quando o tratamento termina. Sem `data_conclusao`, nada é apagado.
    */
    WITH alvo AS (
      SELECT d.id FROM public.denuncias d
      WHERE d.empresa_id = r.empresa_id
        AND d.status IN ('resolvida', 'arquivada')
        AND d.data_conclusao IS NOT NULL
        AND d.data_conclusao < now() - make_interval(months => r.retencao_meses)
    ), removidas AS (
      DELETE FROM public.denuncias d USING alvo
      WHERE d.id = alvo.id
      RETURNING d.id
    )
    SELECT count(*) INTO v_apagadas FROM removidas;

    IF v_apagadas > 0 THEN
      empresa_id := r.empresa_id;
      apagadas := v_apagadas;
      RETURN NEXT;
    END IF;
  END LOOP;
END $function$;

COMMENT ON FUNCTION public.expurgar_denuncias_vencidas() IS
  'Cumpre o prazo declarado em denuncias_configuracoes.retencao_meses, contado '
  'a partir da conclusão do caso. O canal promete esse prazo a quem denuncia; '
  'sem isto a promessa era só texto. Anexos, mensagens, movimentações e '
  'reuniões saem em cascata.';

REVOKE ALL ON FUNCTION public.expurgar_denuncias_vencidas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expurgar_denuncias_vencidas() FROM anon, authenticated;

/*
  O agendamento NÃO chama esta função directamente.

  Apagar as linhas em SQL deixaria os ficheiros no balde — o Supabase proíbe
  apagar de `storage.objects` fora da API de armazenamento, e com razão. Meia
  eliminação é pior do que nenhuma: a ficha desaparecia e a prova ficava.

  Quem orquestra é a função de borda `expurgar-denuncias`, que apaga primeiro
  os ficheiros e só depois as denúncias. O cron chama-a — e, se ainda não
  houver segredo no cofre para o fazer, não agenda nada e diz porquê, em vez
  de agendar meia limpeza.
*/
CREATE OR REPLACE FUNCTION public.agendar_expurgo_denuncias()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_url text;
  v_chave text;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'projeto_url' LIMIT 1;
  SELECT decrypted_secret INTO v_chave
  FROM vault.decrypted_secrets WHERE name = 'expurgo_denuncias_token' LIMIT 1;

  PERFORM cron.unschedule('expurgar-denuncias')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expurgar-denuncias');

  IF v_url IS NULL OR v_chave IS NULL THEN
    RETURN 'sem cofre: agende `expurgar-denuncias` no painel do Supabase, ou '
        || 'guarde os segredos `projeto_url` e `expurgo_denuncias_token` e '
        || 'volte a correr public.agendar_expurgo_denuncias()';
  END IF;

  PERFORM cron.schedule(
    'expurgar-denuncias', '30 4 * * *',
    format(
      $cron$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
        body := '{}'::jsonb
      );$cron$,
      v_url || '/functions/v1/expurgar-denuncias', v_chave
    )
  );
  RETURN 'agendado';
END $function$;

REVOKE ALL ON FUNCTION public.agendar_expurgo_denuncias() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agendar_expurgo_denuncias() FROM anon, authenticated;

DO $$
DECLARE v_resultado text;
BEGIN
  SELECT public.agendar_expurgo_denuncias() INTO v_resultado;
  RAISE NOTICE 'canal: expurgo — %', v_resultado;
END $$;

/* O que a função de borda precisa de saber ANTES de apagar seja o que for. */
CREATE OR REPLACE FUNCTION public.denuncias_vencidas_com_ficheiros()
RETURNS TABLE(denuncia_id uuid, caminhos text[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT d.id,
         COALESCE(array_agg(a.arquivo_url) FILTER (WHERE a.arquivo_url IS NOT NULL), '{}')
  FROM public.denuncias d
  JOIN public.denuncias_configuracoes c ON c.empresa_id = d.empresa_id
  LEFT JOIN public.denuncias_anexos a ON a.denuncia_id = d.id
  WHERE c.retencao_meses IS NOT NULL AND c.retencao_meses > 0
    AND d.status IN ('resolvida', 'arquivada')
    AND d.data_conclusao IS NOT NULL
    AND d.data_conclusao < now() - make_interval(months => c.retencao_meses)
  GROUP BY d.id;
$function$;

REVOKE ALL ON FUNCTION public.denuncias_vencidas_com_ficheiros() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.denuncias_vencidas_com_ficheiros() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.denuncias_vencidas_com_ficheiros() TO service_role;

-- ---------------------------------------------------------------------------
-- 3. O plano que contém só o canal
-- ---------------------------------------------------------------------------

INSERT INTO public.planos (
  nome, codigo, descricao, preco_mensal, preco_anual, moeda,
  creditos_franquia, limite_usuarios, modulos_habilitados, recursos_destacados,
  ordem, ativo, publico_alvo
)
VALUES (
  'Akuris Canal', 'canal_denuncia',
  'Canal de denúncia completo, em marca branca, com comité, prazos legais, '
  'reunião presencial e trilha de apuração. Sem os restantes módulos do GRC.',
  290.00, 2900.00, 'BRL', 0, NULL,
  '["denuncia"]'::jsonb,
  '["Canal público em marca branca", "Comité de ética e trilha de apuração", "Prazos da Diretiva (UE) 2019/1937", "Reunião presencial e ata", "Três idiomas", "Código QR para cartaz"]'::jsonb,
  0, true,
  'Empresas que precisam de canal de denúncia por obrigação legal e ainda não querem o GRC completo.'
)
ON CONFLICT (codigo) DO UPDATE
SET modulos_habilitados = EXCLUDED.modulos_habilitados,
    recursos_destacados = EXCLUDED.recursos_destacados,
    publico_alvo = EXCLUDED.publico_alvo;

-- ---------------------------------------------------------------------------
-- 4. Que módulos esta empresa pode ver
-- ---------------------------------------------------------------------------

/*
  O recorte por plano existia como catálogo e não como direito de uso:
  `planos.modulos_habilitados` já tinha a chave `denuncia` e **nada o lia**.
  Quem escondia módulo era a permissão POR UTILIZADOR — vender «só o canal»
  obrigava a desligar dezoito módulos pessoa a pessoa, e a repetir a cada
  contratação. Esta função dá à aplicação uma resposta por EMPRESA.

  Devolve NULL quando a empresa não tem plano ou quando a restrição não está
  ligada: nesse caso nada é limitado.
*/

/*
  Ligar o recorte é decisão, não efeito colateral de uma migration.

  As sete empresas de hoje têm plano, e duas estão no `compliance_start`, que
  tem cinco módulos. Passar a aplicar o plano a todas neste mesmo commit
  tirar-lhes-ia catorze módulos de um momento para o outro. (Verificado: essas
  duas não têm dados nos módulos de fora do plano — mas o risco não é aceitável
  como padrão.)

  Por isso: coluna a `false` para quem já existe, e `DEFAULT true` a seguir,
  para que toda a empresa NOVA — as que vão comprar só o canal — nasça com o
  plano a valer.
*/
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS plano_restringe_modulos boolean NOT NULL DEFAULT false;
ALTER TABLE public.empresas
  ALTER COLUMN plano_restringe_modulos SET DEFAULT true;

COMMENT ON COLUMN public.empresas.plano_restringe_modulos IS
  'Quando verdadeiro, `planos.modulos_habilitados` deixa de ser catálogo e '
  'passa a ser direito de uso: a aplicação esconde e bloqueia o que não está '
  'no plano, inclusive para super_admin da empresa. Falso nas empresas '
  'anteriores a 21/08/2026 para não lhes retirar módulos sem aviso.';
CREATE OR REPLACE FUNCTION public.modulos_da_empresa()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN NOT e.plano_restringe_modulos THEN NULL
    WHEN p.modulos_habilitados IS NULL OR jsonb_array_length(p.modulos_habilitados) = 0
      THEN NULL
    ELSE ARRAY(SELECT jsonb_array_elements_text(p.modulos_habilitados))
  END
  FROM public.empresas e
  JOIN public.planos p ON p.id = e.plano_id
  WHERE e.id = public.get_user_empresa_id()
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.modulos_da_empresa() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Guardas
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_sem_comite integer;
  v_plano integer;
BEGIN
  SELECT count(*) INTO v_sem_comite
  FROM public.empresas e
  WHERE EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.empresa_id = e.id AND p.role IN ('admin', 'super_admin'))
    AND NOT EXISTS (SELECT 1 FROM public.denuncias_comite c WHERE c.empresa_id = e.id);
  IF v_sem_comite > 0 THEN
    RAISE EXCEPTION
      'canal: % empresa(s) com administrador e sem comité — recebem denúncias que ninguém abre',
      v_sem_comite;
  END IF;

  SELECT count(*) INTO v_plano FROM public.planos
  WHERE codigo = 'canal_denuncia' AND modulos_habilitados = '["denuncia"]'::jsonb;
  IF v_plano <> 1 THEN
    RAISE EXCEPTION 'canal: o plano avulso do canal não ficou como esperado';
  END IF;

  /* Não se exige o agendamento: sem cofre configurado ele não existe, e
     falhar a migration por isso impediria o resto de entrar. A função
     `agendar_expurgo_denuncias()` diz o que falta e pode ser corrida à mão. */

  RAISE NOTICE 'canal: comité de nascença, retenção cumprida, plano avulso criado';
END $$;
