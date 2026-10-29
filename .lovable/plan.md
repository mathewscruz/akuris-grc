# Faixa de indicadores idêntica ao modelo C em todos os módulos

## Objetivo
Deixar a faixa de indicadores igual ao modelo escolhido (C · Destaque + colunas) e aplicá-la de forma completa em todos os módulos, não só em Riscos e Incidentes.

## O que o modelo C exige (referência visual)
- Faixa única escura e contínua, cantos arredondados, leve brilho roxo à esquerda.
- Bloco de destaque à esquerda: rótulo em maiúsculas, número muito grande, legenda curta abaixo, barra segmentada fina e legenda com bolinhas coloridas e valores.
- Colunas à direita separadas por divisores finos: rótulo em maiúsculas, número médio, linha de contexto/alerta com ícone (ex.: relógio "6 atrasados") e microbarra quando houver meta ou progresso.
- Sem cartões individuais, sem sombras, sem mini gráficos de área competindo com a barra.

## Correções na faixa
1. Comparar a faixa atual com o modelo C (captura lado a lado) e corrigir as diferenças: proporção destaque/colunas (~1.6:1), tamanhos de número, maiúsculas e espaçamento dos rótulos, altura e espessura da barra segmentada, posição da legenda, divisores e brilho.
2. Remover elementos que fogem do modelo (mini gráfico de área, acentos coloridos laterais) quando há barra segmentada.
3. Garantir altura igual das colunas e alinhamento das linhas de base.
4. Manter o comportamento atual: clique abre detalhe, versão celular com "ver mais", tema claro coerente.

## Aplicar nos demais módulos (com dados reais)
Cada módulo ganha destaque + barra segmentada + alertas, usando apenas números reais já carregados na tela:
- Riscos, Incidentes (ajustar ao novo acabamento)
- Ativos, Licenças, Chaves: por estado/criticidade, vencimentos próximos
- Documentos: por estado (aprovado, em revisão, rascunho), revisões vencidas
- Contratos: ativos/a vencer/vencidos
- Continuidade: por criticidade, testes atrasados
- Controles, Auditorias, Sistemas (Governança): por estado/efetividade, achados abertos
- Planos de ação, Minhas tarefas, Projetos: concluído/em andamento/pendente, atrasados
- Privacidade, Denúncias, Contas privilegiadas, Revisão de acessos, Aceite de riscos, Due diligence
- Telas de configurações que usam a faixa mantêm o visual novo sem barra quando não houver divisão significativa.

Onde não existir dado para dividir, a coluna mostra só número e contexto — nunca valores inventados.

## Validação
- Testes da faixa atualizados (segmentos, destaque, alertas).
- Capturas da faixa isolada em desktop e celular comparadas com o modelo C.
- Sem validação autenticada das páginas reais (o projeto usa backend externo); aviso disso no final.

## Detalhes técnicos
- Ajustes em `src/components/ui/stat-strip.tsx` (layout hero/colunas, ocultar `series` quando há `breakdown`).
- Em cada página, montar `breakdown`, `alert` e `caption` a partir das listas/queries já existentes, com `useMemo`, sem novas consultas sem `empresa_id`.
- Novos rótulos em PT/EN via `t()`.
