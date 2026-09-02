/*
   Quem denunciou escrevia, e ninguém ficava a saber.

   Corrigiu-se na passagem anterior o aviso da denúncia NOVA — faltava uma
   chave estrangeira e a função de borda respondia «Denúncia não encontrada».
   O mesmo buraco existia uma porta adiante, e sem chave nenhuma a disfarçá-lo:

     · `create-denuncia`, acção `mensagem` — insere em `denuncias_mensagens`
       e devolve `{ok:true}`. Mais nada.
     · `create-denuncia`, acção `reuniao_solicitar` — chama
       `solicitar_reuniao_denuncia` e devolve a reunião. Mais nada.

   Medido no esquema: ZERO gatilhos em `denuncias_mensagens`, e nenhum em
   INSERT de `denuncias_reunioes`. Nada, em lado nenhum, avisa o comité.

   O que isso significa na prática. O investigador faz uma pergunta na conversa
   e fecha o separador. A pessoa responde nessa noite. A resposta fica na base
   até alguém, por iniciativa própria, reabrir aquela denúncia e clicar na aba
   certa. Num processo de três meses, é assim que se perde o prazo de retorno a
   responder a uma pessoa que já tinha respondido.

   O pedido de reunião é pior, porque é uma obrigação com relógio: a Diretiva
   (UE) 2019/1937, art. 9.º/2, manda o canal permitir um encontro a pedido. O
   único sinal era um selo na lista — que exige que alguém esteja a olhar para
   a lista. Uma obrigação que só se vê quando se vai à procura dela não está
   vigiada.

   ## Porquê em gatilho, e não na função de borda

   A escrita entra por dois caminhos: a função de borda (denunciante) e o ecrã
   do comité (`DenunciaConversa`, insert directo com RLS). Um aviso posto na
   função de borda cobria um e deixava o outro — e o outro é o que avisa a
   pessoa de que há resposta, quando ela tiver por onde ser avisada.

   No gatilho, o aviso nasce da ESCRITA, venha ela de onde vier.

   ## O aviso nunca pode derrubar a mensagem

   `create_audit_log` já ensinou isto: um gatilho que rebenta aborta a escrita
   que o disparou. Aqui isso seria perder o relato de quem denunciou porque uma
   notificação falhou — troca inaceitável. Todo o corpo vai dentro de um bloco
   que apanha qualquer falha, avisa no log e deixa a mensagem passar.
*/

/*
   Quem tem de saber: o comité da empresa e, se houver, quem ficou responsável.

   É o mesmo conjunto que a RLS deixa abrir a denúncia (`pode_ver_denuncia`).
   Avisar quem não a pode ler seria mandar alguém a uma porta fechada — a regra
   que o vigia dos prazos já segue.
*/
CREATE OR REPLACE FUNCTION public.avisar_o_comite(
  p_denuncia_id uuid,
  p_titulo text,
  p_mensagem text,
  p_tipo text,
  p_marco text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_d record;
  m record;
  v_contados integer := 0;
BEGIN
  SELECT id, empresa_id, protocolo, responsavel_id
    INTO v_d
    FROM public.denuncias
   WHERE id = p_denuncia_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  FOR m IN
    SELECT DISTINCT c.user_id
      FROM public.denuncias_comite c
     WHERE c.empresa_id = v_d.empresa_id
    UNION
    SELECT v_d.responsavel_id WHERE v_d.responsavel_id IS NOT NULL
  LOOP
    /*
       Sem dedupe por marco, ao contrário do vigia dos prazos.

       Ali o marco é um estado do mundo — «o prazo está a 2 dias» — e repeti-lo
       todas as manhãs deixaria de se ler ao terceiro dia. Aqui cada aviso é um
       FACTO novo: a pessoa escreveu outra vez. Engolir o segundo seria engolir
       uma mensagem.
    */
    PERFORM public.notificar_do_sistema(
      m.user_id, p_titulo, p_mensagem, p_tipo, '/denuncia',
      jsonb_build_object('denuncia_id', v_d.id, 'marco', p_marco, 'protocolo', v_d.protocolo)
    );
    v_contados := v_contados + 1;
  END LOOP;

  RETURN v_contados;
END;
$function$;

REVOKE ALL ON FUNCTION public.avisar_o_comite(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.avisar_o_comite(uuid, text, text, text, text) FROM anon, authenticated;

/** A mensagem de quem denunciou. A do comité não avisa o comité. */
CREATE OR REPLACE FUNCTION public.tg_mensagem_avisa_o_comite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_protocolo text;
BEGIN
  IF NEW.autor_tipo IS DISTINCT FROM 'denunciante' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT protocolo INTO v_protocolo FROM public.denuncias WHERE id = NEW.denuncia_id;

    PERFORM public.avisar_o_comite(
      NEW.denuncia_id,
      'Nova mensagem de quem denunciou',
      'Denúncia ' || COALESCE(v_protocolo, '') || ': há uma mensagem por ler na conversa.',
      'info',
      'mensagem_do_denunciante'
    );
  EXCEPTION WHEN OTHERS THEN
    -- A mensagem passa. Perdê-la porque o aviso falhou seria pior do que o
    -- silêncio que isto veio corrigir.
    RAISE WARNING 'aviso de mensagem falhou (denuncia %): %', NEW.denuncia_id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mensagem_avisa_o_comite ON public.denuncias_mensagens;
CREATE TRIGGER trg_mensagem_avisa_o_comite
AFTER INSERT ON public.denuncias_mensagens
FOR EACH ROW EXECUTE FUNCTION public.tg_mensagem_avisa_o_comite();

/** O pedido de reunião — art. 9.º/2, com relógio a correr. */
CREATE OR REPLACE FUNCTION public.tg_reuniao_avisa_o_comite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_protocolo text;
BEGIN
  IF NEW.estado IS DISTINCT FROM 'solicitada' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT protocolo INTO v_protocolo FROM public.denuncias WHERE id = NEW.denuncia_id;

    PERFORM public.avisar_o_comite(
      NEW.denuncia_id,
      'Pedido de reunião por marcar',
      'Denúncia ' || COALESCE(v_protocolo, '')
        || ': quem denunciou pediu uma reunião (' || COALESCE(NEW.modalidade, 'por definir')
        || '). A Diretiva (UE) 2019/1937 dá-lhe esse direito.',
      'warning',
      'reuniao_solicitada'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aviso de reuniao falhou (denuncia %): %', NEW.denuncia_id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reuniao_avisa_o_comite ON public.denuncias_reunioes;
CREATE TRIGGER trg_reuniao_avisa_o_comite
AFTER INSERT ON public.denuncias_reunioes
FOR EACH ROW EXECUTE FUNCTION public.tg_reuniao_avisa_o_comite();
