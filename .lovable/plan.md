## Padronização global de status (acentuação + capitalização)

A imagem mostra badges como "critico", "alto", "medio" — valores brutos do banco renderizados sem passar por `formatStatus()`. O dicionário `STATUS_LABELS` em `src/lib/text-utils.ts` já cobre todas as chaves; o problema é que vários componentes ainda inserem `{value}` cru dentro de `<StatusBadge>` ou `<Badge>`.

### Estratégia
Aplicar `formatStatus()` em **todos** os pontos identificados na auditoria (rg do projeto inteiro). Sem mudanças no banco — apenas camada de apresentação. Garante que "critico" → "Crítico", "alto" → "Alto", "medio" → "Médio", "em_andamento" → "Em Andamento", etc.

### Arquivos a corrigir

| Arquivo | Linhas | O que ajustar |
|---|---|---|
| `src/pages/Riscos.tsx` | 437, 444 | `{value}` → `{formatStatus(value)}` em níveis de risco |
| `src/pages/RiscosAceite.tsx` | 195, 236 | + import `formatStatus`; aplicar nas duas tabelas |
| `src/components/riscos/AceiteDetalheDialog.tsx` | 104, 108 | + import; aplicar nos dois badges de nível |
| `src/components/gap-analysis/dialogs/RequirementDetailDialog.tsx` | 1203 | + import; aplicar em `nivel_risco_inicial` |
| `src/components/controles/ControlesVinculacaoDialog.tsx` | 252, 263 | aplicar `formatStatus` em `nivel` e `criticidade` (import já existe) |
| `src/pages/AtivosLicencas.tsx` | 229 | `tipo_licenca` (import já existe) |
| `src/pages/AtivosChaves.tsx` | 236 | `tipo_chave` (import já existe) |
| `src/components/due-diligence/FornecedoresManager.tsx` | 387 | + import; aplicar em `categoria` |
| `src/components/planos-acao/PlanoAcaoDialog.tsx` | 304 | + import; trocar `capitalize` por `formatStatus` em `prioridade` |
| `src/components/revisao-acessos/ReviewItemsDialog.tsx` | 166–167 | + import; aplicar em `tipo_acesso` e `nivel_privilegio` |
| `src/components/revisao-acessos/ReviewExternalForm.tsx` | 198–199 | + import; idem |
| `src/components/revisao-acessos/ReviewItemDecisionDialog.tsx` | 113 | + import; aplicar em `nivel_privilegio` |
| `src/components/documentos/DocGenDialog.tsx` | 827 | + import; aplicar em `tipo_documento_identificado` |

Total: **13 arquivos**, ~20 ocorrências.

### Validação
- DescoberDadosTab.tsx renderiza apenas contagens numéricas dentro de StatusBadge — não é status, fica como está.
- Badges com `formatStatus()` ou `STATUS_LABELS[...]` aplicado já estão corretos e não serão tocados.
- Após patch, repetir `rg` para garantir zero `<StatusBadge>` ou `<Badge>` com expressão crua de status/criticidade/nível.

Aprovar para aplicar.