-- Duas grafias legadas de base legal que a lei não reconhece pelo nome.
--
-- `dados_pessoais.base_legal` guarda `contrato` e `obrigacao_legal`, que são
-- as mesmas hipóteses que o vocabulário do produto chama `execucao_contrato`
-- (Art. 7º, V) e `cumprimento_obrigacao` (Art. 7º, II). Como não constam da
-- lista da jurisdição, `avaliarBaseLegal` classificava-as como DESCONHECIDAS:
-- o catálogo mostrava o crachá vermelho "Base fora da lei aplicável" ao lado
-- do slug cru, em minúscula e com underscore.
--
-- Não é só cosmético. Num módulo de privacidade, marcar como ilícita uma base
-- que a LGPD admite é o oposto do que a ferramenta serve para fazer — e o
-- filtro por base legal também nunca encontrava esses registos.
--
-- Corrigir aqui e não só no ecrã: enquanto o valor gravado for `contrato`, o
-- PDF, o CSV e a busca global continuariam a divergir do que a tela mostra.

UPDATE public.dados_pessoais
   SET base_legal = 'execucao_contrato'
 WHERE base_legal = 'contrato';

UPDATE public.dados_pessoais
   SET base_legal = 'cumprimento_obrigacao'
 WHERE base_legal IN ('obrigacao_legal', 'obrigacao_juridica');

-- O ROPA passa pela mesma normalização, para as duas tabelas dizerem o mesmo.
UPDATE public.ropa_registros
   SET base_legal = 'execucao_contrato'
 WHERE base_legal = 'contrato';

UPDATE public.ropa_registros
   SET base_legal = 'cumprimento_obrigacao'
 WHERE base_legal IN ('obrigacao_legal', 'obrigacao_juridica');

UPDATE public.ropa_bases_legais
   SET base_legal = 'execucao_contrato'
 WHERE base_legal = 'contrato';

UPDATE public.ropa_bases_legais
   SET base_legal = 'cumprimento_obrigacao'
 WHERE base_legal IN ('obrigacao_legal', 'obrigacao_juridica');
