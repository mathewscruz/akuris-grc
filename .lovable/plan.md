# Mover riscos entre status com menos cliques

Hoje o status do risco só muda abrindo o formulário de edição. O objetivo é permitir avançar ou recuar o status direto onde o usuário já está.

## O que o usuário vai ver

1. **Trilha de status no painel lateral do risco**
   Logo abaixo do título: Identificado → Analisado → Em tratamento → Tratado → Monitorado.
   - O passo atual fica destacado; clicar em outro passo muda o status.
   - Botão "Avançar para <próximo>" para o caso mais comum, em um clique.

2. **Status clicável na tabela de riscos**
   A pílula de status na coluna Status vira um menu: clicar abre a lista de status e escolher salva na hora, sem abrir o formulário.

3. **Proteções e feedback**
   - "Tratado" continua bloqueado sem tratamento concluído: o passo aparece desabilitado com a explicação e um atalho "Adicionar tratamento".
   - Toast com "Desfazer" por alguns segundos após cada mudança.
   - Só aparece para quem tem permissão de editar Riscos.
   - A mudança entra no histórico/trilha de auditoria do risco (já gravada pelo gatilho existente).

## Detalhes técnicos

- Novo componente `RiscoStatusStepper` (painel) e `RiscoStatusMenu` (célula da tabela), ambos usando `StatusPill`/`Chip` e textos pt/en via `t()`.
- Um hook único `useAlterarStatusRisco` faz o update com `.eq('empresa_id', empresaId)`, valida com `podeMarcarTratado`, invalida as queries de riscos e do detalhe, e usa `undoableAction`.
- Ordem dos status centralizada em `risk-status.ts`; teste unitário para a regra de "Tratado" e para a sequência de avanço.
- Sem mudanças no banco.
