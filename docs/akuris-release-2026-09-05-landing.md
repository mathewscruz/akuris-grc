# Publicação — landing, requisitos e canal

Publicação confirmada em 05/09/2026 no domínio https://akuris.pt.

## Versão publicada

- Código: `0c3cb125324a3b906a24a8f8163b716bce5b5c36`, em `main`.
- Commit: `feat: publish refined landing, requirement workflow and canal branding` (64 arquivos).
- Publicação pelo projeto Lovable existente, sem troca de provedor, domínio ou configuração de autenticação.
- O histórico do Lovable marcou esse commit como **Publicado** e exibiu **Seu site foi atualizado**.
- O domínio público passou a entregar `/assets/index-DgtnKQ5k.js`.

## Escopo

- Landing e páginas comerciais: identidade visual, demonstrações interativas com dados fictícios, Gap Analysis, catálogo compacto de módulos, animações, acessibilidade, navegação e SEO.
- Formulário comercial e acompanhamento privado das solicitações. Preços preservados; contato continua pelo formulário, sem link de agenda.
- Popup de requisitos em quatro etapas, orientação prática, revisão das pendências, proteção de rascunho e distinção entre salvar a avaliação e aprovar conformidade.
- Seletor compartilhado de conformidade, com opções explicadas e aparência neutra.
- Logo escuro fornecido pelo usuário como alternativa no canal de empresas sem marca própria ou com falha no carregamento. Marcas próprias continuam preservadas.

## Backend

- Migração aditiva `20260905230000_contact_delivery_context.sql` aplicada no projeto de produção `lnlkahtugwmkznasapfd`. O dry-run identificou somente essa migração pendente.
- Confirmados nove novos campos de contexto/entrega, índice único parcial de `request_id` e RLS habilitado em `contact_form_submissions`.
- Função `send-contact-email` publicada pela CLI, versão 210 após o deploy, estado ACTIVE. O endpoint continua público conforme sua configuração anterior (`verify_jwt: false`).
- Configurações `RESEND_API_KEY` e `CONTACT_FORM_RECIPIENT` presentes; valores não incluídos neste registro.
- Antes da alteração, cópias do esquema público e da função anterior foram salvas fora do repositório, em `C:/Users/mathe/.claude/projects/C--Users-mathe-dev-akuris/tmp/release-landing-20260905`. A cópia do banco contém esquema, não dados de clientes.

## Verificações

- Suíte local final: 877 testes em 158 arquivos aprovados; TypeScript aprovado e lint direcionado sem erros.
- Build de produção aprovado usando variáveis públicas de produção no processo, sem modificar `.env.local`; 14 páginas pré-renderizadas e sitemap com 20 URLs.
- CI da versão publicada: https://github.com/mathewscruz/akuris-grc/actions/runs/33995407418. Os três jobs terminaram com sucesso (tipos/lint/testes, segredos e dependências). As verificações informativas da política existente não equivalem à ausência de avisos.
- HTTP 200 em `/`, `/planos`, `/frameworks`, `/frameworks/iso-27001`, `/solucoes/canal-de-denuncias`, `/seguranca`, `/migracao`, `/auth`, `/akuris/denuncia` e `/sitemap.xml`.
- No navegador público: novo título e hero, fonte DM Sans, quatro cenas simultâneas da jornada e ausência de transbordamento horizontal no tamanho inspecionado.
- Na sessão autenticada de produção: requisito 4.1 abriu com Entender, Avaliar, Comprovar e Revisar e encaminhar. Menu de conformidade exibiu as descrições novas. Inspeção encerrada sem escolher status, responder ou salvar avaliações.
- Canal anônimo em produção: cabeçalho e rodapé carregam `/assets/akuris-logo-light-B_VAGyfp.png`, 650 × 195, sem filtro de inversão; navegação para registro e acompanhamento presente e sem transbordamento horizontal no tamanho inspecionado.
- Serviço de contato: GET recusado com 405; payload vazio e JSON malformado recusados com 400; CORS para `https://akuris.pt` confirmado. Nenhuma solicitação válida ou e-mail foi enviado nos smoke tests.

## Limites e avisos preexistentes

- Entrega efetiva na caixa de e-mail comercial não testada nesta publicação.
- Permanecem avisos de chunks acima de 500 kB e achados preexistentes do painel de segurança/dependências. O aviso `Public Can Execute SECURITY DEFINER Function` não foi ignorado nem alterado automaticamente nesta publicação.
- Nas respostas HTTP inspecionadas existe CSP em meta, mas não foi observado cabeçalho HTTP CSP. Não se declara cobertura completa de segurança por esses smoke tests.
- Não foram alterados MFA, senhas, políticas de autenticação, DNS ou dados de avaliações de clientes.

Os registros de implementação local anteriores descrevem o estado antes desta publicação; este documento confirma a conclusão do deploy correspondente.
