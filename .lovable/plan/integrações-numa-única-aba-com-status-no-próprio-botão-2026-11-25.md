# Integrações numa única aba, com status no próprio botão

## O que o usuário vai ver
- Em Configurações → Integrações, uma só aba **Integrações** com todos os cartões juntos: Microsoft, Google Workspace, AWS, GitHub etc. (coletas) e Slack, Jira, ServiceNow, Webhooks, Portal de Transparência (conectores).
- Somem as abas internas "Conectadas / Precisam de atenção / Catálogo" e a aba separada "Conectores".
- Cada cartão mostra logo, nome, descrição curta e **um único botão**, cujo texto e cor mudam conforme a conexão:

```text
Sem conexão       -> [ Conectar ]           (contorno, roxo de ação)
Conectado         -> [ ● Conectado ]        (ponto verde; clique abre Gerenciar)
Precisa atenção   -> [ ● Revisar ]          (ponto âmbar: coleta atrasada, escopo faltando)
Erro              -> [ ● Erro · Corrigir ]  (ponto vermelho)
Indisponível      -> [ Em breve ]           (desativado)
```
- O status sai dos selos e do texto lateral; fica só no botão. A última coleta aparece como dica ao passar o mouse.
- Cartões conectados ou que pedem atenção vêm primeiro; depois os outros, por nome. A busca fica no topo da lista.
- As abas **Chaves de API** e **Webhooks de entrada** continuam separadas: são acessos ao Akuris, não integrações com ferramentas.
- O botão "Avisos no Teams" continua dentro do cartão Microsoft. "Ver logs" fica no topo da aba.

## Detalhes técnicos
- Novo `src/components/configuracoes/integrations/IntegrationStatusButton.tsx`: recebe `state: 'disconnected'|'connected'|'attention'|'error'|'unavailable'` e `onClick`. Usa o `Button` compartilhado e o ponto colorido do padrão Chip/status-tone, sem cores Tailwind cruas.
- `IntegrationCollections.tsx`: troca as `Tabs` internas por um grid único de provedores. O estado de cada provedor vem de `connections` (mesma consulta tenant-scoped, sem mudança de backend): nenhuma conexão → Conectar (`setNewProvider`); com conexão → `connectionNeedsAttention` / `status` decidem o estado e o clique chama `setActiveId`. O componente passa a aceitar `extraCards` para os conectores.
- `IntegrationHub.tsx`: remove as abas "collections"/"conectores". Os cartões de conector passam a usar o mesmo layout e o `IntegrationStatusButton` (conectado / erro / desconectado de `integration_configs`) e entram no mesmo grid. O antigo cartão Google Workspace (diálogo legado) só aparece se já estiver configurado, para não duplicar com a coleta Google. Teams e Azure seguem as regras atuais.
- Retorno do OAuth: mantém a lista com o cartão mostrando "Conectado", sem abrir configurações.
- i18n PT/EN para `revisar`, `corrigir` e `ultimaColeta` (dica). Valido as chaves no teste de paridade.
- Atualizo `integration-collections.test.tsx` e `integration-coming-soon.test.tsx`: o botão reflete cada estado e "Em breve" fica desativado.
- `AGENTS.md`: regra "uma aba de integrações; o status vive só no botão do cartão".
- Nenhuma mudança de banco nem de Edge Function. As alterações Microsoft e Google ficam preservadas.
