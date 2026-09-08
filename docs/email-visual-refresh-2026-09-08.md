# E-mails Akuris — identidade e apresentação

## Entrega

Implementação local, preparada para Git/main. Nenhum e-mail real foi enviado e nenhum recurso foi publicado em produção nesta alteração. A publicação continua reservada ao usuário.

- Logo aprovado com escrita escura em cabeçalho branco. O arquivo `public/akuris-logo-email-dark-v2.png` é uma cópia exata de `src/assets/akuris-logo-light.png`.
- URL nova para não reutilizar a imagem branca em cache. O arquivo antigo permanece: substituí-lo também mudaria mensagens antigas, inclusive as que tinham cabeçalho escuro.
- Layout de 600 px, adaptável ao celular, baseado em tabelas e estilos inline. Cabeçalho compacto, títulos legíveis, resumo do registro, campos de prazo/responsável e ação principal.
- Roxo nas ações; cores de atenção/sucesso apenas quando a mensagem exige. Estados continuam identificados em texto, sem depender só de cor.
- Links alternativos copiáveis, logotipo com texto alternativo e versão de texto simples. O código MFA continua no corpo, mas não é exposto no resumo da caixa de entrada.
- DM Sans como preferência tipográfica, com Arial/Helvetica de reserva. A exibição da fonte depende do cliente de e-mail; a estrutura não depende de fontes externas.
- Conteúdo variável tratado como texto, sem permitir que nomes, títulos e descrições alterem a marcação HTML.
- Modelos operacionais compartilham o mesmo gerador. Convites, MFA, senha, testes e campanhas compartilham a mesma base React Email. A prévia no editor usa os mesmos tokens e estrutura visual.
- Novas mensagens do gerador têm versões PT/EN; a escolha de destinatário/idioma existente foi preservada, sem migração de perfis.

Não foram alterados destinatários, preferências de envio, permissões, MFA, validade dos links, agendamentos ou idempotência. A compatibilidade de tipo com `statusCode: null` do provedor foi corrigida sem mudar a lógica de entrega.

## Como publicar

**Publicar somente o Lovable não atualiza os e-mails enviados pelas Edge Functions.**

1. Revisar o estado da migração `20260908143000_historico_controle_excluido_auditoria.sql`, da entrega anterior. A função de notificação de auditoria depende dessas colunas; não publicar essa função antes da migração. Esta mudança visual não acrescenta migrações.
2. Publicar o frontend/arquivos estáticos no Lovable e verificar que `https://akuris.pt/akuris-logo-email-dark-v2.png` retorna uma imagem PNG com a escrita escura. Isso deve ocorrer antes de ativar os novos modelos.
3. Publicar as funções abaixo pelo fluxo autenticado do projeto Supabase, mantendo as configurações atuais de autenticação/JWT:

```text
avisar-denunciante
process-invitation-reminders
send-approval-notification
send-auditoria-item-notification
send-chave-reminder
send-contact-email
send-contrato-vencimento-notification
send-controle-mention-notification
send-controle-notification
send-denuncia-notification
send-due-diligence-email
send-email-campaign
send-incidente-notification
send-licenca-reminder
send-mfa-code
send-password-reset
send-review-notification
send-risco-aceite-notification
send-risco-mention-notification
send-risco-notification
send-test-email
send-welcome-email
```

`resend-welcome-email` já delega o envio para `send-welcome-email`, portanto não precisa ser republicada só para esta alteração. O template antigo local também foi alinhado para evitar divergência futura.

4. Fazer um envio controlado para uma caixa de teste autorizada e conferir Gmail/Outlook, incluindo imagens bloqueadas e modo escuro. A validação no navegador não equivale à renderização desses clientes.

Os e-mails já recebidos não são reescritos. O novo padrão passa a valer nos próximos envios, depois da publicação das funções.

## Repetir a validação

```powershell
npm test -- --maxWorkers=1
npm run typecheck
npm run lint -- --quiet
npm run build
npx deno test --config scripts/qa/email-deno.json --allow-env=APP_URL,SITE_URL,EMAIL_FROM,NODE_ENV scripts/qa/email-layout.test.tsx
npx deno run --config scripts/qa/email-deno.json --allow-env=APP_URL,SITE_URL,EMAIL_FROM,NODE_ENV --allow-read=public/akuris-logo-email-dark-v2.png --allow-net=127.0.0.1:8082 scripts/qa/email-preview.tsx
```

A última instrução abre uma prévia apenas em `127.0.0.1:8082`, com dados sintéticos. Ela não consulta banco, não lê credenciais e não envia mensagens. Não publicar esse servidor de QA.

Conferência visual feita nos modelos de auditoria e autenticação, com inspeção de versões estreitas. O e-mail de auditoria foi medido a 320 px sem rolagem horizontal, com a imagem carregada. Testes de renderização verificam os 13 tipos operacionais e os modelos React de conta/campanha, inclusive depois da sanitização.

Resultado final: 960 testes em 175 arquivos aprovados; três testes Deno de renderização aprovados; checagem de tipos das 23 funções afetadas direta/indiretamente, TypeScript do frontend, lint e build aprovados. O build mantém os avisos preexistentes de tamanho de alguns pacotes. Um teste antigo do canal procurava a forma literal do HTML; foi atualizado para analisar a árvore sintática e continuar garantindo que nenhum conteúdo do caso ou código de acompanhamento entre no aviso ao denunciante.

Referência técnica usada para os estilos responsivos: [suporte a CSS do Gmail](https://developers.google.com/workspace/gmail/design/css). A degradação visual em clientes antigos permanece possível; não há dependência de animações, JavaScript, grid ou flex no corpo dos e-mails.
