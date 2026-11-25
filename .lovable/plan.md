# Refinar visual dos cards de integração

Objetivo: cards mais limpos, hierarquia clara e altura uniforme, mantendo a identidade Akuris (roxo só em ação, estado com ponto + texto, Chip único).

## O que muda (visual apenas)

```text
┌──────────────────────────────────────────┐
│ [logo]  Google Workspace      ● Conectado│
│  tile   Identidade                       │
│──────────────────────────────────────────│
│ MÓDULOS             ÚLTIMA COLETA        │
│ Dispositivos +2     25/11/2026 11:48     │
│──────────────────────────────────────────│
│ Computadores                 Desconectar │
└──────────────────────────────────────────┘
```

1. Logo dentro de um "tile" 44px com fundo de superfície elevada e borda suave, para logos de cores/formatos diferentes ficarem equilibrados.
2. Estado sai de baixo do chip e vira um indicador compacto no canto superior direito (ponto + texto), libertando altura.
3. Categoria usa o `<Chip/>` padrão (neutro), sem fundo cinzento cru.
4. Rodapé de dados separado por divisória fina; rótulos em eyebrow (pequenos, maiúsculos, muted); quando não há dados, mostra "Ainda não coletado" discreto em vez de duas linhas de "—" — em cards não conectados o bloco de dados é substituído por uma linha curta "Conecte para começar a coletar".
5. Ações num rodapé fixo alinhado: ação secundária (Computadores, Avisos no Teams) como link à esquerda, Desconectar/Conectar como botão pequeno à direita. Todos os cards ficam com a mesma altura (flex + mt-auto).
6. Lista de módulos longa: mostra o primeiro + "+N" com tooltip completo, em vez de truncar "Dispositivos (móveis…".
7. Hover: borda primária leve + elevação por aresta (dark sem sombra).

## Detalhes técnicos
- Alterar só `IntegrationCard.tsx` (componente partilhado) e, se preciso, a forma como `IntegrationCollections.tsx` passa `extra` (separar ação primária/secundária em props `primaryAction`/`secondaryAction`, mantendo `extra` compatível).
- Novas chaves i18n PT/EN: "Ainda não coletado", "Conecte para começar a coletar".
- Sem mudanças de lógica, estados, conexão, dados ou backend.
- Validar com typecheck e screenshot da aba Integrações em claro e escuro.
