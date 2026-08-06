# Corrigir 404 no link de due diligence enviado por e-mail

## Problema

O e-mail enviado ao fornecedor aponta para `/due-diligence/responder/<token>`, mas essa rota não existe no aplicativo. A página pública de resposta ao questionário está registrada em `/assessment/<token>`. Por isso o fornecedor cai em 404.

Confirmado nos arquivos:
- `supabase/functions/send-due-diligence-email/index.ts` monta `https://akuris.com.br/due-diligence/responder/<token>`
- `supabase/functions/process-due-diligence-reminders/index.ts` monta o mesmo caminho
- `src/App.tsx` só registra `/assessment/:token` (que é o link correto usado pelo botão "Copiar link" na tela interna)

## Correção

1. Ajustar as duas Edge Functions para gerar o link correto `/assessment/<token>`, usando a mesma URL base configurada (`SITE_URL`, com fallback para o domínio de produção) em ambas — hoje o envio principal tem o domínio fixo no código.
2. Adicionar no roteador uma rota de compatibilidade `/due-diligence/responder/:token` que redireciona para `/assessment/:token`, para que os e-mails já enviados aos fornecedores continuem funcionando.
3. Reimplantar as duas Edge Functions.

## Detalhes técnicos

- Rota nova em `src/App.tsx`, na seção pública (antes das rotas protegidas), com um componente de redirecionamento que lê o `:token` e navega para `/assessment/:token` preservando `replace`.
- Nenhuma alteração de banco, RLS ou lógica de negócio; apenas o caminho da URL.
- Validação: gerar o link de um assessment existente e conferir que tanto `/assessment/<token>` quanto `/due-diligence/responder/<token>` carregam a página pública do questionário.
