# Conectar com um clique e voltar direto ao Akuris

## O que já está certo (conferido no código)
- Ao voltar da autorização, o Akuris mostra a lista de integrações com "Conectado" e um aviso de sucesso; a tela de seleção de itens **não abre mais sozinha**.
- Conectar não importa nada: cada módulo mostra o ícone da ferramenta com o anel, e só importa quando o usuário clica.

## O que ainda atrapalha
- Antes de autorizar ainda aparece uma janela intermediária (nome da conexão + botão "Abrir autorização").
- A autorização abre em outra aba; a aba original fica parada nessa janela, e o usuário acaba com duas abas do Akuris.

## O que vou mudar
1. Clicar em "Conectar" no card (Microsoft, Google, GitHub etc.) abre direto a tela de login/consentimento da ferramenta numa janela de autorização — sem janela intermediária nem campo de nome (nome padrão da ferramenta).
2. Depois que o administrador autoriza, essa janela fecha sozinha e a aba original do Akuris atualiza o card para "Conectado" com o aviso de sucesso. Se o navegador bloquear o fechamento/janela, cai no comportamento atual: a página de integrações abre já como "Conectado".
3. A tela de configuração (módulos, coleta, credencial do Cloud Identity) continua existindo, mas só abre quando o usuário clica no lápis do card.
4. Cancelamento ou erro na autorização mostra só uma mensagem simples no Akuris; nada fica pela metade.
5. AWS continua com sua janela própria, porque exige o número da conta e um passo no console da AWS.

## Detalhes técnicos
- `IntegrationCollections.tsx`: para provedores OAuth, `onOpen` sem conexão chama `start` direto e faz `window.open(authorize_url, "akuris-oauth", "popup,width=520,height=680")` sincronamente após abrir uma janela vazia no clique (evita bloqueio de pop-up); `NewConnection` fica só para AWS.
- Retorno: quando a página de integrações carrega com `integration_result` e `window.opener` da mesma origem, envia `postMessage({type:"akuris-oauth", result})` ao opener e chama `window.close()`; o opener valida `event.origin === location.origin`, invalida a consulta da lista e mostra o toast. Sem opener, mantém o fluxo atual.
- Enquanto a janela está aberta, a aba original consulta a lista a cada 3 s (máx. 3 min) como reserva, caso o `postMessage` não chegue.
- Nenhuma mudança no servidor: state/PKCE, retorno à origem validada e a regra "conectar não importa" ficam iguais.
- Atualizar testes da tela (clique em Conectar chama `start` sem diálogo; mensagem de outra origem é ignorada).
