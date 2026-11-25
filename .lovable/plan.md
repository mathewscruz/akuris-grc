# Voltar ao Akuris "Conectado", sem abrir a tela de configuração

## O que acontece hoje (confirmado no código)
- Depois que o administrador autoriza na Microsoft (ou em outro app), o servidor já devolve o usuário para Configurações → Integrações.
- Ao chegar, a página abre automaticamente a janela de configuração da conexão (a da imagem), com "Descobrir recursos", escopo e frequência.
- A conexão fica com o rótulo "Autorizada · falta coletar", e o ícone de importar nos módulos só aparece quando o estado é "conectado". Por isso, logo depois de autorizar, o ícone em Ativos não apareceria.

## O que muda
- Ao voltar da autorização, a janela não abre mais. Fica a lista de integrações com o cartão marcado como **Conectado** e um aviso curto: "Microsoft conectada. Os módulos com dados disponíveis mostram o ícone para importar."
- O rótulo "Autorizada · falta coletar" passa a "Conectado" para todas as integrações; não é preciso coletar nada para ficar conectado.
- O ícone com o anel animado nos módulos aparece logo após a autorização. Clicar nele importa os dados e liga a sincronização diária.
- Se a autorização falhar, continua aparecendo a mensagem de erro, sem abrir a janela.
- A janela de configuração continua disponível para quem clicar no cartão (por exemplo, para desligar módulos ou desconectar).

## Detalhes técnicos
- `IntegrationCollections.tsx`: no efeito que lê `?connection=&integration_result=`, deixar de chamar `setActiveId`; mostrar `toast.success` com o novo texto quando o resultado for `authorized`, e mudar para a aba "connected".
- i18n `collectionHub.status.authorized`: "Conectado" / "Connected" (PT/EN).
- `ImportarIntegracaoBadge`: aceitar as conexões com estado `authorized` ou `connected`.
- Nada muda no servidor; o redirecionamento atual já volta para o Akuris.
