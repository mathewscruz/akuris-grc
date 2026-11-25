# Microsoft única (com Intune) e limpeza ao desconectar

## O que o usuário vai ver
- Em Integrações, um só cartão **Microsoft**. O cartão antigo "Intune" e o "Azure" legado deixam de aparecer.
- A empresa que já tem o Intune conectado é migrada automaticamente para o cartão Microsoft, com o módulo Intune já marcado. Não precisa reconectar.
- Dentro do cartão, cada módulo pode ser marcado ou desmarcado:
  - **Intune** → Gestão de Ativos (dispositivos)
  - **Entra ID** → usuários e grupos (Revisão de acessos)
  - **SharePoint/Documentos** → evidências de documentos
  - **Teams** → avisos (continua como está)
- **Ao desmarcar um módulo**, os dados dele que vieram da Microsoft são removidos. **Ao desconectar a Microsoft**, os dados de todos os módulos são removidos.
- Antes de desconectar ou desmarcar, aparece uma confirmação dizendo quantos registos serão removidos por módulo.

## Regras de remoção
- Remove só o que foi criado pela integração daquela empresa. Nada que foi criado à mão é apagado.
- Ativo que também veio do MeshCentral: o ativo fica, e só os dados do Intune são limpos.
- Ativo do Intune ligado a riscos, incidentes ou controles: é arquivado como "Desativado" em vez de apagado. Ele sai das listas, mas o histórico das ligações fica.

## Etapas
1. Migração dos dados: converter a ligação `intune` existente em `microsoft` com `modules=['intune']`, guardando as credenciais e o histórico.
2. Banco de dados: adicionar `integration_connection_id` em `ativos` e preencher esse campo nos ativos do Intune; marcar as evidências de documentos com a ligação de origem.
3. Uma única função no banco, `integration_purge_module(connection, empresa, module)`, faz a limpeza. Ela é chamada ao desconectar (para todos os módulos) e ao salvar um módulo desmarcado.
4. Servidor: na ação `configure`, os módulos removidos disparam a limpeza; na ação `disconnect`, a limpeza vem antes de apagar as credenciais. A coleta só grava dados dos módulos ativos.
5. Interface: esconder os cartões `intune` e `azure` legados; criar a confirmação com as contagens (nova ação `purge_preview`); textos em PT/EN.
6. Testes: a coleta só alimenta os módulos ativos; desmarcar remove os dados; um ativo que também veio do MeshCentral é preservado; isolamento entre empresas.

## Detalhes técnicos
- Isolamento por empresa: toda limpeza filtra `empresa_id` e `integration_connection_id`; a função é security definer, com `search_path` fixo e chamada só pelo serviço.
- Registar no AGENTS.md a regra "dados da coleta ficam ligados à ligação de origem e são removidos ao desconectar".
