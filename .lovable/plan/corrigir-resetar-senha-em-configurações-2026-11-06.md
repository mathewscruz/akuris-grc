# Corrigir "Resetar senha" em Configurações

## Causa confirmada
O print mostra `rate_limited`. A trava de tentativas no banco só aceita limites entre 1 e 10, mas o envio feito por administrador pede limite 30 (e o público por IP pede 20). Com valor fora da faixa, a trava responde sempre "bloqueado" — por isso **todo** reset feito pelo admin falha logo na primeira tentativa, sem relação com uso real.

## O que será feito
1. Ajustar a trava para aceitar limites até 50, mantendo o resto igual (janela de 1 hora, contagem por admin, por IP e por e-mail de destino).
2. Na tela de usuários, trocar o texto técnico (`{"success":false,...}`) por mensagens claras em PT/EN: limite atingido ("tente novamente em 1 hora"), sem permissão, usuário não encontrado, envio indisponível.
3. Validar chamando o envio como admin e confirmando resposta de sucesso.

## Detalhes técnicos
- Migration: `CREATE OR REPLACE FUNCTION public.consume_password_reset_attempt` com `p_max_attempts NOT BETWEEN 1 AND 50`.
- `GerenciamentoUsuariosEnhanced.tsx`: mapear `error_code` (rate_limited, forbidden, profile_missing, delivery_unavailable, service_unavailable) para chaves i18n novas em `admin.usuarios`.
- Nenhuma alteração na Edge Function `send-password-reset`.
