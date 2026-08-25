-- `fornecedores.tipo` volta a ter um só significado: pessoa jurídica ou física.
--
-- ## O que estava partido
--
-- A coluna `tipo` tem `DEFAULT 'pessoa_juridica'` e é isso que a aba de
-- Fornecedores em Contratos mostra e edita — PJ ou PF. Mas o gestor de
-- fornecedores em Due Diligence gravava `tipo: 'fornecedor'` cravado no insert,
-- um valor que não é nem PJ nem PF. Resultado: 39 das 53 linhas tinham
-- «fornecedor» na coluna, e apareciam assim, sem sentido, na aba de Contratos.
--
-- Era o sintoma de duas telas a gerir a mesma tabela sem se falarem. Ao
-- unificar as duas num só gestor, o insert passa a gravar o `tipo` que a
-- pessoa escolhe. Esta migration limpa o que já lá está.
--
-- ## A decisão
--
-- As linhas com `tipo = 'fornecedor'` foram criadas sem escolha de PJ/PF — o
-- código punha o valor fixo. Normalizam-se para `pessoa_juridica`, que é o
-- default da coluna e o caso esmagadoramente comum de um fornecedor. Quem for
-- pessoa física corrige-se à mão, agora que o campo existe no formulário.

UPDATE public.fornecedores
SET tipo = 'pessoa_juridica'
WHERE tipo = 'fornecedor' OR tipo IS NULL OR tipo = '';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.fornecedores WHERE tipo NOT IN ('pessoa_juridica', 'pessoa_fisica')) THEN
    RAISE NOTICE 'fornecedores: ainda há tipos fora de PJ/PF — %',
      (SELECT string_agg(DISTINCT tipo, ', ') FROM public.fornecedores WHERE tipo NOT IN ('pessoa_juridica', 'pessoa_fisica'));
  ELSE
    RAISE NOTICE 'fornecedores: tipo normalizado para PJ/PF';
  END IF;
END $$;
