# Chamada final mais elegante e refinada

## Problema
O bloco final está pesado: título enorme centrado em três linhas, degradê forte, "A" gigante atrás do texto a cruzar as letras, eyebrow roxo espaçado e botão roxo grande. Fica "barulhento" e com cara de modelo pronto.

## Nova direção
Composição editorial assimétrica, calma, com muito espaço negativo:

```text
───────────────────────────────────────────────────────── (fio fino que se acende)
 Próximo passo                                 
                                               
 A sua próxima auditoria,                       Veja o Akuris com os seus
 mais tranquila.                                frameworks, numa conversa de
                                                30 minutos.
                                                
                                                Pedir demonstração  ⟶
                                                (link sublinhado que cresce)
                                                contato@akuris.com.br
─────────────────────────────────────────────────────────
```

- Título menor (≈ 56–64px), alinhado à esquerda, peso mais leve; só "mais tranquila." em itálico/cor ciano suave, sem degradê arco-íris.
- Remover o "A" gigante atrás do texto; no lugar, o fio horizontal fino que se acende ao rolar (mesma linguagem de "Como funciona").
- Eyebrow discreto, sem roxo e sem letras muito espaçadas.
- Botão vira link editorial: texto com seta que desliza e sublinhado que cresce ao passar o mouse; roxo apenas no foco/realce.
- Brilho de fundo bem sutil num canto, sem halo central.
- Entrada em revelação suave (título por linha), respeitando movimento reduzido.
- Celular: tudo empilhado à esquerda.

## Detalhes técnicos
- `CtaShield` em CinematicSections.tsx: novo markup em grelha 2 colunas; remover SVG do "A".
- CSS `.ed-cta*` em public-site.css reescrito; reutilizar animação `ed-grow`.
- Novas chaves em site.ts (PT/EN): `edCtaTitle2`, `edCtaAccent2`, `edCtaSub2`, `edCtaLabel2`.
- Verificar desktop e mobile com Playwright.
