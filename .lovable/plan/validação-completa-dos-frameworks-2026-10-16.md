# Validação completa dos frameworks

## Diagnóstico atual (29 frameworks globais)

| Situação | Frameworks |
|---|---|
| Quantidade bate com a norma oficial | ISO 27001:2022 (121 = cláusulas 4–10 + 93 controles), NIST CSF 2.0 (106), CIS v8 (153), SOC 2 (61 critérios), COBIT 2019 (40), COSO IC (17), COSO ERM (20), ITIL 4 (34), DORA (64), ISO 27701 (49), LGPD (59, revisada hoje) |
| Provável falta de itens | GDPR (97 de 99 artigos), NIS2 (45 de 46), ISO 62443 (55, menos que os requisitos de sistema da 3-3 com melhorias), NIST 800-82 r3, SOX, HIPAA, CCPA/CPRA, ISO 9001/14001/20000/31000/37301 (conferir subcláusulas) |
| Base resumida, precisa de revisão jurídica | BACEN 4.893 (24), CVM 35 (11), SUSEP 638 (12), ANPD 15/2024 (9) |
| Sem orientação de implementação | PCI DSS (247 de 247), SOX (30), SOC 2 (56), NIST 800-82 (41), BACEN, CVM, SUSEP, ANPD 15 |
| Sem inglês | 22 frameworks (todos exceto ISO 27001, LGPD, SOC 2, CRA e os brasileiros novos) |
| Controles de referência ligados | só CRA e LGPD |

Nenhum requisito está sem descrição.

## O que farei

**Etapa 1. Lista oficial × cadastro (por framework)**
Para cada norma monto a lista oficial de itens: cláusulas, controles, artigos ou subcategorias, com códigos. Comparo com o que existe e gero um relatório: o que falta, o que está duplicado, o que tem código ou título errado e o que está fora de ordem. Começo pelos mais usados: ISO 27001, SOC 2, PCI DSS, NIST CSF, GDPR, NIS2, DORA e ISO 27701.

**Etapa 2. Completar o que falta**
Incluo os itens ausentes com título, descrição, orientação, exemplos de evidência e perguntas de diagnóstico em PT e EN, além de corrigir códigos, títulos e ordem. Não apago requisitos que já tenham avaliações de empresas: os incorretos ficam marcados como "não aplicável/obsoleto".

**Etapa 3. Preencher orientações e inglês**
- Gero as orientações que faltam (PCI DSS, SOX, SOC 2, 800-82 e os brasileiros) pelo processo em lote que já existe. Ele grava no banco e não desconta créditos das empresas.
- Gero a tradução para inglês dos 22 frameworks pelo mesmo processo.

**Etapa 4. Normas brasileiras**
Refaço BACEN 4.893, CVM 35, SUSEP 638 e ANPD 15/2024 artigo por artigo a partir do texto oficial. Marco como "requer revisão jurídica" o que for interpretação.

**Etapa 5. Controles de referência**
Estendo o catálogo de controles de referência (hoje privacidade e CRA) para segurança da informação e ligo cada requisito a pelo menos um controle sugerido, como rascunho para revisão.

**Etapa 6. Validação final**
Um teste automático por framework confere: a quantidade esperada de itens, nenhum campo vazio, PT/EN completos e nenhum código duplicado. Entrego um resumo do antes e depois.

## Pontos de atenção
- Normas pagas (ISO, PCI, SOC 2) não podem ter o texto oficial copiado. Os títulos e descrições serão paráfrases, como já é hoje.
- O volume é grande (cerca de 1.900 requisitos), então será feito em lotes, framework por framework, com o relatório de cada etapa.
- As orientações e traduções em lote usam o saldo de IA da plataforma, não das empresas.

## Detalhes técnicos
- Listas de referência versionadas em `supabase/seed/frameworks/<framework>.json` (código, título PT/EN, categoria, ordem); um script de comparação gera o relatório de diferenças.
- Inserções e correções via atualização de dados no modelo global (`empresa_id` nulo); nenhuma mudança de estrutura no banco.
- Itens com avaliações (`gap_analysis_evaluations`) nunca são apagados; usar `obrigatorio=false` + nota de obsolescência.
- Teste Vitest `frameworks-completude.test.ts` com contagens esperadas por framework.
