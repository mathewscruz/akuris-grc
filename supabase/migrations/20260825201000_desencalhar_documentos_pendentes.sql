-- Documentos presos em «pendente» sem ninguém a quem pedir.
--
-- ## O que aconteceu
--
-- Ao gravar um documento com «requer aprovação», o `status` passava a
-- `pendente` e só DEPOIS se tentava criar a linha em `documentos_aprovacoes`.
-- Se esse insert falhasse, o erro ia para o log e a pessoa via «Documento
-- criado». O documento ficava à espera de uma decisão que ninguém fora chamado
-- a tomar: invisível para o aprovador (não há linha que o aponte) e invisível
-- para quem o criou (o ecrã diz apenas «pendente»).
--
-- Havia ainda um segundo caminho: ao EDITAR um documento e ligar «requer
-- aprovação» sem escolher aprovador, a validação não corria — só valia para
-- documento novo.
--
-- O código já foi corrigido nas duas frentes. Falta soltar o que ficou preso.
--
-- ## A decisão
--
-- `rascunho`, e não `ativo`. Um documento que nunca foi aprovado não pode
-- passar a vigente por obra de uma migration — seria fabricar uma aprovação
-- que não houve. Rascunho é a verdade: está por submeter.
--
-- `requer_aprovacao` volta a falso para o documento não recair no mesmo estado
-- na próxima gravação sem que alguém escolha, conscientemente, um aprovador.

DO $$
DECLARE
  v_presos integer;
BEGIN
  SELECT count(*) INTO v_presos
  FROM public.documentos d
  WHERE d.status = 'pendente'
    AND NOT EXISTS (
      SELECT 1 FROM public.documentos_aprovacoes a WHERE a.documento_id = d.id
    );

  IF v_presos = 0 THEN
    RAISE NOTICE 'documentos: nenhum preso sem aprovador';
  ELSE
    UPDATE public.documentos d
    SET status = 'rascunho',
        requer_aprovacao = false
    WHERE d.status = 'pendente'
      AND NOT EXISTS (
        SELECT 1 FROM public.documentos_aprovacoes a WHERE a.documento_id = d.id
      );
    RAISE NOTICE 'documentos: % soltos de «pendente» para «rascunho» (não tinham aprovador)', v_presos;
  END IF;
END $$;

-- Pedidos de aprovação que apontam para um documento que já não existe.
-- `documentos_aprovacoes` não tinha FK para `documentos` (ver QA-003), por isso
-- apagar um documento deixava o pedido para trás. Um pedido órfão continua a
-- contar para o total de aprovadores e impede o documento — que já nem existe —
-- de fechar; e ninguém o vê, porque a RLS só mostra a linha ao aprovador e ao
-- solicitante.
DO $$
DECLARE
  v_orfas integer;
BEGIN
  SELECT count(*) INTO v_orfas
  FROM public.documentos_aprovacoes a
  WHERE NOT EXISTS (SELECT 1 FROM public.documentos d WHERE d.id = a.documento_id);

  IF v_orfas > 0 THEN
    DELETE FROM public.documentos_aprovacoes a
    WHERE NOT EXISTS (SELECT 1 FROM public.documentos d WHERE d.id = a.documento_id);
    RAISE NOTICE 'documentos_aprovacoes: % pedidos órfãos removidos', v_orfas;
  ELSE
    RAISE NOTICE 'documentos_aprovacoes: nenhum pedido órfão';
  END IF;
END $$;
