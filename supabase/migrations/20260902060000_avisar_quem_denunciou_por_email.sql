/*
   Quem denunciou e deixou e-mail passa a ser avisado quando há novidade.

   O canal não avisava ninguém do lado de fora. O comité respondia na conversa,
   acusava o recebimento, mudava o estado — e a pessoa só descobria se voltasse
   ao portal por iniciativa própria e reescrevesse protocolo e código. Num
   processo que dura três meses, é a forma mais certa de o retorno ser dado e
   nunca ser recebido.

   Quem escolheu não se identificar não deixou contacto nenhum: para essas, não
   há nada a fazer, e o ecrã de sucesso passou a dizê-lo em vez de prometer
   avisos que não existiam.

   ## O interruptor existe por uma razão

   O e-mail sai do perímetro. Quem denunciou pode ter usado o e-mail da
   empresa, e nesse caso quem administra a caixa de correio consegue ligar
   aquela pessoa a um relato — mesmo sem ler nada do caso. Numa empresa com
   política mais apertada, isso é motivo para desligar.

   Por isso: `avisar_denunciante_por_email`, ligado por omissão (o silêncio era
   o defeito), desligável por canal.

   O que o e-mail leva é decidido na função `avisar-denunciante` e é o mínimo:
   que há novidade e onde a ver. Nunca o título, nunca o texto da mensagem do
   comité, nunca o estado. O código de acompanhamento — que é a credencial —
   também não vai lá, porque quem o recebeu já o tem e quem o intercepta não o
   deve ganhar de graça.
*/
ALTER TABLE public.denuncias_configuracoes
  ADD COLUMN IF NOT EXISTS avisar_denunciante_por_email boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.denuncias_configuracoes.avisar_denunciante_por_email IS
  'Avisa por e-mail quem denunciou e deixou contacto, sempre que houver novidade. Nunca se aplica a denúncias anónimas: não há para onde enviar.';

/*
   Quem pode ser avisado, e por que motivo.

   Chamada pela função de borda com a chave de serviço. Devolve o e-mail e o
   mínimo para montar a mensagem — nada do conteúdo do relato. Se a denúncia é
   anónima, se não há e-mail, ou se o canal desligou o aviso, devolve NULL e a
   função de borda não envia nada.
*/
CREATE OR REPLACE FUNCTION public.destinatario_do_aviso_ao_denunciante(p_denuncia_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v record;
BEGIN
  SELECT d.protocolo,
         d.email_denunciante,
         d.nivel_identificacao,
         d.anonima,
         e.nome  AS empresa_nome,
         e.slug  AS empresa_slug,
         c.avisar_denunciante_por_email,
         c.nome_exibicao
    INTO v
    FROM public.denuncias d
    JOIN public.empresas e ON e.id = d.empresa_id
    LEFT JOIN public.denuncias_configuracoes c ON c.empresa_id = d.empresa_id
   WHERE d.id = p_denuncia_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Anónima: não há contacto, por desenho. Não é falha, é a promessa cumprida.
  IF COALESCE(v.nivel_identificacao, CASE WHEN v.anonima THEN 'anonima' ELSE 'identificada' END) = 'anonima' THEN
    RETURN NULL;
  END IF;

  IF nullif(btrim(COALESCE(v.email_denunciante, '')), '') IS NULL THEN
    RETURN NULL;
  END IF;

  -- `NULL` na configuração significa canal sem linha de config: avisa-se.
  IF v.avisar_denunciante_por_email IS FALSE THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'email', v.email_denunciante,
    'protocolo', v.protocolo,
    'empresa_nome', COALESCE(nullif(btrim(v.nome_exibicao), ''), v.empresa_nome),
    'empresa_slug', v.empresa_slug
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.destinatario_do_aviso_ao_denunciante(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.destinatario_do_aviso_ao_denunciante(uuid) FROM anon;

/*
   O portal precisa de saber se avisa, para o poder dizer.

   O ecrã de sucesso passou a afirmar «não enviamos avisos» — verdade enquanto
   não havia aviso nenhum, e mentira a partir do momento em que passa a haver.
   Quem deixou e-mail tem de ler o contrário; e se o canal desligar o aviso,
   volta a ler o primeiro. Uma frase fixa erraria metade das vezes.

   `ativo IS NOT FALSE` e o resto ficam como estavam: só se acrescenta a coluna.
*/
DROP FUNCTION IF EXISTS public.get_canal_config_publica(uuid);
CREATE FUNCTION public.get_canal_config_publica(p_empresa_id uuid)
RETURNS TABLE(
  id uuid, texto_apresentacao text, politica_privacidade text, permitir_anonimas boolean,
  requerer_email boolean, nome_exibicao text, cor_destaque text, idioma_padrao text,
  orgao_externo_nome text, orgao_externo_url text, texto_retaliacao text,
  retencao_meses integer, permitir_reuniao boolean, prazo_acusacao_dias integer,
  prazo_retorno_dias integer, avisar_denunciante_por_email boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT c.id, c.texto_apresentacao, c.politica_privacidade, c.permitir_anonimas,
         c.requerer_email, c.nome_exibicao, c.cor_destaque, c.idioma_padrao,
         c.orgao_externo_nome, c.orgao_externo_url, c.texto_retaliacao,
         c.retencao_meses, c.permitir_reuniao, c.prazo_acusacao_dias, c.prazo_retorno_dias,
         c.avisar_denunciante_por_email
  FROM public.denuncias_configuracoes c
  WHERE c.empresa_id = p_empresa_id AND c.ativo IS NOT FALSE
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_canal_config_publica(uuid) TO anon, authenticated;
