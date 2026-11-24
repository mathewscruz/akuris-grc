# Ajustes da abertura e nova apresentação do Akuris

## 1. Texto da faixa de frameworks
- PT: "Alguns dos frameworks incluídos no Akuris"
- EN: "Some of the frameworks included in Akuris"

## 2. Os três itens com ícones (Gap Analysis, Evidências, Relatórios)
Não são necessários: repetem o que o subtítulo já diz e poluem a abertura. Saem da primeira tela. A ideia de "evidência reaproveitada" passa a ser contada na nova secção abaixo, de forma muito mais forte.

## 3. Nova secção "Sobre o Akuris" — sem números nem cartões
Em vez de estatísticas e grade de cartões, uma narrativa editorial em duas partes:

**a) Manifesto tipográfico**
Uma frase grande ocupando a largura, que vai "acendendo" palavra a palavra conforme a pessoa rola a página:
> "Uma evidência. Todos os frameworks. Nenhuma planilha."
Texto pequeno ao lado explicando em uma linha o que é o Akuris.

**b) "O fio Akuris" — demonstração rolável**
À esquerda, uma lista tipográfica grande dos módulos (Riscos, Controles, Gap Analysis, Privacidade, Auditorias, Continuidade), estilo índice de revista, em cinza claro.
À direita, um desenho fixo de linhas finas: um ponto (a evidência) percorre um fio contínuo que liga os módulos. Ao rolar, o módulo ativo fica branco na lista, o fio se ilumina até ele e aparece uma frase curta do que acontece ali, por exemplo:
- Riscos → "O risco nasce ligado ao controle que o mitiga."
- Controles → "Cada controle sabe quais requisitos atende."
- Gap Analysis → "A mesma evidência vale para ISO, SOC 2 e LGPD."
- Auditorias → "O auditor recebe o pacote pronto, com rastreabilidade."
No fim, os demais módulos (Ativos, Contratos, Fornecedores, Incidentes…) aparecem como uma linha de texto corrida discreta, não como etiquetas.

Mostra o diferencial real (tudo ligado), em vez de dizer "somos completos" com números.

No celular: a lista vira passos verticais com o fio à esquerda.

## Detalhes técnicos
- `site.ts`: alterar `cineMarqueeLeft`; novas chaves `cineManifesto`, `cineThreadIntro`, `cineThread{Riscos..Auditorias}`, `cineThreadMore` em PT/EN (remover `cineStat*`, `cineBen*` e chips não usados).
- `CinematicSections.tsx`: remover `<ul className="cine-benefits">`; substituir conteúdo de `AboutModules` por `Manifesto` (palavras em `<span>` com opacidade via scroll-driven `animation-timeline:view()` e fallback estático) e `ModuleThread` (layout sticky, IntersectionObserver define índice ativo; SVG com `stroke-dashoffset` proporcional ao índice). Remover `Counter` e `ModuleChips` se ficarem sem uso.
- `public-site.css`: classes `.cine-manifesto`, `.cine-thread*`; remover `.cine-stats/.cine-modules/.cine-chips/.cine-benefits`; `prefers-reduced-motion` mostra tudo aceso e estático.
- Validar desktop e mobile com Playwright.
