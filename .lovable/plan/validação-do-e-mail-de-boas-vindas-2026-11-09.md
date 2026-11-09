# Validação do e-mail de boas-vindas

## O que verifiquei
- Os 3 usuários criados nos últimos 45 dias (incluindo um hoje, 09/11) tiveram o convite registrado como enviado.
- O envio está ligado corretamente: ao criar usuário, o sistema gera o link "definir senha" e envia o e-mail pelo Resend, de `noreply@akuris.com.br`.

## Problemas encontrados
1. **O administrador nunca sabe se o e-mail falhou.** O cadastro sempre responde "pendente" e o envio acontece depois, em segundo plano. Se falhar, nada aparece na tela e o botão "Reenviar" não é sugerido.
2. **Falhas não ficam registradas.** Quando o envio falha, só um texto genérico vai para os logs; não fica marcado no usuário, então é impossível saber quem não recebeu.
3. **E-mail só em português e sem verificação de entrega.** Não há confirmação de que o Resend entregou de fato (apenas aceitou).

## O que vou fazer
1. Gravar no usuário o resultado do envio (enviado / falhou + motivo curto).
2. Na lista de usuários em Configurações, mostrar um selo "Convite não enviado" com botão "Reenviar convite" quando falhar.
3. Registrar nos logs o motivo real da falha (ex.: domínio não verificado, limite do Resend), sem dados pessoais.
4. Testar criando um usuário de teste e confirmando o registro e a resposta do Resend; depois remover o usuário.

## Detalhes técnicos
- Nova coluna `invitation_error text` em `profiles` (migration), preenchida em `create-user` quando `send-welcome-email` falha; limpa em `invitation_sent_at` com sucesso e em `resend-welcome-email`.
- `send-welcome-email`: logar `error.name/message` do Resend.
- `GerenciamentoUsuariosEnhanced.tsx`: selo + ação de reenvio usando `resend-first-access.ts`, textos PT/EN via `t()`.
- Redeploy de `create-user`, `send-welcome-email`, `resend-welcome-email`.
