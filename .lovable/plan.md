# Corrigir impacto e ativos nos detalhes de incidentes

## Ajustes
- Mostrar o impacto com inicial maiúscula e tradução conforme o idioma: por exemplo, **Baixo** em português e **Low** em inglês.
- Substituir os códigos dos ativos afetados pelos respectivos **nomes clicáveis**, levando ao cadastro do ativo correspondente.
- Para vários ativos, mostrar um link por nome. Se um ativo tiver sido removido ou estiver indisponível para o usuário, mostrar uma indicação traduzida, sem expor o código nem oferecer um link inválido.
- Preservar o visual atual e os dados existentes.

## Diagnóstico confirmado
Em `src/pages/Incidentes.tsx`, o impacto é exibido diretamente, sem o formatador de rótulos já utilizado nos campos vizinhos. Os ativos são exibidos com `ativos_afetados.join(', ')`, embora o formulário os selecione por identificador usando `EntidadeMultiSelect`.

## Detalhes técnicos
- Aplicar o formatador central de rótulos ao impacto estimado.
- Buscar apenas os identificadores e nomes dos ativos vinculados ao incidente aberto, com filtro explícito de `empresa_id`, mantendo o isolamento entre empresas.
- Usar a rota de ativos definida no registro central de entidades. O destino `/ativos?focus=<id>` já abre o cadastro correspondente.
- Renderizar os links no campo existente do painel, que já aceita conteúdo React; não alterar o formulário, o banco ou as permissões.
- Diferenciar carregamento, falha de consulta e ativo indisponível, com textos PT/EN e o indicador de carregamento oficial.

## Validação
- Conferir impacto em português e inglês; incidente com um ou vários ativos; ausência de vínculo; ativo removido ou indisponível; falha na consulta.
- Verificar que cada nome leva ao ativo correto e que a busca fica restrita à empresa atual.
- Executar os testes pertinentes e verificar erros da aplicação. O teste completo com usuário autenticado depende de acesso de teste disponível; se não for possível, informar essa limitação sem afirmar que o fluxo foi validado.