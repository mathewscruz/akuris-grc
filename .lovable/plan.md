Sim. A validação apontou alguns ajustes pendentes depois da mudança visual, principalmente no menu lateral e em pequenos pontos de consistência/segurança do módulo de riscos.

## O que vou ajustar

### 1. Menu lateral: submódulo ativo em roxo
O submenu ainda não destaca corretamente porque o item filho está recebendo estilos conflitantes: o `SidebarMenuButton` marca `data-active=true`, mas uma classe `data-[active=true]:bg-transparent` neutraliza o fundo roxo do link.

Vou corrigir em `AppSidebar.tsx`:
- Remover o conflito de `bg-transparent` nos subitens.
- Fazer o estado ativo ser controlado de forma explícita pelo `currentPath`, não pela função interna do `NavLink`.
- Aplicar destaque roxo diretamente no subitem ativo, com texto/ícone coerentes.
- Garantir destaque exato para `/riscos` e `/riscos/aceite`, sem `/riscos` ficar ativo indevidamente quando estiver em `/riscos/aceite`.
- Manter o grupo “Gestão de Riscos” aberto quando qualquer subrota estiver ativa.

Resultado esperado:
- Em `/riscos`, o subitem “Riscos” fica visualmente ativo em roxo.
- Em `/riscos/aceite`, o subitem “Aceite de Risco” fica visualmente ativo em roxo.
- O item pai continua indicando que o módulo Gestão de Riscos está aberto/ativo.

### 2. Padronizar abas e transições no módulo
Hoje `RiscosTabs` já está no novo visual, mas `Aceite de Risco` ainda usa as abas padrão.

Vou ajustar:
- `RiscosTabs.tsx`: manter o visual atual e adicionar animação suave nos conteúdos (`animate-fade-in`).
- `RiscosAceite.tsx`: aplicar o mesmo padrão editorial de abas usado em Gestão de Riscos:
  - linha inferior;
  - ativo roxo;
  - sem fundo pesado;
  - transição visual entre conteúdos;
  - ícones com `strokeWidth={1.5}` onde faltar.

### 3. Corrigir avisos de acessibilidade dos diálogos
Os logs mostram warning de Radix: `Missing Description or aria-describedby`.

Vou adicionar `DialogDescription` nos diálogos de riscos que ainda não têm descrição:
- `AprovacaoRiscoDialog.tsx`
- `AceiteDetalheDialog.tsx`
- `TrilhaAuditoriaRiscos.tsx`
- `HistoricoAvaliacoesDialog.tsx`

Isso remove o warning e melhora acessibilidade sem alterar fluxo visual.

### 4. Reforçar isolamento por empresa nas ações de riscos
Encontrei pontos em que consultas principais já filtram por `empresa_id`, mas algumas ações de update/delete ainda dependem apenas do `id` do registro.

Vou reforçar com `.eq('empresa_id', profile.empresa_id)` onde a tabela tiver esse campo:
- exclusão de risco em `Riscos.tsx`;
- revogação de aceite em `RiscosAceite.tsx`;
- agendamento de revisão em `RiscosAceite.tsx`;
- decisões/aprovações em `AprovacaoRiscoDialog.tsx`;
- consultas de `profiles` usadas para nomes/responsáveis;
- consulta de `audit_logs` e anexos de aceite em `AceiteDetalheDialog.tsx`.

Para tabelas relacionadas que não possuem `empresa_id` direto, vou manter o isolamento via ids já derivados de riscos filtrados por empresa, ou usar join com `riscos` quando for compatível com os relacionamentos existentes.

### 5. Integrar melhor riscos ao sino de notificações
Existe uma notificação automática de revisão de risco no `NotificationCenter`, mas a consulta de riscos não está filtrando por empresa.

Vou ajustar:
- adicionar filtro por `empresa_id` nas notificações automáticas de riscos;
- manter os links direcionando para `/riscos`;
- preservar a centralização no sino do header.

### 6. Remover resíduos fora do padrão
Vou revisar os arquivos tocados para:
- substituir `console.error` restante no hook de estatísticas de riscos por `logger`;
- remover imports não usados quando surgirem dos ajustes;
- manter `AkurisPulse` como loader único;
- manter `StatusBadge` para status/níveis;
- manter ícones no padrão `strokeWidth={1.5}`.

## Arquivos previstos

- `src/components/AppSidebar.tsx`
- `src/components/riscos/RiscosTabs.tsx`
- `src/pages/RiscosAceite.tsx`
- `src/pages/Riscos.tsx`
- `src/components/riscos/AprovacaoRiscoDialog.tsx`
- `src/components/riscos/AceiteDetalheDialog.tsx`
- `src/components/riscos/TrilhaAuditoriaRiscos.tsx`
- `src/components/riscos/HistoricoAvaliacoesDialog.tsx`
- `src/hooks/useRiscosStats.tsx`
- `src/components/NotificationCenter.tsx`

## Validação após aplicar

Depois da implementação, vou validar:
- subitem ativo do menu em `/riscos` e `/riscos/aceite`;
- transição visual entre abas de Gestão de Riscos;
- transição visual entre abas de Aceite de Risco;
- ausência do warning de `DialogDescription` nos diálogos de riscos;
- updates/deletes de riscos sempre com isolamento por empresa;
- notificações automáticas de revisão de risco filtradas pela empresa atual;
- ausência de `console.*` restante no escopo do módulo de riscos.