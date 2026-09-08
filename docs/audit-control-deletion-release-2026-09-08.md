# Exclusão de controles e histórico de auditoria

## Estado da entrega

Implementação preparada para Git/main. **Não publicada em produção**: a publicação foi reservada ao usuário. A migração do banco e a função de notificação também precisam ser publicadas, na ordem abaixo; somente publicar o frontend não conclui a entrega.

## Ordem de publicação

1. Conferir e aplicar `20260908143000_historico_controle_excluido_auditoria.sql` no projeto Supabase do Akuris. O dry-run realizado durante a implementação mostrou somente essa migração pendente.
2. Publicar a Edge Function `send-auditoria-item-notification`, que agora exclui itens históricos dos envios operacionais.
3. Publicar o frontend sincronizado do GitHub no Lovable.

Exemplo, para um operador com acesso ao projeto já vinculado:

```powershell
supabase db push --linked --dry-run
supabase db push --linked
supabase functions deploy send-auditoria-item-notification --project-ref lnlkahtugwmkznasapfd --use-api
```

Conferir o resultado do dry-run antes de prosseguir, pois novas migrações podem ter sido adicionadas depois desta entrega. Não executar os scripts de fixtures de QA no banco de produção.

## Comportamento

- Excluir um controle retira o item correspondente da lista operacional, sem apagar o item, suas evidências ou comentários.
- `controle_excluido_em` e `controle_excluido_id` registram a exclusão. Vínculo nulo, por si só, não significa exclusão.
- O popup abre nos itens operacionais. O acesso discreto “Ver histórico” permite consultar itens de controles excluídos, sem alterar o progresso exibido.
- Os itens históricos não oferecem edição do cadastro. O banco recusa edição de conteúdo, alteração do vínculo ou remoção da marca de histórico, inclusive em formulários antigos. A limpeza de referências por `SET NULL` continua possível, sem reativar o item.
- Apenas a inserção de um novo item manual pode criar automaticamente um controle. Editar itens legados sem vínculo não cria nem recupera controles silenciosamente.
- Pendências, contagens, CSV da lista de auditorias, relatório PDF, buscas operacionais, validação de conclusão e notificações usam o recorte operacional.
- Controles em escopo sem item de trabalho continuam aparecendo com seu código canônico.
- Não foi alterada a política de acesso de leitura ao histórico ou a capacidade já existente de consultar/anotar comentários e evidências.

## Registros anteriores

A migração só classifica uma exclusão antiga quando a trilha `audit_logs` comprova a operação DELETE na mesma empresa, com código, título e timestamp de atualização correspondentes, e o controle não existe mais. Itens sem evidência suficiente permanecem intactos. Isso evita arquivar itens manualmente desvinculados ou pertencentes a outra empresa.

O registro que originou o diagnóstico foi conferido por consulta somente leitura e atende a esses critérios. Nenhum identificador ou conteúdo de cliente é incluído nas fixtures de teste.

## Validação

- Testes React exercitam a lista padrão, histórico, retorno ao escopo, progresso estável e reset ao reabrir.
- Testes SQL executam de verdade criação, vínculo, exclusão, edição posterior, preservação de evidências/comentários e reparo comprovado, em banco local isolado com dados sintéticos.
- A limpeza de referência de responsável em item histórico também foi testada, sem recriar controle nem retirar a marca de histórico.
- Tipos TypeScript, lint, paridade PT/EN, build e checagem Deno da função de notificação conferidos.
- Suíte completa: 951 testes em 174 arquivos aprovados com `npm test -- --maxWorkers=1`, sem erros não tratados. A execução paralela anterior terminou os testes, mas acusou timeout de comunicação do executor; a repetição serial resolveu a falha de infraestrutura.
- A validação visual autenticada de produção permanece dependente de login; testes automatizados não foram apresentados como uma conferência visual realizada em produção.

### Repetir os testes SQL

Criar um banco local vazio com nome iniciado por `akuris_qa_control_delete_`. Concatenar/executar, com `ON_ERROR_STOP=1`, nesta ordem:

1. `scripts/qa/audit-control-delete-setup.sql`.
2. `supabase/migrations/20260817140200_vinculo_unico_controle_auditoria.sql`.
3. `supabase/migrations/20260908143000_historico_controle_excluido_auditoria.sql`.
4. `scripts/qa/audit-control-delete-assert.sql`.

Os bancos isolados usados durante o desenvolvimento não contêm dados de produção. O schema completo do produto não foi copiado nem suas configurações de autenticação alteradas para esses testes.

## Conferência pós-publicação

1. Abrir a auditoria do caso reportado: o item excluído não deve aparecer na lista operacional.
2. Abrir “Ver histórico”: deve aparecer como “Controle excluído”, com evidências/comentários preservados.
3. Conferir contagens na lista de auditorias e no popup.
4. Em ambiente de teste, excluir um controle que possua item/evidência/comentário; reabrir a auditoria e tentar salvar um formulário antigo. A edição deve ser recusada, sem recriação.
5. Verificar um item intencionalmente desvinculado: deve continuar operacional e sem criar controle ao editar.
