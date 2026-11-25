# Novo visual dos cards de integrações

Aplicar o layout da imagem a todos os cards da aba Integrações (Microsoft, Google, AWS e conectores), mantendo a mesma grelha e o mesmo comportamento de clique.

## Como cada card fica

```text
┌──────────────────────────────────────────┐
│ [LOGO]  Microsoft 365            ✎  ⋯    │
│  48px   [Coleta]   ← chip da categoria   │
│         ● Conectado ← ponto + texto       │
│──────────────────────────────────────────│
│ Módulos                 Última coleta     │
│ Ativos, Acessos          há 2 h           │
└──────────────────────────────────────────┘
```

- Logo grande à esquerda sem moldura extra; nome em negrito; abaixo, chip suave com a categoria.
- Estado como ponto colorido + texto (Conectado verde, Falhou vermelho, Rever âmbar, Desconectado cinza, Em breve neutro), no padrão das tabelas compactas.
- Canto superior direito: ícone de lápis (abrir configuração) e, quando conectado, ícone de lixeira vermelho (desconectar, com a confirmação já existente).
- Rodapé em duas colunas com rótulo pequeno e valor — substitui o "Dono/Revisor" da imagem, que não existe nas integrações: "Módulos importados" e "Última coleta". Sem conexão, mostra "—" e o card inteiro é clicável para conectar.
- A descrição longa sai do card e passa a ser tooltip no nome.
- O botão de estado atual some; a ação fica no lápis/clique do card e o estado no ponto + texto.

## Detalhes técnicos

- Criar `integrations/IntegrationCard.tsx` partilhado (props: logo, nome, categoria, state, módulos, última coleta, onEdit, onDisconnect) e usá-lo em `IntegrationCollections.tsx` (disponíveis e "em breve") e em `renderIntegrationCard` de `IntegrationHub.tsx`.
- Estado via `Chip`/StatusBadge com resolvers de `status-tone.tsx`; ícones stroke 1.5; textos novos em pt/en via `t()`.
- Dados de módulos/última coleta vêm das consultas já existentes (settings.imported_modules e integration_runs); nada novo no banco.
- Atualizar a regra do AGENTS.md: o estado do card passa a viver no IntegrationCard (ponto + texto), não no IntegrationStatusButton.
