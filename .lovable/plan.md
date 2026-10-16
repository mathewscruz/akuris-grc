# Submenu do menu lateral abrindo sozinho

## Causa (confirmada no código)
O menu tem uma regra antiga: "ao mudar de página, abrir o grupo da página atual". Ela fazia sentido na lista expansível, mas no menu estreito o grupo é o painel flutuante. Por isso, sempre que se chega a uma página que pertence a um grupo, o painel do grupo abre sozinho sobre a tela.

Isso acontece em todos estes casos, não só na matriz:
- Clicar num quadrado da matriz de riscos ou em "Ver todos" de Incidentes e Contratos no Dashboard
- Clicar numa linha da Atividade recente, num contrato ou num framework do Dashboard
- Navegar pela busca (Cmd+K), pelo caminho no topo, por notificações do sino ou por links dentro dos módulos (ex.: risco → plano de ação)
- Voltar/avançar no navegador

## Correção
1. No menu estreito (computador e tablet), o painel do submenu **só abre quando a pessoa clica no ícone** do grupo. Mudanças de página nunca o abrem.
2. Ao escolher um subitem ou mudar de página por outro caminho, o painel que estiver aberto **fecha automaticamente**.
3. No celular (lista expansível), mantém-se o comportamento atual: o grupo da página atual aparece expandido, porque ali não cobre a tela.
4. O destaque roxo do grupo ativo continua igual.

## Detalhes técnicos
- `AppSidebar.tsx`: o `useEffect([currentPath])` passa a executar `setOpenGroups([activeGroup])` apenas quando `isMobile`. Fora do mobile, executa `setOpenGroups([])`, que fecha qualquer popover em mudanças de rota.
- `onOpenChange` do Popover continua sendo a única forma de abrir no rail.
- Validação: Playwright em desktop e tablet, navegando para `/riscos?prob=4&imp=5`, `/incidentes`, `/contratos` e `/planos-acao` por URL e por clique, para confirmar que nenhum popover fica aberto (`[data-state=open]` ausente na sidebar). Clicar no ícone do grupo continua abrindo o painel.
