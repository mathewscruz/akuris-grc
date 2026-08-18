# Corrigir reset de senha e convites de primeiro acesso

## 1. Reset de senha nas Configurações não envia nada (causa confirmada)

O botão "Resetar senha" na gestão de utilizadores chama a função de envio passando o **id do utilizador**, mas essa função só aceita **e-mail**. Sem e-mail, ela devolve a resposta genérica de sucesso ("se o e-mail existir, enviaremos o link") e nunca gera nem envia nada — por isso o toast aparece verde e o utilizador nunca recebe.

Correção:
- Passar o e-mail do utilizador no pedido feito a partir das Configurações.
- Aceitar também `userId` no lado do servidor (resolvendo o e-mail pelo perfil), para que chamadas antigas continuem a funcionar.
- Quando o pedido vem de um administrador autenticado, devolver o resultado real (enviado / falhou) em vez da resposta uniforme, para o admin ver erro quando houver erro. O fluxo público de "Esqueci a senha" mantém a resposta uniforme (anti-enumeração).
- Registar no histórico que o admin disparou a redefinição.

## 2. Convite a expirar demasiado depressa

O link de convite/recuperação é um token do serviço de autenticação e hoje segue o prazo curto por omissão (1 hora). Ajustes:
- Aumentar o prazo de expiração dos links de e-mail de autenticação para 24 horas (limite máximo suportado).
- Escrever no e-mail de boas-vindas a validade real do link e a indicação de pedir novo convite caso expire (hoje o texto e a realidade não coincidem).
- Na página "Definir senha", tratar o token expirado com uma mensagem clara e um botão "Pedir novo link", em vez de erro genérico.

## 3. Reenviar convites a quem ainda não acedeu

Já existe o reenvio individual, mas o botão só aparece se o utilizador tiver um registo de senha temporária — utilizadores criados pelo fluxo atual (link de convite, sem senha temporária) nunca mostram o botão. Trabalho:
- Passar o critério de "primeiro acesso pendente" a ser apenas **nunca fez login**, independentemente de haver senha temporária.
- Mostrar um selo "Convite pendente" na lista de utilizadores, com a data do último envio.
- Filtro rápido "Apenas convites pendentes" na barra de ferramentas.
- Ação em massa "Reenviar convites pendentes": seleciona os pendentes da empresa e reenvia, com resumo de quantos foram enviados e quantos falharam.
- Cada reenvio gera um link novo (o antigo deixa de valer) e atualiza a data de envio.
- Limitar reenvios ao mesmo utilizador (por exemplo 1 a cada 5 minutos) para evitar abuso e bloqueio do fornecedor de e-mail.

## Notas técnicas

- Ficheiros: `src/components/configuracoes/GerenciamentoUsuariosEnhanced.tsx`, `supabase/functions/send-password-reset/index.ts`, `supabase/functions/resend-welcome-email/index.ts`, `supabase/functions/get-user-access-info/index.ts`, `src/pages/DefinirSenha.tsx`, templates de e-mail em `supabase/functions/send-welcome-email/_templates`.
- Configuração de autenticação: `mailer_otp_exp` para 86400 s.
- Sem alterações de esquema previstas; o reenvio em massa reutiliza a função existente por utilizador.
- Todo o texto novo em pt-PT, pt-BR e en, conforme a regra do projeto.
- Depois das alterações, as edge functions afetadas são reimplantadas.
