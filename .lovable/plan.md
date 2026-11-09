# Corrigir e-mail do usuário e reenviar o convite

## Diagnóstico (verificado)
O convite para `mauricioronei@najason.com.br` não chega porque o domínio `najason.com.br` não existe (o Registro.br responde "domínio inexistente"). O envio do Akuris está correto: remetente, assinatura e autenticação estão configurados. O e-mail precisa ser corrigido.

## O que muda para o usuário
- Em Configurações → Usuários, no menu de ações de quem **ainda não definiu a senha** (convite pendente ou não enviado), aparece **"Corrigir e-mail e reenviar convite"**.
- Abre uma janela pequena com o e-mail atual, o campo do novo e-mail e o botão "Salvar e reenviar".
- Ao confirmar: o e-mail de login é trocado, o perfil é atualizado e um novo convite vai para o endereço certo. O selo "Convite não enviado" some quando der certo.
- Avisos claros: e-mail já usado por outra pessoa, endereço inválido ou domínio que não recebe e-mails ("confira o endereço").
- Usuários que já ativaram a conta não mostram essa opção (para eles, mudar e-mail exige confirmação do próprio usuário e fica fora deste escopo).

## Regras de segurança
- Só administradores da mesma empresa (ou super admin) podem usar.
- Não pode alterar a própria conta nem um super admin.
- Mantém isolamento por empresa.

## Detalhes técnicos
- Nova Edge Function `update-user-email` (padrão de `resend-welcome-email`: `requireUserContext` + `requireValidMfa`, validação Zod, checagem de empresa/papel, bloqueio se o usuário já fez login/`last_sign_in_at`).
- Valida formato, unicidade em `profiles` (mesma regra do create-user) e MX do domínio via DNS (`Deno.resolveDns`, sem MX → 400 `domain_no_mail`).
- `auth.admin.updateUserById(id, { email, email_confirm: true })`, depois `profiles.email`; se o perfil falhar, reverte o e-mail do auth.
- Em seguida reaproveita o fluxo de `resend-welcome-email` (gera link + `send-welcome-email` + atualiza status do convite).
- Frontend: item no menu de ações em `GerenciamentoUsuariosEnhanced.tsx` + diálogo pequeno, chamada via `invokeEdgeFunction`, mensagens PT/EN em i18n, invalidação da lista.
- Teste Deno para as regras: bloqueia não-admin, outra empresa, conta já ativada e domínio sem e-mail.
