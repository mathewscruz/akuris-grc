# Criar utilizador mais rápido e sem botão travado

## O problema hoje
Ao clicar em "Criar", a janela espera tudo terminar: criar a conta, aplicar o perfil, gerar o link de primeiro acesso e **enviar o e-mail de boas-vindas**. O envio do e-mail é a parte mais lenta, e só depois disso a janela fecha. Durante esse tempo o botão fica parado, sem dizer o que está a acontecer.

## Melhorias

1. **Responder logo depois de a conta existir**
   - A conta e o perfil continuam a ser criados antes da resposta (para dar erro na hora se o e-mail já existir, o limite de utilizadores estiver atingido, etc.).
   - O link e o e-mail de boas-vindas passam a ser enviados em segundo plano. A janela fecha em cerca de 1–2 segundos em vez de esperar o e-mail.

2. **A pessoa aparece já na lista**
   - Ao fechar a janela, o novo utilizador surge no topo da lista com o estado "Convite a enviar".
   - Quando o e-mail sair, o estado muda sozinho para "Convite enviado". Se falhar, mostra "Convite não enviado" com o botão de reenviar que já existe.

3. **Botão com progresso claro enquanto espera**
   - Em vez de travado, o botão mostra as etapas reais: "A validar…" → "A criar conta…".
   - Campos ficam bloqueados só durante o pedido; a janela pode ser fechada sem cancelar a criação.

4. **Erros mais cedo, antes de clicar**
   - Verificar ao sair do campo e-mail se já existe alguém com esse e-mail na empresa, mostrando o aviso por baixo do campo.
   - Avisar no formulário quando a empresa já atingiu o limite de utilizadores do plano.

5. **Criar e adicionar outro**
   - Opção "Criar e adicionar outro", que mantém a janela aberta com empresa e perfil já preenchidos, para cadastrar várias pessoas seguidas.

## Notas técnicas
- `supabase/functions/create-user`: mover `generateLink` + `send-welcome-email` + atualização de `invitation_sent_at` para `EdgeRuntime.waitUntil(...)`; resposta passa a `emailStatus: 'pending'`. Validações de segurança, MFA e isolamento por empresa ficam iguais.
- Estado do convite deriva de `invitation_sent_at` (já existe); a lista revalida após alguns segundos para refletir o envio.
- `GerenciamentoUsuariosEnhanced.tsx`: inserção otimista na lista, etapas no botão (AkurisPulse), "Criar e adicionar outro", verificação de e-mail duplicado com consulta filtrada por `empresa_id`.
- Textos novos em pt-BR, pt-PT e en.
- Teste: resposta da função não espera o envio do e-mail; e-mail duplicado bloqueia antes do pedido.
- Sem mudanças de base de dados.
