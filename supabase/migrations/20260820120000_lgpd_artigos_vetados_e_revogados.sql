-- A LGPD semeada pergunta por artigos que nunca vigoraram.
--
-- Dois casos, confirmados contra o texto compilado do Planalto:
--
--  * **Art. 28** — vetado no acto da sanção da própria Lei 13.709/2018, pela
--    Mensagem de veto nº 451, de 14/08/2018. Nunca entrou em vigor. Estava
--    semeado como "Dispensa do Consentimento" e o produto pedia à empresa que
--    demonstrasse conformidade com uma regra que não existe.
--
--  * **Art. 55-B** — revogado pela Lei nº 14.460/2022. É o único artigo da
--    LGPD integralmente revogado. Estava semeado como "Natureza Transitória",
--    e tratava do carácter transitório da ANPD, que deixou de existir quando a
--    autarquia se tornou permanente.
--
-- Nenhum dos dois tem avaliação, declaração de aplicabilidade ou evidência
-- ligada — verificado antes de apagar. Se tivesse, a remoção teria de ser
-- substituída por marcação como histórico.
--
-- Nota sobre os artigos 55 a 59: TODOS foram vetados na origem, pela mesma
-- Mensagem 451/2018, por criarem autarquia por iniciativa parlamentar. A série
-- 55-A a 55-M e os arts. 58-A e 58-B nasceram depois, pela MP 869/2018
-- convertida na Lei 13.853/2019, para preencher o vazio do veto — não para
-- substituir artigos revogados. Por isso 56, 57, 58 e 59 não constam do
-- catálogo e não devem constar.

DELETE FROM public.gap_analysis_requirements r
 USING public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'LGPD'
   AND f.empresa_id IS NULL
   AND r.codigo IN ('Art. 28', 'Art. 55-B')
   -- Salvaguarda: só apaga o que ninguém tocou. Um requisito com trabalho
   -- feito em cima fica, e passa a ser decisão de quem o avaliou.
   AND NOT EXISTS (SELECT 1 FROM public.gap_analysis_evaluations e WHERE e.requirement_id = r.id)
   AND NOT EXISTS (SELECT 1 FROM public.gap_analysis_soa s WHERE s.requirement_id = r.id)
   AND NOT EXISTS (SELECT 1 FROM public.evidence_library_links l WHERE l.requirement_id = r.id);

-- A ANPD deixou de ser Autoridade e passou a Agência.
--
-- A Lei nº 15.352, de 25/02/2026 (conversão da MP 1.317/2025), reescreveu o
-- art. 55-A: a ANPD passou a "Agência Nacional de Proteção de Dados",
-- autarquia de natureza especial vinculada ao Ministério da Justiça e
-- Segurança Pública, regida pela Lei das Agências Reguladoras. A sigla é a
-- mesma; o nome por extenso não.
UPDATE public.gap_analysis_requirements r
   -- `descricao` existe nas duas tabelas do FROM: sem qualificar, o Postgres
   -- recusa. O alvo do SET vai sem prefixo, o valor vai com.
   SET titulo = replace(r.titulo, 'Autoridade Nacional de Proteção de Dados', 'Agência Nacional de Proteção de Dados'),
       descricao = replace(r.descricao, 'Autoridade Nacional de Proteção de Dados', 'Agência Nacional de Proteção de Dados')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.empresa_id IS NULL
   AND (r.titulo LIKE '%Autoridade Nacional de Proteção de Dados%'
        OR r.descricao LIKE '%Autoridade Nacional de Proteção de Dados%');
