# Formulário "Editar Fornecedor" mais organizado

## O que muda
- Subtítulo corrigido: hoje mostra "Detalhes de Nome *" (texto quebrado). Passa a "Atualize os dados cadastrais do fornecedor" (ou "Cadastre um novo fornecedor" na criação).
- Campos agrupados em 3 blocos com título pequeno em maiúsculas e linha divisória, no padrão Akuris:
  1. **Identificação** — Nome, CNPJ (com botão Consultar na mesma linha), Categoria, Tipo.
  2. **Contato** — Contato responsável, Email, Telefone, Endereço.
  3. **Classificação e notas** — Nível de risco, Observações.
- Fim do espaço vazio ao lado de "Contato Responsável": grade de 2 colunas sempre preenchida.
- CNPJ exibido com máscara (00.000.000/0000-00); a mensagem de CNPJ inválido fica com ícone de alerta, mais discreta.
- Campo "Tipo" vazio passa a mostrar "Selecione o tipo" em vez de ficar em branco.
- Asterisco do obrigatório em cor de destaque suave, não colado ao rótulo.
- Rodapé: "Cancelar" como botão secundário e "Atualizar" (ou "Cadastrar") como principal, alinhados à direita.
- Textos novos em PT e EN.

## Detalhes técnicos
- Arquivo: `src/components/due-diligence/FornecedoresManager.tsx` (bloco do `DialogShell`, linhas ~625–722) e `src/i18n/modules/due-diligence.ts`.
- Só apresentação: mesma lógica de gravação, validação e consulta de CNPJ; o valor gravado do CNPJ continua só com dígitos (máscara aplicada só na exibição/digitação).
- Validar abrindo "Editar" num fornecedor em /due-diligence.
