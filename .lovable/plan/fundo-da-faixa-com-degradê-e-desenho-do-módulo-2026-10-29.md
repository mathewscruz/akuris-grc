# Fundo da faixa com degradê e desenho do módulo

## O que muda
- **Degradê igual ao anexo:** azul-marinho profundo à esquerda passando para violeta escuro à direita, com um brilho roxo suave no canto inferior direito e borda fina violeta. Fica sempre escuro, nos temas claro e escuro.
- **Desenho por módulo:** um traço fino e grande no lado direito do fundo (linhas contínuas, baixa opacidade, cortado pela borda), como o do anexo. Ele não compete com os números e fica atrás do texto.
  - Riscos: escudo com alerta. Incidentes: sirene ou raio. Ativos: servidor. Documentos: folhas. Controles: escudo com check. Auditorias: lupa. Sistemas: blocos conectados. Contratos: assinatura. Continuidade: ciclo. Planos de ação: lista com check. Projetos e Minhas tarefas: quadro de tarefas. Denúncias: megafone. Privacidade: cadeado. Contas privilegiadas e Revisão de acessos: chave. Aceite de riscos: selo. Licenças: certificado. Chaves: chave criptográfica. Relatórios: gráfico. Due diligence: aperto de mãos. Gap Analysis: alvo.
  - Os desenhos são feitos com os ícones arredondados que o sistema já usa, ampliados, para manter a identidade visual.
- **Telas sem módulo definido**, como as de Configurações: degradê com a marca do Akuris em traço fino.

## Validação
- Captura isolada da faixa, com e sem desenho, comparada ao anexo nos temas claro e escuro e no celular. No celular o desenho fica menor e mais discreto.
- Testes da faixa continuam passando.

## Detalhes técnicos
- `index.css`: tokens `--band-grad-from/to` e `--band-glow` em HSL. `.akuris-stat-band` passa a usar `linear-gradient(100deg, ...)` mais um `radial-gradient` de brilho.
- `StatStrip`: nova prop opcional `module` (chave do módulo). Um componente `StatBandArt` renderiza o ícone do catálogo `@/components/icons` com cerca de 220px, stroke 1, opacidade ~0.12, `aria-hidden`, absolute à direita e `pointer-events-none`. O conteúdo ganha `z-index` acima dele.
- Cada página passa `module="..."` no seu `StatStrip` (incluindo `SeverityKpiRow` → `riscos`).
