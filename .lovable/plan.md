# Landing sem flash branco + Continuidade nas permissões

## 1. Landing page: flash de página branca com texto
Causa confirmada: na publicação, cada página pública é gerada com uma versão "só texto" (para Google/SEO) dentro do `#root`, sem estilo — fundo branco, texto corrido. Ela aparece até o app carregar e depois é trocada.

Correção (mantendo o SEO):
- Manter o texto pré-gerado no HTML (o Google continua lendo), mas escondê-lo visualmente (técnica "visually hidden": posição absoluta, recorte 1px) em vez de mostrá-lo.
- Pôr no `<head>` um estilo crítico mínimo: fundo navy do Akuris (`#0a1628`) em `html, body` para não haver flash branco, mais o logo/AkurisPulse centrado via CSS puro enquanto o app inicia.
- Fallback sem JavaScript: dentro de `<noscript>` (no body) reexibir o texto, para quem não roda JS.
- Vale para todas as páginas públicas pré-geradas (landing, frameworks, blog, segurança, migração, canal).

## 2. Módulo Continuidade nas permissões
Causa confirmada: as telas de Perfis de Permissão e Permissões por Usuário listam módulos da tabela `system_modules`, e nenhuma migration registra `continuidade` lá — por isso não aparece. A navegação já usa `moduleName: 'continuidade'`, então o controle de acesso passa a funcionar assim que o módulo existir.

Correção:
- Migration idempotente inserindo `continuidade` em `system_modules` (nome de exibição "Continuidade de Negócios", ativo, ordem após Contratos/Incidentes), com `ON CONFLICT DO NOTHING`.
- Verificar outros módulos da navegação ausentes em `system_modules` e incluí-los na mesma migration (mesma causa).
- Garantir traduções PT/EN do nome do módulo nas telas de permissão.
- Sem mudança de RLS: `system_modules` é catálogo global; as permissões continuam isoladas por `empresa_id`.

## Validação
- Build de produção e checagem com Playwright do HTML servido: sem texto visível antes do app, fundo navy desde o primeiro frame.
- Query confirmando `continuidade` em `system_modules`; abrir Perfis e Usuários e ver o módulo listado; revogar acesso e confirmar que o menu/rota bloqueia.
