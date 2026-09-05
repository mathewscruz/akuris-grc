# Landing Akuris — implementação e validação local

Data: 05/09/2026. Base: `docs/akuris-landing-audit-2026-09-05.md` e refinamentos solicitados durante a execução.

## Direção visual aplicada

- DM Sans em toda a superfície pública, incluindo as demonstrações; títulos com peso 550–600, tracking e escala responsiva próprios.
- Fundo institucional azul-escuro, violeta reservado à identidade/ações e telas claras do produto. Catálogo de módulos em superfície clara para variar o ritmo de leitura.
- Assinatura vetorial derivada do símbolo já usado pelo Akuris, sem imagens de banco, mascotes ou ilustrações de IA.
- Abertura focada no benefício, público-alvo e convite à demonstração. Sem a antiga etiqueta genérica de marca/categoria.
- Gap Analysis em destaque antes da jornada: diagnóstico, adequação, comprovação, requisito, controle, evidência e avaliação.
- Quatro demonstrações simultâneas de riscos → controles → evidências → dashboard, conectadas visualmente. No celular, seguem a mesma ordem verticalmente, sem ocultar etapas.
- As 22 entradas de módulos/recursos do menu estão agrupadas em quatro resumos; detalhes sob demanda. Governança é representada por Controles/Auditorias e a rota do catálogo de frameworks pelo Gap Analysis.
- Ampliação individual das telas, pausa global e controles de reprodução. Movimento reduzido do dispositivo respeitado; sequências pausam fora da viewport, na aba oculta, durante hover e exploração por teclado.
- Cursor do Gap Analysis posicionado pelos elementos renderizados, não por coordenadas fixas; a ação acontece após o deslocamento do cursor.

As demonstrações usam componentes reais de apresentação do Akuris com dados fictícios isolados. **Não são gravações de telas autenticadas nem acesso a registros de clientes.** A indicação está visível na página. A referência autenticada consultada em produção foi somente leitura e não foi transformada em ativo público.

## Implementação comercial e técnica do relatório anterior

- Cabeçalho/rodapé públicos compartilhados, menu móvel, âncoras, skip link e links de navegação consistentes.
- Formulário contextual na rota de origem, validação por campo, foco no primeiro erro, estado de envio, retry com idempotência e confirmação de registro (sem promessa falsa de entrega de e-mail).
- Páginas comerciais de canal de denúncias, migração, segurança e catálogo de guias.
- Planos com carga/erro/vazio, comparação e cálculo anual sem arredondamento indevido. **Preços preservados por decisão do usuário. Sem link de agenda; contato pelo formulário.**
- Metadados gerenciados pelo Helmet sem canonical/description duplicados; catálogo/sitemap e HTML público de leitura pré-gerado para 14 rotas. SEO da home explicita Gap Analysis e as principais áreas.
- Dicionários públicos separados dos internos; formulário de contato carregado sob demanda. Build ainda avisa sobre chunks internos acima de 500 kB; não foi alegada aprovação de Core Web Vitals.
- Backend comercial com validação de contexto, idempotência, retries limitados e separação entre pedido salvo e notificação aceita pelo provedor.
- Visão de solicitações comerciais restrita ao superadmin nas configurações, preservando a RLS existente.
- Eventos locais de integração de funil, sem coleta de analytics, cookies novos, PII ou envio de eventos para terceiros.

## Verificações executadas

- TypeScript: `npx tsc -b` sem erros.
- Suíte completa: **154 arquivos, 859 testes aprovados**.
- Casos adicionais cobrem quatro cenas simultâneas, 22 módulos e traduções, resumo expansível, pausa/visibilidade, movimento reduzido, foco/inert, formulário, erro, idempotência e prevenção de duplicidade.
- Build Vite aprovado, incluindo 14 páginas HTML públicas de leitura e sitemap de 20 URLs.
- Navegador local: desktop e larguras de 390 e 320 px sem overflow horizontal da página; menu 44 × 44 px em 320 px; Escape fecha menu e devolve foco; formulário vazio destaca quatro campos e foca Nome; modal de ampliação cabe em 320 px.
- Preferência `prefers-reduced-motion` emulada: animação da conexão desligada e botões de autoplay removidos, preservando exploração manual.
- DOM: uma meta description e um canonical; DM Sans em títulos, cabeçalho e células demonstrativas.
- Cores-base verificadas por luminância, com ajuste dos cinzas secundários nas telas claras. Referências: [contraste WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [pausa de movimento](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) e [tamanho de alvo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Isto é QA de implementação, **não certificação de acessibilidade**.
- Migração `20260905230000_contact_delivery_context.sql` validada em transação no container local `supabase_db_akuris-local`; nove colunas verificadas e ROLLBACK executado. Nenhuma alteração persistente nessa validação.

## Estado de entrega e limites

- Alterações disponíveis no servidor local `http://127.0.0.1:8081/` para aprovação visual.
- **Sem commit, push ou deploy desta rodada.** Não foi aplicada migração nem enviada notificação em produção.
- Antes da publicação comercial: aplicar a migração e publicar a função de contato junto do frontend; validar recebimento real com destinatário de teste autorizado e conferir os headers/rotas HTML no host final.
- Preços e ausência de agenda são decisões preservadas, não pendências implementadas por suposição.
- Guias editoriais existentes permanecem em português, com indicação de idioma. Conteúdo dinâmico de planos/blog não foi convertido em SSR completo.
- Não foram inventados depoimentos, clientes, certificações, SLAs, garantia de importação universal nem métricas de conversão.
