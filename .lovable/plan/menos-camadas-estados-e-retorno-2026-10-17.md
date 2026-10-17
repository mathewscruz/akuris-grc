# Menos camadas + estados e retorno

## 1. Menos camadas (sem quadros dentro de quadros)
Aplicar a mesma regra da aba Conexões: cada área é **um bloco único**, separado por linhas finas e títulos, nunca por cartões dentro de cartões.

Telas com mais camadas hoje, revisadas nesta ordem:
- Relatórios de Denúncias, Contratos e Controles: os gráficos ficam lado a lado no mesmo painel, divididos por linhas, e não em um cartão para cada gráfico.
- Configurações (todas as abas) e Financeiro de IA: as seções viram blocos com título e linha divisória.
- Assessment, Onboarding de framework, Manutenção de ativos, Templates e Relatórios de Due Diligence.
- Consulta de denúncia (portal público).

Regra visual: no máximo **uma** borda arredondada por área. O que estiver dentro dela usa só espaçamento, linhas finas ou fundo levemente diferente, sem borda própria.

## 2. Estados e retorno
- **Estados vazios com próximo passo**: toda lista ou painel sem dados mostra o motivo e um botão com a ação certa ("Criar primeiro risco", "Importar planilha", "Conectar integração"). Hoje só parte das telas faz isso.
- **Excluir com "Desfazer"**: ao excluir ou arquivar um item, aparece um aviso com o botão "Desfazer" por alguns segundos, em vez de só "excluído". Itens críticos (empresa, usuário, framework) continuam pedindo confirmação.
- **Salvamento automático nos formulários longos** (risco, controle, contrato, plano de ação, ROPA): o rascunho fica guardado no navegador enquanto a pessoa escreve. Se ela fechar sem querer, aparece a opção "Recuperar rascunho". Um indicador discreto mostra "Rascunho guardado".
- **Retorno após salvar**: o item salvo fica destacado por um instante na lista, para a pessoa ver onde ele ficou.

## Detalhes técnicos
- Criar uma classe/padrão `SectionBlock` (título + conteúdo + `divide-y`) e substituir `Card` aninhado nos arquivos listados, mantendo os dados e a lógica intactos.
- O `EmptyState` existente recebe as props `reason` e `action` obrigatórias nas listas do `DataTable`. Fazer uma varredura dos módulos sem estado vazio.
- Helper `undoableDelete({ label, onDelete, onRestore })`: aviso Sonner com ação "Desfazer". A exclusão real só ocorre após o tempo do aviso, ou usa o arquivamento já existente. Sempre com escopo `empresa_id`.
- Hook `useDraftAutosave(key, values)` com `localStorage` por usuário + empresa + formulário. A chave é limpa ao salvar ou cancelar. Nada vai para o banco.
- Reaproveitar a animação `akuris-row-new` para destacar o item recém-salvo.
- Textos novos em PT e EN. Testes: rascunho isolado por empresa/usuário e "Desfazer" que impede a exclusão.
