# Análises de documentos visíveis para toda a empresa

## Situação atual (verificada)
- As regras de acesso das análises, dos detalhes por requisito, do progresso e dos arquivos enviados já são por empresa, não por usuário: qualquer membro ativo da mesma empresa pode ler. Nenhuma empresa vê dados de outra.
- A lista "Avaliações recentes" e os números do topo já buscam tudo da empresa, sem filtrar por quem enviou.
- O que falta: a tela não mostra **quem enviou** cada análise, não há botão para **abrir o documento original**, e o aviso de conclusão só vai para quem enviou. Para os colegas, parece que não têm acesso.

## O que farei
1. **Confirmar na prática:** entrar como um segundo membro da empresa Nexure e verificar que ele vê a lista, abre o resultado e baixa o arquivo. Se algo estiver bloqueado, corrijo a regra de acesso correspondente, sempre limitada à empresa.
2. **"Enviado por" e data** em cada linha da lista e no topo do resultado (nome e foto do colega).
3. **Botão "Abrir documento"** no resultado e no menu da linha, que abre o arquivo analisado para qualquer membro da empresa (link temporário e seguro).
4. **Filtro rápido** na lista: Todas · Enviadas por mim.
5. **Aviso no sino** ao concluir uma análise: vai para quem enviou e também para os administradores da empresa, com link direto para o resultado.

## Detalhes técnicos
- Lista: `select('*, autor:profiles!created_by(nome, avatar_url)')` ou busca separada por `created_by`, sempre com `.eq('empresa_id', empresaId)`.
- Abrir documento: `storage.from('adherence-documents').createSignedUrl(metadados_analise.arquivo_storage, 300)`; a pasta já começa pelo `empresa_id`, o que mantém o isolamento.
- Notificação: na finalização do job em `analyze-document-adherence`, chamar `criar_notificacao` também para admins da mesma `empresa_id`.
- Textos novos em PT/EN.
