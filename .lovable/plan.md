# Relatório executivo de fornecedor com identidade Akuris

## Objetivo
Transformar o PDF da avaliação de fornecedor num relatório executivo de consultoria: estrutura fixa e previsível, cada informação no seu lugar, ilustrações próprias e a identidade visual do Akuris (navy, roxo só como acento, DM Sans, marca Akuris), sem frases soltas e caixas de "atenção" com aspeto gerado.

## O que muda para o utilizador
- Capa institucional: faixa navy com padrão da marca Akuris, nome do fornecedor grande, selo da classificação, quadro de identificação (CNPJ, questionário, datas, código).
- Índice na página 2 com numeração de secções e páginas.
- Página "Resumo executivo" em uma página só: veredito numa frase, medidor semicircular da nota, 4 indicadores (respostas, evidências, lacunas, lacunas críticas), recomendação (Aprovar / Aprovar com condições / Reprovar) e os 3 pontos principais.
- "Perfil de risco": gráfico radar ou barras por secção (ilustração vetorial), matriz de calor peso × resultado das perguntas.
- "Lacunas e plano de ação": tabela única ordenada por impacto, com prioridade, responsável sugerido e prazo.
- "Parecer da IA" reescrito como "Análise do avaliador", em blocos fixos: contexto, pontos fortes, fragilidades, recomendação — sem saudações nem texto corrido.
- "Respostas detalhadas" em anexo (Anexo A), "Metodologia" no Anexo B, com régua de classificação ilustrada.
- Cabeçalho e rodapé padronizados: logo, nome do fornecedor, "Confidencial", página X de Y.

## Ordem de execução
1. Gerar 2 a 3 mockups (capa + resumo executivo) para escolher a direção visual antes de codificar.
2. Criar biblioteca de desenho do relatório (capa, índice, medidor, radar/barras, matriz, tabela, cabeçalho/rodapé) com os tokens Akuris.
3. Reestruturar o gerador do relatório de fornecedor nas secções acima, reaproveitando as regras de nota já existentes.
4. Gerar o PDF com os dados reais da IdVerify, rever página a página e corrigir até ficar limpo.
5. Entregar o PDF de exemplo para validação.

## Detalhes técnicos
- Ficheiros: `src/components/due-diligence/relatorio-fornecedor.ts` (reescrita da montagem), novo `src/lib/pdf-executivo.ts` (primitivas vetoriais em jsPDF: medidor, radar, matriz, índice com segunda passagem para nº de página), `src/lib/pdf-utils.ts` só para expor cores/fontes.
- Fonte DM Sans embutida no jsPDF (TTF registado) para acentos e identidade.
- Ilustrações desenhadas em vetor no próprio PDF (sem imagens raster pesadas); marca Akuris do `src/assets`.
- Recomendação derivada de regra pura testada em `avaliacao-regras.ts` (nota + lacunas críticas + evidências), com teste.
- Textos PT/EN via rótulos existentes; nenhuma mudança de base de dados.
