# Corrigir "Este conteúdo está bloqueado" ao abrir políticas em Documentos

## O que aconteceu
A tela de pré-visualização do módulo Documentos mostra o PDF embutido na janela. Em agosto, o Akuris ganhou uma política de segurança do navegador (endurecimento pedido pelo pentest) que só permite embutir conteúdo vindo do próprio site e proíbe plugins. O PDF é carregado como um arquivo temporário do navegador, que essa regra não autoriza — então o Chrome bloqueia e mostra "Este conteúdo está bloqueado". O arquivo está íntegro; "Download" funciona. Afeta todos os PDFs pré-visualizados, de todas as empresas, e também a pré-visualização na tela de Aprovação de documentos.

## O que muda para o usuário
- PDFs voltam a abrir dentro da janela de pré-visualização (Documentos e Aprovação).
- "Abrir em nova aba" continua funcionando.
- Documentos que são só um link externo (SharePoint, Google Drive etc.) deixam de tentar abrir embutidos — esses sites recusam ser embutidos e a janela ficaria em branco. No lugar aparece um aviso claro com o botão "Abrir em nova aba".
- Nenhuma outra proteção de segurança é afrouxada.

## Detalhes técnicos
- `src/lib/seguranca/politica-csp.ts`: adicionar `['frame-src', "'self' blob:"]` (hoje cai em `default-src 'self'`, que bloqueia `blob:`). `object-src 'none'` permanece.
- Regenerar `public/_headers` e `vercel.json` com `node scripts/gerar-headers.mjs`; o `<meta>` do build já lê o módulo.
- `src/__tests__/cabecalhos-de-seguranca.test.ts`: novo caso exigindo `frame-src` com `blob:` e sem curinga `https:`/`*`.
- `DocumentoPreview.tsx`: remover o `<object>` (bloqueado por `object-src 'none'`) e renderizar o PDF só em `<iframe src={blobUrl}>`; para `arquivo_url_externa`, trocar o iframe por um estado vazio com ação "Abrir em nova aba".
- `AprovacaoDialog.tsx`: trocar `createSignedUrl` (URL de outro domínio no iframe, também bloqueado) por `storage.download` → Blob `application/pdf` → `URL.createObjectURL`, revogando ao fechar.
- Verificar no navegador (Playwright) abrindo um PDF real em Documentos e em Aprovação, confirmando que o iframe carrega e não há violação de CSP no console.
- Lembrar o usuário de publicar: a correção só chega a akuris.pt após a publicação.
