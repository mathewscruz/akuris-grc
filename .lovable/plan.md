## Diagnóstico

Os logs do Postgres mostram o erro real ao atualizar status no Gap Analysis:

```
new row for relation "gap_analysis_evaluations" violates check constraint "gap_analysis_evaluations_status_check"
```

A tabela tem uma coluna legada `status` (NOT NULL, default `'nao_avaliado'`) com CHECK:
`status IN ('conforme','nao_conforme','parcialmente_conforme','nao_aplicavel','nao_avaliado')`

Em `src/components/gap-analysis/dialogs/RequirementDetailDialog.tsx` dois inserts gravam valores inválidos nessa coluna legada:

- Linha 509 (`handleStatusChange`, cria a avaliação ao clicar no botão de status): `status: 'em_andamento'` → viola o CHECK.
- Linha 626 (`handleSave`, quando ainda não existe avaliação): `status: 'em_andamento'` e `conformity_status: currentStatus || 'pendente'` (`'pendente'` também não é status de conformidade válido).

Fluxos que usam apenas `conformity_status` (tabela genérica, drawer, tab SoA) funcionam porque deixam o default `'nao_avaliado'` no `status`. O erro só aparece quando o usuário abre o diálogo completo de um requisito e tenta mudar o status pela primeira vez (insert novo).

## Correção (frontend apenas)

Arquivo: `src/components/gap-analysis/dialogs/RequirementDetailDialog.tsx`

1. No `handleStatusChange` (linhas ~500–512): remover `status: 'em_andamento'` do insert. A coluna legada mantém seu default `'nao_avaliado'`. Manter `evidence_status: 'pendente'` (essa coluna não tem o mesmo CHECK).
2. No `handleSave` (linhas ~618–627): remover `status: 'em_andamento'` do insert e trocar `conformity_status: currentStatus || 'pendente'` por `conformity_status: currentStatus || 'nao_avaliado'`, alinhando ao domínio válido de conformidade.

Nenhuma migração é necessária: mantemos a coluna legada intacta para não impactar consumidores existentes (audit, exports, dashboards). Apenas paramos de escrever valores fora do enum.

## Validação

- Após o fix, abrir um requisito ainda sem avaliação em `/gap-analysis/framework/:id`, clicar em Conforme/Parcial/Não conforme e confirmar que o toast de sucesso aparece e o valor persiste (recarregar a página).
- Reexecutar a consulta de `postgres_logs` filtrando por `gap_analysis_evaluations_status_check` e confirmar que não há novos ERROR após o teste.
- Repetir o fluxo pelo drawer (`RequirementDrawer`) e pela tabela genérica para garantir que continuam funcionando (não são tocados).