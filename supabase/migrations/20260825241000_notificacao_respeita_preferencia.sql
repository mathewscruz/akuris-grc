-- A notificação passa a respeitar quem disse que não a quer.
--
-- ## Onde é que isto tem de viver
--
-- A preferência ganhou coluna na migration anterior. Faltava alguém cumpri-la.
--
-- O sítio certo é AQUI, dentro da função — não no cliente. Por esta RPC passam
-- todos os avisos do produto: os do React, os das funções de borda, os que um
-- gatilho venha a criar. Verificar no ecrã seria verificar num dos caminhos e
-- deixar os outros abertos, que é como a preferência antiga não valia nada.
--
-- ## Uma decisão que merece ser dita
--
-- Quando a pessoa desligou o sino, a função devolve NULL em vez de rebentar.
-- Quem chama concluiu a operação principal — gravou o documento, atribuiu a
-- denúncia — e não deve ver um erro porque o destinatário escolheu não ser
-- incomodado. Não notificar é o comportamento pedido, não uma falha.

CREATE OR REPLACE FUNCTION public.criar_notificacao(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'info'::text,
  p_link_to text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_autor uuid;
  v_empresa_dest  uuid;
  v_quer_no_sino  boolean;
  v_id            uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Notificação exige utilizador autenticado';
  END IF;

  IF p_user_id IS NULL OR btrim(COALESCE(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Notificação exige destinatário e título';
  END IF;

  SELECT empresa_id INTO v_empresa_autor FROM public.profiles WHERE user_id = auth.uid();
  SELECT empresa_id, notificar_na_aplicacao
    INTO v_empresa_dest, v_quer_no_sino
    FROM public.profiles WHERE user_id = p_user_id;

  -- A tabela não tem `empresa_id`: o vínculo com o inquilino é só o destinatário.
  -- Sem esta verificação, um utilizador podia notificar qualquer conta do SaaS.
  IF v_empresa_dest IS NULL OR v_empresa_autor IS NULL OR v_empresa_dest <> v_empresa_autor THEN
    RAISE EXCEPTION 'Destinatário fora da empresa de quem envia';
  END IF;

  -- Quem desligou o sino não recebe. Devolve NULL, não erro: quem chama já
  -- concluiu o que interessava.
  IF v_quer_no_sino IS FALSE THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link_to, metadata)
  VALUES (p_user_id, p_title, p_message, COALESCE(p_type, 'info'), p_link_to,
          COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

DO $$
BEGIN
  RAISE NOTICE 'criar_notificacao: passa a respeitar notificar_na_aplicacao';
END $$;
