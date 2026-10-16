# Ícones sem "aura": só o ícone, em todo o sistema

## O que muda para o usuário
- Ícones que hoje aparecem dentro de um quadrado/círculo colorido claro (como o do print) passam a aparecer **só o ícone**, no estilo Hugeicons, sem fundo, sem borda e sem brilho em volta.
- A cor do ícone continua indicando o sentido (roxo para ação/módulo, verde/âmbar/vermelho para estados).
- O tamanho do ícone sobe um pouco (ex.: de 16 para 20–22px) para não ficar "perdido" onde antes havia o quadrado; o alinhamento com títulos e textos se mantém.
- Vale para: cabeçalhos de cartões e módulos, indicadores (KPIs), estados vazios, notificações do sino e avisos (toasts), submenu do menu lateral, painéis laterais, diálogos, assistentes e listas de configurações/integrações.
- Não muda: fotos e iniciais de pessoas (avatares), selos dos frameworks, logotipos de integrações (AWS, Microsoft) e botões de ícone (que continuam com fundo ao passar o mouse).

## Etapas
1. Componentes compartilhados primeiro (mudam dezenas de telas de uma vez): cabeçalho de cartão de módulo, cartão de indicador, estado vazio, notificações/toasts, cabeçalho de diálogo e painel lateral, submenu do menu.
2. Varredura das ~50 telas restantes com o padrão "caixa colorida com um único ícone dentro", trocando pela versão só-ícone.
3. Atualizar a regra visual do sistema e um teste automático que impede voltar a usar caixa colorida com um ícone sozinho dentro.
4. Conferir com capturas: Dashboard, Riscos, Configurações/Integrações, sino de notificações, um painel lateral e o canal de denúncia, em claro e escuro.

## Detalhes técnicos
- Novo `IconMark` (ou ajuste do existente) em `@/components/icons`: renderiza só o ícone com `tone` (primary/success/warning/danger/muted) via tokens; substitui wrappers `h-8..h-12 rounded-* bg-*/10 flex items-center justify-center` cujo único filho é um ícone.
- Ajustar `ModuleCardHeader`, `StatCard`, `EmptyState`, `NotificationCenter`/`akurisToast`, `dialog-shell`, `master-detail-dialog`, `wizard-dialog`, `RecordDetailDrawer`, `AppSidebar` (submenu).
- Detecção por busca de classes + revisão manual; excluir `Avatar`, `FrameworkBadge`, logos `<img>`, `Button size="icon"`.
- Teste em `src/__tests__/icone-sem-aura.test.ts` (regex sobre wrappers com fundo tonal e um único ícone).
- Atualizar memórias "Notifications Editorial/Pill" (chip 32px) e "Akuris Icon System" para a regra só-ícone.
