# Adicionar “Compras” às categorias de Sistemas

## Alteração
- Incluir a opção **Compras** no seletor **Categoria** do formulário de criação e edição de Sistemas.
- Guardar a categoria com o valor estável `compras`, sem alterar os registos existentes.
- Adicionar os rótulos bilíngues: **Compras** em português e **Procurement** em inglês.

## Validação
- Executar o teste de paridade dos dicionários PT/EN.
- Confirmar que a nova opção aparece, pode ser selecionada e é exibida após guardar o Sistema.

## Escopo técnico
- Ajustar apenas o formulário de Sistemas e o dicionário do módulo de contas privilegiadas; não é necessária alteração no banco de dados.
