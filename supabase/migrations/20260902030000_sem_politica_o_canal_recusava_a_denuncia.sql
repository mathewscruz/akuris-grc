/*
   Sem política de privacidade, o canal recusava a denúncia no fim do formulário.

   Duas regras que discordavam:

     · O FORMULÁRIO só desenha a caixa «li e aceito» quando a empresa tem texto
       de política configurado (`config.politica_privacidade`). Está certo: uma
       caixa que pede consentimento a um texto inexistente é consentimento a
       nada, e num canal de denúncia esse registo é a prova legal.

     · A RPC `create_denuncia_publica` exige SEMPRE `p_politica_aceita = true`:

           OR p_politica_aceita IS DISTINCT FROM true THEN
             RAISE EXCEPTION 'invalid report'

   Resultado, para toda a empresa sem política escrita: o denunciante preenche
   as quatro etapas, carrega em «Registar Denúncia», e leva «Erro ao criar
   denúncia». Nada lhe diz o que fazer, porque não há nada que ELE possa fazer.

   Medido pela função de borda, no mesmo pedido:

       politica_aceita=false -> {"error":"invalid report"}
       politica_aceita=true  -> protocolo emitido

   E `provisionar_canal_denuncia` nunca escreveu política nenhuma — escreve
   `texto_apresentacao` e mais nada. Ou seja, **toda a empresa nova nascia
   assim**: canal ligado, portal a desenhar, e incapaz de receber uma denúncia.

   ## Qual das duas regras muda

   Não é a da RPC. Registar um consentimento que ninguém deu é exactamente o
   defeito que o comentário do formulário diz ter sido corrigido antes — a
   política aparecia só no ecrã de sucesso, depois de o consentimento já ter
   sido gravado.

   Muda o pressuposto: o canal passa a ter sempre política. O provisionamento
   escreve um texto por omissão, sóbrio e editável, e as empresas que já
   existem recebem-no onde está em falta. Assim o formulário volta a ter o que
   mostrar, o consentimento passa a ser dado a alguma coisa, e a RPC continua a
   exigi-lo.

   O texto é um mínimo defensável, não uma peça jurídica fechada: diz o que se
   recolhe, quem lê, quanto tempo fica e que a lei protege quem denuncia. Cada
   empresa substitui-o pelo seu na configuração do canal.
*/

/** O texto por omissão. Num sítio só, para o provisionamento e o preenchimento. */
CREATE OR REPLACE FUNCTION public.politica_privacidade_padrao()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    'Os dados que nos fornecer neste canal são tratados unicamente para apurar '
 || 'a situação relatada. Se optar por não se identificar, não recolhemos nome, '
 || 'contacto, endereço IP nem identificação do dispositivo.' || chr(10) || chr(10)
 || 'Só o comité designado tem acesso ao relato. O acesso é registado, e a '
 || 'identidade de quem denuncia não é partilhada com as pessoas visadas.' || chr(10) || chr(10)
 || 'O relato e os documentos anexados são conservados pelo prazo definido na '
 || 'configuração deste canal e eliminados no fim desse prazo.' || chr(10) || chr(10)
 || 'A lei protege quem comunica de boa-fé contra qualquer forma de retaliação. '
 || 'Pode acompanhar o processo com o protocolo e o código que lhe serão '
 || 'entregues no fim deste formulário.';
$function$;

-- Provisionamento: passa a escrever a política com o resto.
CREATE OR REPLACE FUNCTION public.provisionar_canal_denuncia(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  /*
    Quem provisiona é super_admin, OU admin da PRÓPRIA empresa.

    `is_admin_or_super_admin()` sozinho não chega: verifica o papel, não a
    empresa — e um admin da empresa B provisionaria canal na empresa A na
    mesma. Provado. O caso legítimo do fluxo de criação de empresa é sempre
    super_admin (só eles criam empresa), por isso o admin comum fica preso à
    sua própria empresa e o fluxo de onboarding continua a funcionar.
  */
  IF NOT (
    public.is_super_admin()
    OR (public.is_admin_or_super_admin() AND p_empresa_id = public.get_user_empresa_id())
  ) THEN
    RAISE EXCEPTION 'acesso negado: provisionar canal exige super_admin ou o admin da própria empresa'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.denuncias_configuracoes (
    empresa_id, ativo, token_publico, permitir_anonimas, requerer_email,
    texto_apresentacao, politica_privacidade, notificar_administradores
  )
  VALUES (
    p_empresa_id, true, public.gerar_token_publico(), true, false,
    'Este canal permite comunicar, de forma segura e confidencial, situações que violem as normas internas ou a legislação aplicável.',
    /* Sem isto o canal nasce incapaz de receber uma denúncia: o formulário não
       tem política para mostrar, não pede consentimento, e a RPC recusa. */
    public.politica_privacidade_padrao(),
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

  PERFORM public.semear_comite_denuncias(p_empresa_id);
END
$function$;

/*
   As empresas que já existem.

   Só onde está em falta: quem já escreveu a sua política não é tocado.
*/
DO $$
DECLARE v_tocadas integer;
BEGIN
  UPDATE public.denuncias_configuracoes
     SET politica_privacidade = public.politica_privacidade_padrao(),
         updated_at = now()
   WHERE nullif(btrim(COALESCE(politica_privacidade, '')), '') IS NULL;
  GET DIAGNOSTICS v_tocadas = ROW_COUNT;
  RAISE NOTICE 'politica por omissao escrita em % canal(is) que estavam sem ela', v_tocadas;
END $$;
