-- A marca do canal chega ao canal, e a Diretiva ganha os textos que exige.
--
-- Duas coisas.
--
-- **A primeira é minha.** A onda 1 acrescentou `cor_destaque`, `nome_exibicao`
-- e `idioma_padrao` à configuração, e a onda seguinte deu-lhes uma tela. Só
-- que a view pública — a única porta por onde o canal anónimo lê a
-- configuração — continuou a expor sete colunas, nenhuma delas essas. Ou seja:
-- construiu-se um ecrã de definições cujas definições não faziam nada.
--
-- **A segunda é da lei.** A Diretiva (UE) 2019/1937 não se esgota em prazos.
-- Obriga também a INFORMAR quem denuncia, e essa informação tem de estar no
-- canal, não num manual:
--
--   · Art. 7.º/2 e 13.º — o canal interno tem de dizer que existe também a via
--     EXTERNA, e qual é a autoridade competente. Sem isso, o canal interno
--     funciona como um funil que retém a denúncia.
--   · Art. 19.º e 21.º — a pessoa tem de saber que está protegida contra
--     retaliação, e do quê. Um canal que promete confidencialidade e não fala
--     de retaliação promete a parte fácil.
--   · Art. 18.º + RGPD (minimização e limitação da conservação) — tem de haver
--     um prazo de conservação declarado. Guardar denúncias para sempre é o
--     estado por omissão de qualquer base, e é ilegal.
--   · Art. 9.º/2 — o canal deve permitir denúncia oral e, a pedido, reunião
--     presencial. A reunião fica aqui como opção declarável; a denúncia oral
--     (gravação de voz) é trabalho de aplicação e vai à parte.

ALTER TABLE public.denuncias_configuracoes
  ADD COLUMN IF NOT EXISTS orgao_externo_nome text,
  ADD COLUMN IF NOT EXISTS orgao_externo_url text,
  ADD COLUMN IF NOT EXISTS texto_retaliacao text,
  ADD COLUMN IF NOT EXISTS retencao_meses integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS permitir_reuniao boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.denuncias_configuracoes.orgao_externo_nome IS
  'Autoridade competente para denúncia EXTERNA (Diretiva (UE) 2019/1937, art. '
  '7.º/2 e 13.º). No Brasil costuma ser a CGU ou o Ministério Público; na UE, '
  'a autoridade nacional designada. Vazio esconde o bloco — mas escondê-lo num '
  'canal sujeito à Diretiva é incumprimento.';
COMMENT ON COLUMN public.denuncias_configuracoes.texto_retaliacao IS
  'O que a pessoa tem direito a saber sobre proteção contra retaliação '
  '(arts. 19.º e 21.º). Um canal que promete sigilo e cala sobre retaliação '
  'promete a parte fácil.';
COMMENT ON COLUMN public.denuncias_configuracoes.retencao_meses IS
  'Meses de conservação da denúncia. O RGPD exige prazo declarado; 60 meses é '
  'um ponto de partida comum, não uma regra — cada jurisdição tem a sua.';
COMMENT ON COLUMN public.denuncias_configuracoes.permitir_reuniao IS
  'Oferece a reunião presencial que o art. 9.º/2 manda permitir a pedido.';

/*
  A view pública passa a levar o que o canal precisa de mostrar.

  Continua a expor só o que é público por natureza: nada aqui identifica
  pessoas nem revela denúncias. `CREATE OR REPLACE VIEW` só aceita acrescentar
  colunas no fim — daí a ordem.
*/
CREATE OR REPLACE VIEW public.denuncias_configuracoes_publicas AS
SELECT
  id,
  empresa_id,
  texto_apresentacao,
  politica_privacidade,
  permitir_anonimas,
  requerer_email,
  ativo,
  nome_exibicao,
  cor_destaque,
  idioma_padrao,
  orgao_externo_nome,
  orgao_externo_url,
  texto_retaliacao,
  retencao_meses,
  permitir_reuniao,
  prazo_acusacao_dias,
  prazo_retorno_dias
FROM public.denuncias_configuracoes
WHERE ativo = true;

DO $$
DECLARE
  v_colunas integer;
BEGIN
  SELECT count(*) INTO v_colunas
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'denuncias_configuracoes_publicas'
    AND column_name IN ('nome_exibicao','cor_destaque','idioma_padrao','orgao_externo_nome','texto_retaliacao');

  IF v_colunas < 5 THEN
    RAISE EXCEPTION
      'canal de denúncia: a view pública não expõe a marca nem os direitos (% de 5)', v_colunas;
  END IF;

  RAISE NOTICE 'canal de denúncia: marca e direitos visíveis ao canal público';
END $$;
