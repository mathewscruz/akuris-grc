# Traduzir os nomes de campos restantes

Os títulos e passos já traduzem, mas os rótulos de campo, placeholders e descrições de seção ainda estão fixos em português (visível no wizard de Riscos: "Probabilidade *", "Impacto financeiro estimado (R$)", "O que pode causar este risco?").

## Onde ainda há texto fixo

Varredura por rótulos e placeholders literais encontrou 12 arquivos:

| Arquivo | Ocorrências |
| --- | --- |
| riscos/RiscoFormWizard.tsx | 22 |
| revisao-acessos/SistemaUsuarioDialog.tsx | 8 |
| riscos/MatrizForm.tsx | 5 |
| landing/DemoRequestDialog.tsx | 4 |
| riscos/RiscoDetailDrawer.tsx | 3 |
| pages/Contratos.tsx, riscos/RiscoPerfilCompleto.tsx | 2 cada |
| riscos/TratamentoForm.tsx, riscos/TratamentosList.tsx, gap-analysis/EvidenceLibraryHub.tsx, configuracoes/integrations/JiraConfigDialog.tsx, auditorias/ItemAuditoriaFormDialog.tsx, ui/field-help-tooltip.tsx | 1 cada |

## O que será feito

1. Substituir todos os rótulos (`Label`/`FormLabel`), placeholders de inputs/textareas e descrições de seção desses arquivos por chaves `t(...)`, mantendo o asterisco de obrigatório fora da tradução quando aplicável.
2. Incluir também os textos auxiliares do mesmo bloco visual que ainda estão em português: descrições de etapa ("Probabilidade × Impacto sem considerar controles."), eyebrows de seção ("Escala", "Probabilidade") e opções de select ainda literais nesses arquivos.
3. Adicionar as chaves novas em PT e EN em `src/i18n/modules/final-i18n.ts`, seguindo o padrão de namespaces já usado (`fin.riscos.wizard.*`, etc.).
4. Rodar uma varredura final com o mesmo padrão de busca para confirmar zero rótulos/placeholders literais restantes, mais typecheck e testes.

## Detalhes técnicos

- Componentes que já recebem `t` de `useLanguage()` só ganham as substituições; os que não usam passam a importar o hook.
- Placeholders dentro de arrays constantes (escalas de matriz, opções de select) usam o padrão map-and-translate já adotado, preservando os `value` originais para não quebrar a lógica salva no banco.
- Nenhuma mudança de schema, query ou regra de negócio.
