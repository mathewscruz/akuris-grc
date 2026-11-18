# Bolinha do estado do projeto colorida

## O que muda
Ao lado do nome do projeto, a bolinha do estado deixa de ser sempre cinza e passa a ter a cor do estado:
- **Ativo:** verde-azulado, a cor de "em andamento" do sistema.
- **Pausado:** âmbar, de atenção.
- **Concluído:** verde.
- **Arquivado:** cinza.

O mesmo vale para os cartões e a lista da página de Projetos, para não haver duas cores diferentes para o mesmo estado.

## Detalhes técnicos
- Criar o resolver `projetoStatusChip(status)` em `status-tone.tsx`, com o mapeamento `ativo→active`, `pausado→attention`, `concluido→done` e `arquivado→rest`.
- `ProjetoDetalhe.tsx`: trocar `StatusBadge tone="primary"` por `<Chip tone={...}>`, que é o componente de pílula único do sistema.
- Aplicar o mesmo resolver onde o estado do projeto aparece na listagem.
