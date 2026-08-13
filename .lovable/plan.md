# Finalizar o idioma inglês (dashboard, cards e tabelas)

O dicionário PT/EN já existe e funciona, mas vários componentes ainda têm o texto escrito diretamente no código, então eles não mudam quando o usuário troca para inglês. A página do Dashboard em si já está traduzida — o que continua em português são os componentes filhos (cards, gráficos, drawer de detalhes, atividades recentes) e as tabelas dos módulos.

## O que foi verificado

- `src/pages/Dashboard.tsx`: sem texto fixo (já usa `t()`).
- `src/components/dashboard/`: ~96 trechos em português fixos, incluindo `KpiDrillDownDrawer` (títulos e descrições de todos os KPIs), `RecentActivities` (rótulos de status), `RiskScoreTimeline` (Semana/Mês, "Sem histórico ainda", "Exposição"), `GrcHealthRadar` (Atenção/Crítico/Denún.), `FrameworksOverviewCard` (Concluído / Não iniciado) e os componentes da AkurIA.
- `src/lib/date-utils.ts` usa `ptBR` fixo do date-fns: todas as datas exibidas em cards e tabelas ficam em formato/idioma português mesmo em inglês.
- `src/lib/text-utils.ts` já tem `STATUS_LABELS` PT e EN, mas só 3 arquivos o usam — a maioria das tabelas mapeia status em português no próprio componente.
- Outros módulos com volume relevante de texto fixo: páginas (`src/pages`), riscos, gap-analysis, denúncia, configurações, revisão de acessos, relatórios, due diligence, documentos.

## Execução em ondas

**Onda 1 — Dashboard (resolve o print/reclamação atual)**
- Novo dicionário `src/i18n/modules/dashboard-widgets.ts` com todas as chaves dos widgets.
- Traduzir: `KpiDrillDownDrawer`, `RecentActivities`, `RiskScoreTimeline`, `GrcHealthRadar`, `MultiDimensionalRadar`, `FrameworksOverviewCard`, `HealthScoreGauge`, `HeroScoreBanner`, `KPIPills`, `TrendIndicators`, `AlertsDetailDialog`, `AkurIAChatbot` e componentes em `dashboard/akuria/`.

**Onda 2 — Datas e status globais (afeta todos os cards e tabelas)**
- `date-utils.ts` passa a escolher o locale (`ptBR` ou `enUS`) conforme o idioma ativo, com formato `dd/MM/yyyy` em PT e `MM/dd/yyyy` em EN.
- Padronizar os rótulos de status das tabelas para usar `STATUS_LABELS`/`STATUS_LABELS_EN` de `text-utils.ts`, removendo mapas em português duplicados nos componentes.

**Onda 3 — Tabelas e listas dos módulos**
- Cabeçalhos de coluna, filtros, estados vazios e botões nas tabelas de: Riscos, Documentos, Incidentes, Contratos, Ativos, Auditorias/Controles, Planos de Ação, Due Diligence, Continuidade, Contas Privilegiadas, Revisão de Acessos, Relatórios.

**Onda 4 — Configurações e Denúncias**
- São os dois maiores blocos restantes (canal de denúncia é parcialmente público; será tratado por último para não afetar o fluxo externo).

## Detalhes técnicos

- Cada onda cria/estende um arquivo em `src/i18n/modules/` e o registra em `src/i18n/modules/index.ts`.
- Nenhuma mudança em regras de negócio, consultas ou RLS — só camada de apresentação.
- Ao final de cada onda: varredura automática de texto em português nos arquivos alterados, checagem de chaves não resolvidas em PT/EN, typecheck e testes.
- Valores gravados no banco (status, enums) continuam em português; a tradução acontece só na exibição.
