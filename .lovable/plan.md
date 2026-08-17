# Atalho do Akuris no ecrã inicial do telemóvel

Sim, é possível. É o mecanismo "Adicionar ao ecrã principal" (PWA instalável): o telemóvel cria um ícone que abre o Akuris em ecrã inteiro, sem barra de endereço, como se fosse uma app. Não envolve loja de aplicações nem funcionamento offline.

## O que será feito

1. **Manifesto da aplicação** (`public/manifest.webmanifest`)
   - Nome "Akuris GRC", nome curto "Akuris", modo `standalone`, cor de tema Navy `#0A1628`, orientação vertical, idioma pt-BR.
   - Ícones 192px, 512px e 512px `maskable` (Android recorta em círculo/squircle) gerados a partir da marca Akuris.

2. **Tags no `index.html`**
   - `link rel="manifest"`, `apple-touch-icon` nos tamanhos corretos e metas iOS (`apple-mobile-web-app-capable`, `status-bar-style`, `title`).

3. **Convite discreto para instalar** (novo componente, só em telemóvel)
   - **Android/Chrome:** captura o evento nativo de instalação e mostra uma faixa Akuris ("Instalar o Akuris no seu telemóvel") com botão Instalar e Agora não.
   - **iOS/Safari:** não existe evento nativo, por isso mostra a instrução visual — Partilhar → "Adicionar ao Ecrã Principal".
   - Aparece apenas depois do login, não aparece se a app já estiver a correr instalada, e fica dispensado por 30 dias via `localStorage`.
   - Textos em pt-PT, pt-BR e en através de `t()`, seguindo a regra permanente do projeto.
   - Visual do sistema: superfície de cartão, aresta em dark, Chip/botões existentes, ícone proprietário — sem cores cruas.

4. **Entrada manual em Configurações**
   - Item "Instalar aplicação" no perfil/configurações para o utilizador voltar a chamar o convite se o tiver dispensado.

## Notas técnicas

- Sem service worker, sem `vite-plugin-pwa`, sem modo offline — apenas metadados de instalabilidade, que é o suficiente para o ícone no ecrã inicial e evita riscos de cache antiga no preview e em produção.
- O componente não é renderizado dentro de iframe (preview do editor), pelo que a validação final é feita no URL publicado.
- Nenhuma alteração de backend, RLS ou edge functions.
