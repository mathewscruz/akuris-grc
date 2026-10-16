# Resultado da análise — estrutura clara por seções

Hoje tudo aparece empilhado em cartões iguais, esticados na largura toda: é difícil saber onde começa cada assunto e o detalhe de um ajuste ocupa a tela inteira.

## Nova organização

```text
┌──────────────────────────────────────────────────────────────┐
│ VEREDITO  (anel 85% · "Quase lá — faltam 6 ajustes" · resumo)│
│ [ 6 Essenciais ] [ 1 Recomendado ] [ 6 Já atende ] [ 83 Fora ]│  ← cartões-atalho clicáveis
└──────────────────────────────────────────────────────────────┘
[ Ajustes (7) | O que já atende (6) | Detalhe por requisito | Fora do escopo ]   ← abas fixas
┌───────────────────────┬──────────────────────────────────────┐
│ ESSENCIAIS            │  Formalizar aprovação da Alta Direção│
│ ● Formalizar aprov... │  Requisito 5.1 · Essencial            │
│ ● Diligência fornec...│  ─ O que a norma exige                │
│ ● Trabalho remoto     │  ─ O que encontramos no documento     │
│ ...                   │  ─ Por que importa                    │
│ RECOMENDADOS          │  ─ Como corrigir (passos)             │
│ ○ Canal de reporte    │  ─ Texto sugerido  [Copiar]           │
│                       │  [Criar plano de ação]  ← → anterior/próximo
└───────────────────────┴──────────────────────────────────────┘
Próximos passos (faixa compacta 1-2-3 no fim)
```

1. **Topo = resposta + mapa.** Veredito com nota e resumo; logo abaixo, quatro cartões-atalho com número grande e cor própria (Essenciais em vermelho, Recomendados em âmbar, Já atende em verde, Fora do escopo neutro). Clicar leva direto à aba certa.
2. **Abas em vez de rolagem infinita.** Cada assunto tem seu lugar: Ajustes · O que já atende · Detalhe por requisito · Fora do escopo. A aba fica fixa no topo ao rolar.
3. **Ajustes em lista + detalhe (lado a lado).** À esquerda, lista compacta agrupada em Essenciais / Recomendados, cada item com título curto, código do requisito e marca de "plano criado". À direita, o detalhe do selecionado com as 5 seções e as ações, além de setas anterior/próximo. No celular vira lista que abre o detalhe.
4. **O que já atende** em grade de cartões com trecho citado; **Detalhe por requisito** com filtro Conforme / Parcial / Não conforme; **Fora do escopo** com explicação curta.
5. **Hierarquia visual distinta:** cabeçalho de cada seção com título, contagem e frase de ajuda; larguras limitadas para leitura (detalhe ~720px); cores só para significado; entrada suave ao trocar de aba ou de ajuste.
6. Ações gerais (Exportar PDF, Enviar nova versão, Usar como evidência, Corrigir com DocGen) agrupadas numa barra no cabeçalho do veredito.

## Detalhes técnicos
- `AdherenceResultView.tsx`: reorganizar em Veredito + `Tabs` (shadcn) com estado controlado pelos cartões-atalho; aba fixa com `sticky top-0`.
- Novo `AjustesMasterDetail.tsx` (lista + painel, seleção por índice, teclado ↑/↓); reaproveita o conteúdo de `AjusteCard` como painel de detalhe.
- Detalhe por requisito: filtro por status sobre `gap_analysis_adherence_details` já carregado.
- Análises antigas sem veredito continuam no layout atual.
- Chaves PT/EN novas; sem mudanças no servidor.

---

# Framework LGPD — verificação e atualização

## O que encontrei
- 54 requisitos criados (Arts. 1º–27, 33–50, 52–55-L). Todos têm descrição, orientação e exemplos de evidência em português; 1 está sem perguntas de diagnóstico.
- Faltam título/descrição em inglês nos 54 (a orientação em inglês existe).
- Nenhum controle está ligado aos requisitos da LGPD (0 mapeamentos) — por isso a ligação requisito → controle não aparece.
- Fora do framework: Art. 51 (boas práticas) e as resoluções da ANPD vigentes — Res. 2/2022 (pequenos agentes), 4/2023 (sanções), 18/2024 (encarregado) e 19/2024 (transferência internacional). Arts. 28–32 (poder público) e 55-E a 65 (estrutura da ANPD/transitórios) ficam de fora por não se aplicarem a empresas.
- A ordem exibida está fora de sequência (Arts. 37–45 antes do 33; 22–27 no fim).

## O que farei
1. Preencher título e descrição em inglês dos 54 requisitos e as perguntas que faltam.
2. Incluir Art. 51 e requisitos derivados das resoluções ANPD 2/2022, 4/2023, 18/2024 e 19/2024, com orientação e evidências PT/EN.
3. Reordenar por capítulo da lei.
4. Criar o mapeamento de controles de referência por requisito (ex.: registro de tratamentos, RIPD, encarregado, direitos do titular, incidentes, contratos com operadores), para que cada empresa veja os controles sugeridos sem misturar dados entre empresas.
5. Validar: contagem, sem campos vazios, paridade PT/EN.

Detalhes técnicos: atualização de dados no modelo global (empresa_id nulo) e em `control_framework_mappings`; nenhuma mudança visual.
