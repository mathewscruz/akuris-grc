# Correção do build e dos 4 problemas de tradução

## 0. Build quebrado (bloqueante)

`src/components/dashboard/akuria/AkurIAMessage.tsx` ficou com um `import` inserido no meio de outro import multi-linha (linha 10), gerando erro de sintaxe. Mover a linha `import { tGlobal } from '@/lib/i18n-global';` para antes do bloco `import { parseAkurIAActions, ... }`.

## 1. Anexo 3 — chaves cruas na tela (`cardsKpi.sweep.contratos.contratos`)

Causa confirmada: em `src/i18n/modules/cards-kpi.ts` o namespace `sweep` foi criado como irmão de `cardsKpi` (dois nós de topo), mas todas as chamadas usam o prefixo `cardsKpi.sweep.*`. O resolvedor não encontra a chave e imprime a string bruta.

Correção: aninhar `sweep` dentro de `cardsKpi` nos dois idiomas (`pt` e `en`), mantendo os prefixos já usados nos componentes intactos. Isso conserta de uma vez todos os rótulos da varredura anterior (Contratos, Ativos, Continuidade, Privacidade, Riscos, Gap, sistema, projetos).

## 2. Anexo 1 — alerta da matriz de risco misturando PT e EN

`src/components/riscos/matriz-config.ts` exporta título e descrição como constantes fixas em português, enquanto o botão usa `t('...configMatrix')`. Converter as duas mensagens em chaves de dicionário (`riscos.matriz.erroTitulo` / `erroDescricao`) e resolvê-las no componente que renderiza o alerta, mantendo as constantes apenas como fallback para uso fora do React.

## 3. Anexo 2 — badge de papel "Administrador"

`src/components/UserProfile.tsx` tem `getRoleLabel` com rótulos fixos (Super Admin, Administrador, Usuário, Somente Leitura). Trocar por chaves de dicionário e resolver via `useLanguage`.

## 4. Anexo 4 — "Servico" (sem cedilha) e sem tradução

O chip vem de `formatStatus(contrato.tipo)` em `src/pages/Contratos.tsx`; como `servico` não existe no dicionário de status, o helper apenas capitaliza o valor cru do banco, perdendo o "ç". Adicionar em `src/lib/text-utils.ts` (`STATUS_LABELS` e `STATUS_LABELS_EN`) os tipos de contrato/fornecedor usados no banco: `servico`/`servicos`, `produto`/`produtos`, `software`, `consultoria`, `prestacao_servicos`, `fornecimento`, `locacao`, `manutencao`, `licenciamento`, `parceria`, `nda`, `outro`.

## 5. Validação

- Rodar o typecheck e o build.
- Rodar o teste de paridade PT/EN (`src/i18n/__tests__/i18n-parity.test.ts`).
- Conferir na tela /contratos que o chip mostra "Serviço" em PT e "Service" em EN, e que nenhum texto `cardsKpi.sweep.*` aparece.

## Detalhes técnicos

- Arquivos tocados: `AkurIAMessage.tsx`, `src/i18n/modules/cards-kpi.ts`, `src/components/riscos/matriz-config.ts` + componente do alerta, `src/i18n/modules/riscos.ts`, `src/components/UserProfile.tsx`, `src/lib/text-utils.ts`.
- Nenhuma mudança de schema, RLS ou Edge Function; alterações restritas a apresentação e dicionários.
