# Cartões de integração no visual "Faixa de estado" (mockup B)

Mudança só de visual no cartão partilhado da aba Integrações; lógica, estados, conexão e dados ficam iguais.

## Como fica

```text
┌▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀┐  ← faixa fina na cor do estado
│ [logo]  Google Workspace              │
│         Sincroniza usuários, grupos   │  ← descrição curta (2 linhas máx.)
│         e dispositivos.               │
│ (Identidade) (● Conectado)            │  ← chip categoria + chip estado
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░ Módulos        │ Última    [ ⋯ ]    ░│  ← rodapé em superfície mais escura
│░ Dispositivos+2 │ 25/11 11:48        ░│
└───────────────────────────────────────┘
```

1. Faixa de 4px no topo: verde (conectado), âmbar (revisar), vermelho (falha), cinza neutro (não conectado / em breve).
2. Logo 40px sem moldura; nome em negrito; descrição curta da integração em cinza (já existe no catálogo).
3. Linha de chips: categoria neutra + estado com ponto colorido, usando o `<Chip/>` padrão.
4. Rodapé em faixa de superfície mais escura com "Módulos" e "Última" (data curta). Módulos longos mostram o primeiro + "+N" com a lista completa ao passar o rato.
5. Ações (Desconectar, Computadores, Avisos no Teams, Reconectar) vão para um botão "⋯" no rodapé. Em cartões não conectados o botão vira "Conectar" pequeno.
6. Todos os cartões com a mesma altura; modo escuro com aresta em vez de sombra.

## Detalhes técnicos
- `IntegrationCard.tsx`: novo layout; recebe `actions` (lista de itens para o DropdownMenu) e mantém `extra` compatível.
- `IntegrationCollections.tsx` e o grid de conectores legados passam as ações como itens do menu; nenhuma regra de quando cada ação aparece muda.
- Cores da faixa via tokens `success/warning/destructive/muted` (sem cores Tailwind cruas).
- i18n PT/EN para "Última" e rótulo do menu.
- Ajustar testes de UI existentes que procuram os botões (Reautorizar/Computadores) para abrir o menu primeiro.
- Validar com typecheck, testes e captura da aba em claro e escuro.
