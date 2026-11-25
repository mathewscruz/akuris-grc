# Integrações só com Conectar e Desconectar

## O que o usuário vai ver
- **Card não conectado:** botão "Conectar". Abre a autorização da ferramenta e volta ao Akuris como "Conectado", como já acontece hoje.
- **Card conectado:** sem lápis e sem tela de configuração. Clicar no card não abre nada. Há só o botão "Desconectar".
- **Desconectar:** pede uma confirmação curta dizendo o que acontece com os dados importados: o que não está ligado a riscos, incidentes ou controles é removido, e o resto é arquivado. A regra de hoje continua.
- **Tudo vem como padrão completo, para todas as empresas:**
  - Microsoft: Intune, Entra ID e SharePoint;
  - Google: usuários, dispositivos, auditoria e Drive;
  - sempre "todos os itens", sem seleção.
- **Importação:** continua pelo ícone em cada módulo, como você escolheu. A atualização diária liga quando o agendador estiver ativo.
- **Exceções que continuam:**
  - AWS e GitHub mantêm a pequena janela de conexão, porque precisam do número da conta (AWS) ou da instalação do app (GitHub). Depois de conectados, também ficam só com "Desconectar".
  - Computadores do Google (Cloud Identity, opcional): o envio da credencial sai da tela de configuração e vira um link discreto "Adicionar computadores (opcional)" no próprio card do Google, visível só para administradores.
- **Status e erros:** continuam no card (ponto colorido + texto). Em erro, aparece "Reconectar".

## Detalhes técnicos
- `IntegrationCollections.tsx`:
  - remove do fluxo o diálogo de configuração (módulos, escopo, frequência, sistema, "Descobrir recursos");
  - `onOpen` do card conectado deixa de chamar `setActiveId`;
  - novo `extra` com os botões Desconectar/Reconectar e um diálogo de confirmação que usa o purge preview já existente;
  - `GoogleCloudIdentityCredential` passa a abrir num diálogo próprio, a partir do card.
- `IntegrationCard.tsx`: o lápis passa a ser opcional (sem `onEdit` não aparece); a ação principal do card conectado é Desconectar.
- `IntegrationHub.tsx` (conectores antigos): mesma regra; os que ainda têm diálogo de chave/configuração passam a ter Conectar e Desconectar no card. Os conectores que precisam de credencial no primeiro uso mantêm só esse primeiro passo.
- `integration-connect/index.ts`:
  - ao criar a conexão Microsoft, `settings.modules` passa a ser `["intune","entra","documentos"]` (todos os módulos);
  - nova migração de dados ajusta conexões Microsoft existentes para todos os módulos, sem importar nada (`imported_modules` intacto);
  - a ação `configure` continua no backend por compatibilidade, mas a tela não a usa mais.
- O escopo de importação fica sempre "all" (`integration_import_module` já faz isso no primeiro clique). A frequência é decidida só pelo import (opt-in diário com agendador pronto).
- Testes: ajustar os testes da tela de integrações para os casos "conectado mostra só Desconectar, sem lápis/configuração" e "clique no card conectado não abre diálogo"; teste do backend com módulos padrão completos da Microsoft.
- AGENTS.md: regra "Integrações têm só Conectar/Desconectar; módulos e escopo são sempre completos por padrão".
