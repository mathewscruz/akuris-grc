# Popups de Projeto e de Atividade: revisão de uso e funcionamento

## O que está bom
- **Atividade:** o caminho (fase › tarefa), o estado, o título, a descrição, as subtarefas, o checklist e as abas Comentários/Tempo/Vínculos ficam à esquerda. Os dados (responsável, prioridade, datas, estimativa, sprint, etiquetas, %) ficam à direita. Tudo salva e carrega corretamente.
- **Projeto:** os campos essenciais (nome, descrição, estado, responsável, datas) salvam corretamente, e a data de fim antes da de início é bloqueada.

## O que falta ou atrapalha, e o ajuste proposto

### Popup da atividade
1. **Dependências sem lugar para cadastrar:** o Gantt desenha setas e conflitos de dependência, mas nenhuma tela permite dizer "esta tarefa depende de X". Novo campo "Depende de", com busca nas atividades do projeto (várias permitidas) e opção de remover. As setas do Gantt passam a nascer daqui.
2. **Datas invertidas aceitas:** a atividade aceita conclusão antes do início. Passa a mostrar o erro e não salvar, como já acontece no projeto.
3. **Título vazio:** hoje o botão Salvar não faz nada e não explica. Passa a mostrar "Informe o título" e destacar o campo.
4. **Fechar sem salvar perde as edições:** ao fechar com mudanças, pergunta "Descartar alterações?".
5. **Atividade nova esconde subtarefas, checklist e abas:** fica um aviso curto, "Salve para adicionar subtarefas, checklist, comentários e tempo". Junto vem o botão "Salvar e continuar editando", que mantém o popup aberto.
6. **Tempo gasto escondido numa aba:** no painel de dados, ao lado da estimativa, aparece "Gasto: Xh de Yh" com barra. Fica vermelho quando passa da estimativa.
7. **Estimativa sem unidade:** o campo mostra "h".
8. **Bloqueio:** novo interruptor "Bloqueada" com motivo opcional. Uma tarefa bloqueada aparece marcada na lista e no Kanban, e conta como "bloqueada" no relatório de status, que já prevê esse número.

### Popup do projeto
9. **Cor:** o seletor de cor do navegador é trocado por 8 amostras da paleta do sistema.
10. **Responsável vazio:** hoje salvar falha em silêncio. Passa a mostrar o aviso no campo.
11. **Resumo ao editar:** no topo do projeto em edição aparece uma linha com o total de atividades, a % concluída e as atrasadas. Os números são os mesmos do topo da página, para dar contexto antes de mudar o estado. Também aparece o aviso "Ainda há N atividades abertas" ao marcar como concluído.
12. **Organização:** os campos se agrupam em "Identificação" (nome, descrição, cor), "Responsabilidade e estado" e "Prazos". Assim ficam iguais aos títulos de seção do popup da atividade.

## Detalhes técnicos
- Dependências: usar a tabela já lida pelo Gantt (`depende_de_tarefa_id`/`tarefa_id`). Criar o hook `useTarefaDependencias(tarefaId)` com operações de inserir e apagar. A consulta é limitada ao projeto e passa por RLS. É preciso verificar se as regras de acesso de inserção e exclusão existem e criá-las se faltarem. Evitar que a tarefa dependa de si mesma ou de uma tarefa da qual ela própria depende.
- Bloqueio: usar a coluna `bloqueada` que já existe na tarefa. O motivo vai como comentário automático, sem coluna nova.
- "Descartar alterações": comparar `form` com o snapshot inicial. Usar `ConfirmDialog`.
- Validações via `toast.error` + `aria-invalid`; textos novos com chaves PT/EN.
- Projeto: amostras derivadas de `chart-tokens`; resumo via `indicadores(folhas)`.
- Teste: impedir ciclo de dependência e bloquear datas invertidas.
