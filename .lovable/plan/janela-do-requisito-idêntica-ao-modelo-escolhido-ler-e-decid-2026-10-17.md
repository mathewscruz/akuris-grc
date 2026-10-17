# Janela do requisito idêntica ao modelo escolhido (Ler e decidir)

## O que muda para o usuário
Ao clicar num requisito, abre uma janela larga e escura, igual à imagem enviada.

**Cabeçalho**
- Selo do framework, nome, chip com o código (ex. A.9.2.3) e o título do requisito.
- Logo abaixo, uma linha de resumo e o botão de fechar à direita.

**Coluna esquerda (ler)**, em três blocos separados por linhas, cada um com o seu ícone:
- **Requisito:** código, título e o texto da norma.
- **Como cumprir:** a orientação em lista de marcadores roxos. O texto longo é quebrado em itens curtos.
- **Evidências esperadas:** contador "X de Y encontradas" no topo. Cada evidência traz:
  - um ícone de check verde ou de círculo vazio;
  - o nome e uma descrição curta;
  - os arquivos ligados como links, e o controle ligado quando existir;
  - um chip "Encontrada" (verde) ou "Faltando" (neutro).

  A ligação de documentos continua aqui.

**Coluna direita (decidir)**
- **Decisão:** controle segmentado com Conforme, Parcial, Não conforme e Não aplicável. As teclas 1 a 4 continuam funcionando.
- **Cartão de sugestão** roxo, com brilho: "Sugerido: Parcial — 2 de 3 evidências encontradas", uma explicação curta e o botão **Aplicar**. A sugestão é local e não gasta créditos.
- **Justificativa:** caixa de texto com contador de 500 caracteres. Continua obrigatória em Parcial e Não conforme.
- **Prazo:** campo com ícone de calendário.
- **Responsável:** avatar, nome e cargo.
- **Salvar:** botão largo no rodapé, com "Salvar e próximo" e as setas de anterior/próximo discretas. O link "Vínculos e plano de ação" continua disponível.

**Celular:** as colunas ficam uma embaixo da outra, e o botão Salvar fica fixo no rodapé.

## Regras
- Só dados reais. "Encontrada" só aparece quando existe um arquivo ligado de fato. Quando a norma não traz uma lista de evidências, aparece um estado vazio honesto.
- Os rascunhos continuam separados por empresa e por usuário. Todo texto novo terá versão em português e em inglês. A janela segue as cores e os selos do Akuris.

## Detalhes técnicos
- Reescrever o layout de `src/components/gap-analysis/v2/RequirementDrawer.tsx`, mantendo as consultas, `sugerirStatus`, o rascunho, a sequência e o salvamento.
- A lista de evidências esperadas vem de `exemplos_evidencias`, dividida em itens. Cada item é cruzado com `evidence_library_links` do requisito (filtrado por empresa) para marcar Encontrada ou Faltando e listar os arquivos.
- O segmentado usa os tons do `StatusBadge`. O cartão de sugestão usa tokens `primary`, sem cores cruas.
- Chaves i18n PT/EN em `gapUi.drawer`. Atualizar os testes existentes que leem este arquivo.

## Depois desta tarefa
Retomar o lançamento da versão 4.0 já aprovado: Novidades, aviso no sino e e-mail.
