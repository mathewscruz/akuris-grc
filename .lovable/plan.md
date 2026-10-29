# Faixa contínua "Destaque + colunas" (modelo C) no topo dos módulos

## O que muda para o usuário
Os números no topo de cada módulo passam a aparecer numa única faixa, igual ao modelo C escolhido:
- **Primeiro número em destaque** à esquerda: número grande, legenda curta embaixo ("riscos ativos", "incidentes") e uma barra larga colorida com a divisão (ex.: Crítico/Alto/Médio/Baixo, com quantidade e %).
- **Demais números em colunas** separadas por linhas finas: rótulo, número, uma linha de alerta opcional com ícone (ex.: "6 atrasados", "2 a vencer") e uma lista curta com bolinha colorida + quantidade.
- Brilho roxo suave no canto direito, como no anexo; no tema claro fica uma borda simples.
- Clicar num número continua abrindo o detalhamento como hoje.
- No celular: o destaque fica em cima e as colunas viram uma grade de 2, com o "ver mais" que já existe.

Os números são sempre os dados reais de cada empresa; nada inventado. Quando um módulo não tiver a divisão disponível, a coluna mostra só o número e o contexto (sem barra vazia).

## Onde aplica
Todos os módulos que hoje usam a faixa de números (cerca de 33 telas): Riscos, Incidentes, Ativos, Documentos, Contratos, Continuidade, Contas privilegiadas, Revisões de acesso, Planos de ação, Privacidade, Denúncias, Projetos, Controles, Auditorias, Sistemas, Due Diligence, Gap Analysis etc. Como todas usam o mesmo componente, a troca é feita num só lugar.

## Divisões por módulo (primeira leva)
Para ficar tão rico quanto o modelo, adiciono a divisão real nos módulos principais:
- Riscos: nível (Crítico/Alto/Médio/Baixo); tratamento (atrasados/em andamento/concluídos); aceites (válidos/a vencer/vencidos).
- Incidentes: severidade; investigação por status.
- Controles: efetivo/parcial/inefetivo.
- Planos de ação: concluídas/em andamento/atrasadas/não iniciadas.
- Ativos e Documentos: por estado/criticidade já existente.
Os demais módulos ganham o novo visual imediatamente, com divisões adicionadas depois se você quiser.

## Detalhes técnicos
- Reescrever a apresentação de `src/components/ui/stat-strip.tsx` mantendo a API atual (sem quebrar as 33 chamadas). Novos campos opcionais em `StatStripItem`: `breakdown?: { label; value; tone }[]`, `alert?: { label; tone }`, `caption?: string`. O primeiro item (ou `hero: true`) vira o destaque.
- Cores só pelos tokens existentes (severidade/estado, `chart-tokens`), roxo apenas no número das colunas de ação, conforme regras do projeto; brilho via token novo no CSS global, `dark:shadow-none`.
- Animação de contagem e barra crescendo reaproveitando `AnimatedMetricValue` e respeitando "reduzir movimento".
- Estados de carregamento com `AkurisPulse`; textos novos em pt/en.
- Atualizar testes existentes da faixa (`experience-refinement`, `um-padrao-por-coisa`, `folga-das-abas`) e adicionar um teste de que a barra soma exatamente os valores reais e some quando não há divisão.
- Validar com Playwright em desktop, iPad e celular na conta do Henrique.
