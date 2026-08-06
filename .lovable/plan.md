# Auditoria de links quebrados (404) no sistema

Varredura de todos os links gerados em e-mails, notificações e integrações, comparando com as rotas registradas no aplicativo. Além do caso do due diligence já corrigido, foram encontrados dois links apontando para rotas inexistentes.

## Problemas confirmados

1. **Link de denúncia em notificações de integração** — `src/components/denuncia/DenunciaDialog.tsx` envia para webhooks/integrações o endereço `/denuncias` (plural). A rota registrada é `/denuncia`, então quem clica cai em 404.
2. **Link do e-mail de expiração de trial** — `supabase/functions/check-trial-expiration/index.ts` usa `https://akuris.com.br/contato` como URL de ação. Não existe rota `/contato`; o usuário cai em 404.

## Correções

1. Trocar `/denuncias` por `/denuncia` no link enviado pela notificação de integração.
2. Apontar o e-mail de trial expirado para a página inicial (onde fica o formulário de contato/demonstração), em vez de `/contato`.
3. Reimplantar a função `check-trial-expiration`.

## Verificados e OK (sem alteração)

- Links públicos sem login: `/assessment/:token`, `/review/:token`, `/denuncia/externa/:token`, `/:empresa/denuncia`, `/:empresa/denuncia/consulta`, `/definir-senha` — todos existem e ficam fora das rotas protegidas.
- Links de e-mail internos: `/ativos`, `/ativos/licencas`, `/ativos/chaves`, `/contratos`, `/documentos`, `/incidentes`, `/riscos`, `/governanca?tab=controles`, `/planos-acao` — todos existem.
- `/controles` e `/auditorias` existem como redirecionamentos para `/governanca`, então continuam funcionando.
- Todos os `link_to` do sino de notificações apontam para rotas válidas.

## Detalhes técnicos

- Alterações apenas em string de URL; nenhuma mudança de banco, RLS ou lógica.
- Validação: conferir que `/denuncia` e a URL do e-mail de trial carregam sem 404 na preview.
