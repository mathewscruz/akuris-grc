# Dashboard: ícones dos frameworks e indicadores fiéis aos dados reais

## 1. Ícone do framework no card Conformidade
- Cada linha mostra o ícone do framework à esquerda do nome, o mesmo usado no Gap Analysis. O nome e a % ficam ao lado e a barra fica embaixo.

## 2. O que a conferência nos dados encontrou e como corrige
Conferi os dados da empresa de demonstração (henrique.mathews@gmail.com) e da Nexure (a do print):

| Indicador | Situação | Correção |
|---|---|---|
| **Contratos a vencer** | Mostra "nenhum", mas existem 4 contratos a vencer nos próximos 90 dias (7, 10 e 27/nov). Só entravam contratos "Ativo"; os "Vigente" ficavam de fora. | Passa a considerar "Ativo" e "Vigente". |
| **Incidentes abertos** | Um incidente crítico com estado "Em tratamento" não era contado como aberto. | "Em tratamento" passa a contar como em curso em todo o sistema (dashboard, módulo e relatórios). |
| **Gráfico do índice** | Misturava as notas de vários frameworks na mesma semana (ex.: 0 e 49 viravam 24). A linha sobe e desce sem motivo e a variação "+X%" fica errada. | Por semana, usa a última nota de cada framework e mantém o valor anterior quando não há medição nova. Depois tira a média entre os frameworks. A variação compara com 4 semanas antes. |
| **Atividade recente** | Só mostrava riscos, controles, documentos, auditorias e denúncias. Planos de ação, incidentes e contratos nunca apareciam. | Inclui também novos planos, incidentes e contratos. |
| Riscos, Planos e Conformidade | Conferidos contra o banco: os números batem. | Nenhuma mudança. |

## 3. Garantia
- Adiciono testes automáticos para três regras: "Em tratamento" conta como incidente aberto, contrato "Vigente" entra em "a vencer" e a média semanal dos frameworks é calculada corretamente.
- Todas as consultas continuam filtradas pela empresa do usuário.

## Detalhes técnicos
- `ConformidadeTile`: `<FrameworkBadge name versao tipo size="sm" />` em cada linha.
- `ContratosTile`: `.in('status', ['ativo','vigente'])`.
- `src/lib/metrics/incidentes.ts`: `MAP_ESTADO.em_tratamento = 'investigacao'`, com teste em `metrics/__tests__`.
- Série do índice: extrair a função pura `serieSemanalConformidade(rows)` em `bento-utils.ts` (seleciona `framework_id`), com teste.
- `fetchActivities`: mais 3 consultas tenant-scoped (`planos_acao`, `incidentes`, `contratos`) com rotas `?focus=`.
