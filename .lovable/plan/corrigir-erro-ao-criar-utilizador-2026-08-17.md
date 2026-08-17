# Corrigir erro ao criar utilizador

## Diagnóstico (confirmado)

Nos logs da edge function `create-user` o erro real é:

```
Perfil de permissão não pertence à empresa de destino
```

Causa: no diálogo "Novo Utilizador", a lista de **Perfil de Permissão** é carregada sempre a partir da empresa do utilizador autenticado (`fetchPermissionProfiles` filtra por `empresa_id` do próprio perfil). Quando um super-admin escolhe outra empresa no campo "Empresa" (ex.: VITRU BRASIL), o perfil apresentado ("Perfil Geral") pertence a outra empresa, e a edge function rejeita a combinação.

Problema secundário: o toast mostra "Edge Function returned a non-2xx status code" em vez da mensagem de negócio devolvida pela função, o que esconde a causa real do utilizador.

## O que será feito

1. **Perfis de permissão dependentes da empresa escolhida**
   - Passar a carregar os perfis da empresa selecionada no formulário (e não da empresa do utilizador logado).
   - Para super-admin: recarregar a lista sempre que o campo "Empresa" mudar; incluir também perfis globais (`empresa_id` nulo), que a edge function já aceita.
   - Para admin normal: mantém-se apenas a sua própria empresa.
   - Ao mudar de empresa, limpar a seleção de perfil se esta deixar de ser válida, evitando enviar uma combinação inválida.
   - Estado vazio no select ("Nenhum perfil nesta empresa") em pt-PT, pt-BR e en.

2. **Mensagens de erro reais no toast**
   - Ler o corpo JSON da resposta da edge function e mostrar a mensagem devolvida (perfil inválido, limite de utilizadores atingido, e-mail já registado) em vez do texto genérico de non-2xx.
   - Traduzir as mensagens conhecidas nos três idiomas.

3. **Validação preventiva no cliente**
   - Bloquear o botão "Criar" com mensagem inline quando um perfil de outra empresa estiver selecionado, para o pedido nem sair.

## Notas técnicas

- Ficheiro principal: `src/components/configuracoes/GerenciamentoUsuariosEnhanced.tsx`.
- A edge function `create-user` mantém a validação de segurança atual — não será relaxada; o isolamento multi-tenant fica intacto.
- Sem migrações de base de dados nem alterações de RLS.
