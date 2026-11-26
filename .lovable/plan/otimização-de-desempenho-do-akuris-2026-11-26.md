# Otimização de desempenho do Akuris

## O que foi encontrado (medido)
1. **Rotina automática de orientações dos requisitos roda a cada minuto sem ter trabalho.**
   - Agendamento `orientacoes-requisitos` = `* * * * *` (1.440 execuções/dia).
   - Cada execução varre o catálogo inteiro (1.657 requisitos, ~10 MB de texto) com buscas por texto (`ilike`) até 6 vezes: contagens PT/EN de vazias, contagens PT/EN de "formato antigo", tradução e descrições curtas.
   - Hoje está tudo concluído: 0 vazias, 0 em formato antigo em PT e EN. Ou seja, o trabalho é 100% desperdício.
   - É o maior consumo do banco: as duas consultas `ilike` somam ~11.000 s de execução (58 mil chamadas cada, ~100 ms, pico 1,2 s), mais ~950 s da leitura paginada do catálogo (116 mil chamadas). Isso compete com os usuários e pode deixar telas mais lentas nos picos.
2. **Carregamento do catálogo completo de requisitos nas telas de Frameworks e painéis** (`useGapAnalysisStats`, `useFrameworksOverview`, `GapAnalysisFrameworks`): ~6.600 chamadas de ~85 ms. Custo aceitável e necessário para o score ponderado; não mexer agora (risco de alterar o denominador da conformidade).
3. Frontend: cache de dados já configurado (2 min, sem recarregar ao focar a janela), páginas carregadas sob demanda, e as atualizações periódicas (polling) só ligam enquanto há algo em processamento. Nenhum problema relevante encontrado.

## O que será corrigido
1. **Rotina de orientações passa a rodar a cada hora** (em vez de a cada minuto). Continua se autocorrigindo quando um framework novo entrar; apenas leva até 1 h para começar.
2. **Saída rápida quando não há trabalho:** a rotina passa a fazer uma única verificação barata antes das varreduras pesadas, e só executa tradução/ampliação de descrições quando há candidatos.
3. **Índice parcial** para localizar requisitos sem orientação (vazias PT/EN), deixando a verificação barata instantânea.

## Validação de que nada quebra
- Testes existentes da função e do Gap Analysis executados.
- Chamar a função manualmente (modo agendado) e confirmar resposta "nada a fazer" sem erro, e com um requisito de teste sem orientação confirmar que ainda é processado (depois restaurado).
- Conferir em `slow_queries` / logs que as consultas pesadas deixaram de aparecer a cada minuto.
- Abrir Gap Analysis no navegador e confirmar que scores e orientações seguem iguais.

## Detalhes técnicos
- Migração: `cron.alter_job` do job `orientacoes-requisitos` para `0 * * * *`; `create index ... on gap_analysis_requirements(id) where coalesce(orientacao_implementacao,'')='' ` e equivalente `_en`.
- `populate-requirement-guidance/index.ts` → `scheduledBody`: trocar contagens `count: 'exact'` por `select('id').limit(1)`; executar a checagem de formato antigo só se a de vazias não retornar nada, também com `limit(1)`.
- Sem alteração de telas, permissões ou isolamento por empresa.
