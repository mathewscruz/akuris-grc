# Nova onda visual: tabelas, topo, vazios, navegação, popups e login

Escolhas: Tabelas B (cartões em lista), Topo A + Vazio B, Abas sublinhadas, Login A (dividida).

## 1. Tabelas — cartões em lista
- Cada linha vira um cartão arredondado com faixa colorida à esquerda (cor da gravidade/estado), ícone, título + descrição curta, responsável com avatar, chip de status, barra de progresso (quando o módulo tiver) e data com ícone.
- Menu "..." à direita; clique na linha continua abrindo o painel lateral.
- Alternância lista/grade e ordenação no topo da tabela.
- Aplicado primeiro em Riscos, Controles, Planos de ação, Incidentes, Documentos, Fornecedores, Contratos e Ativos; demais módulos em seguida pelo mesmo componente.
- No celular os cartões empilham as informações.

## 2. Topo das páginas — variante A
- Título + subtítulo à esquerda, botão principal roxo à direita.
- Quatro cartões de números com variação (seta verde/vermelha) e mini gráfico de área, com dados reais de cada módulo.

## 3. Estados vazios — variante B
- Quadro tracejado com "Vamos começar?" e três atalhos: Cadastrar manualmente, Importar da biblioteca/modelo, Importar planilha (só os que existirem no módulo).

## 4. Navegação e botões
- Abas sublinhadas com contadores em todos os módulos que têm abas.
- Botões padronizados: primário roxo, secundário contornado, fantasma, excluir em vermelho contornado e botões de ícone quadrados.

## 5. Popups
- Cabeçalho com ícone, título e subtítulo; indicador de etapas quando o formulário for longo; seções com título; rodapé fixo com Cancelar e Salvar.

## 6. Cards de métrica
- Rótulo em maiúsculas pequenas, número grande, variação e gráfico de área com degradê (padrão do dashboard).

## 7. Login — dividida
- Esquerda: logo, frase "Governança, riscos e compliance em um só lugar", selos dos frameworks no novo estilo, fundo com grade/onda sutil.
- Direita: formulário atual (e-mail, senha, esqueci a senha, entrar), sem mudar o fluxo de login/MFA.
- Mantém PT/EN e fica empilhado no celular.

## Ordem
1. Componentes base (cartão de lista, topo, vazio, abas, popup, card de métrica).
2. Login.
3. Aplicação módulo a módulo, começando pelos de maior uso.
4. Verificação visual em desktop, tablet e celular, claro e escuro.

## Detalhes técnicos
- Novos/reformulados: `ui/record-list.tsx` (RecordListCard + toggle lista/grade), `PageHeader` com prop `kpis` (sparkline via recharts + chart-tokens), `EmptyState` variante `quickstart`, `ui/tabs.tsx` variante `underline` com `count`, `ui/dialog.tsx` com `DialogSteps`/rodapé sticky, `ui/button.tsx` variantes `outline-destructive`/`icon-square`.
- Cores só por tokens semânticos; severidade via `status-tone.tsx`; Chip/StatusBadge existentes; AkurisPulse como loader; textos novos em PT/EN via `t()`.
- Login: só a camada visual de `Auth.tsx`; reutiliza `FrameworkBadge size="lg"`.
- Sem mudanças de dados ou permissões.
