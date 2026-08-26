-- Um valor de contrato não é negativo.
--
-- ## Porque é que isto faltava
--
-- Procuradas TODAS as restrições `CHECK` do esquema `public`, a única que
-- limitava um número era `projeto_tarefas.progresso_pct BETWEEN 0 AND 100`.
-- Não havia nada sobre dinheiro — e a interface também não: vinte e dois
-- campos `type="number"` sem `min` nenhum, entre eles o valor do contrato, o
-- valor do marco, o custo de manutenção e os valores de aquisição e renovação
-- de licença.
--
-- O campo, sozinho, não é o problema. O problema é a SOMA: o valor do
-- contrato entra na carteira do módulo, e o traço fica ao lado do número no
-- teclado. Um «-500000» digitado por engano fica lá dentro sem nada avisar, a
-- baixar um total que ninguém vai reconferir.
--
-- ## Porquê NOT VALID
--
-- Pela mesma razão da regra das datas: vale para tudo o que entrar, e não
-- rebenta na primeira base que tenha uma linha antiga. Nesta não há nenhuma —
-- conferido nas três tabelas antes de escrever isto — mas a migração corre em
-- bases que não se conhecem.
--
-- A interface passa a recusar antes de chegar aqui; isto é a rede por baixo,
-- para os caminhos que não passam pelo formulário: a importação de contratos
-- por CSV e as funções de borda.

ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_valor_nao_negativo;
ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_valor_nao_negativo
  CHECK (valor IS NULL OR valor >= 0) NOT VALID;

ALTER TABLE public.contrato_marcos DROP CONSTRAINT IF EXISTS marcos_valor_nao_negativo;
ALTER TABLE public.contrato_marcos
  ADD CONSTRAINT marcos_valor_nao_negativo
  CHECK (valor IS NULL OR valor >= 0) NOT VALID;

ALTER TABLE public.ativos_licencas DROP CONSTRAINT IF EXISTS licencas_valores_nao_negativos;
ALTER TABLE public.ativos_licencas
  ADD CONSTRAINT licencas_valores_nao_negativos
  CHECK (
    (valor_aquisicao IS NULL OR valor_aquisicao >= 0)
    AND (valor_renovacao IS NULL OR valor_renovacao >= 0)
  ) NOT VALID;

DO $$
DECLARE
  v_negativos integer;
BEGIN
  SELECT
    (SELECT count(*) FROM public.contratos WHERE valor < 0)
    + (SELECT count(*) FROM public.contrato_marcos WHERE valor < 0)
    + (SELECT count(*) FROM public.ativos_licencas
        WHERE valor_aquisicao < 0 OR valor_renovacao < 0)
  INTO v_negativos;

  IF v_negativos > 0 THEN
    RAISE WARNING 'Existem % valor(es) negativo(s) anteriores a esta regra. Ficam como estão — mas entram nas somas da carteira.', v_negativos;
  ELSE
    RAISE NOTICE 'Nenhum valor negativo nas três tabelas de dinheiro.';
  END IF;
END $$;

COMMENT ON CONSTRAINT contratos_valor_nao_negativo ON public.contratos IS
  'O valor entra na soma da carteira. NOT VALID de propósito: vale para o que entrar, não rebenta com o que já lá está.';
