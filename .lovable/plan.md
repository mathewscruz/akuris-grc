# Relatório de avaliação do fornecedor — novo visual e conteúdo

## O que o relatório atual tem de fraco (visto no PDF anexado)
- Capa mistura idiomas ("Generated on" num relatório em português).
- Resumo é só um número (81%) sem dizer o que ele significa: não há classificação (ex.: risco baixo/médio/alto), nem decisão recomendada.
- Leitura da IA aparece reduzida a uma frase ("Fornecedor com controles maduros."), mesmo quando a avaliação tem leitura por seção e lista do que pedir ao fornecedor.
- As 6 páginas de respostas são uma lista corrida: sem agrupar por seção, "nota: 30" sem dizer de quanto, e "sem comprovativo anexado" repetido em todas as linhas.
- Contradição não sinalizada: score 81% e "controles maduros", mas Backup, Teste de Backup, Segmentação de Rede, Contratos com Terceiros falharam e nenhuma resposta tem comprovativo.
- Não há dados do fornecedor (CNPJ, contato, criticidade), nem campo de decisão/assinatura.

## Nova estrutura do relatório

```text
1. Capa            fornecedor, CNPJ, questionário, datas, nº da avaliação
2. Sumário executivo
   - Score grande + faixa de classificação (cores da severidade Akuris)
   - Indicadores: respostas, % com comprovativo, nº de lacunas críticas,
     prazo de resposta (enviado → concluído), validade da avaliação
   - "Pontos que exigem ação" (top 5 lacunas, piores primeiro)
   - Alerta automático quando score alto convive com lacunas críticas
     ou zero comprovativos ("score não comprovado por evidência")
3. Mapa por seção    barras + nº de perguntas e de lacunas por seção
4. Lacunas e plano   tabela: requisito · resposta · seção · peso · o que pedir
5. Leitura da IA     rotulada como interpretação: nível, confiança, resumo,
                     fortes, atenção, evidências em falta, recomendações e
                     leitura por seção (hoje omitida)
6. Respostas detalhadas  agrupadas por seção, em tabela:
                     pergunta · resposta (chip Sim/Não/Parcial) · nota/máx
                     · comprovativo (sim/não) · observação do fornecedor
7. Decisão e aprovação  status, decisão (Aprovado / Aprovado com ressalvas /
                     Reprovado), responsável, data, campo de assinatura
8. Metodologia      como o score é calculado (média ponderada, N/A fora)
```
Visual: identidade Akuris (navy/roxo só em títulos e ação, severidade com as cores próprias), tabelas compactas, cabeçalho e rodapé consistentes, tudo em PT ou EN conforme o idioma do usuário.

## Outras melhorias no Due Diligence (propostas, escolha quais entram)
1. **Decisão formal da avaliação**: botão Aprovar / Aprovar com ressalvas / Reprovar com justificativa, registrada e impressa no relatório.
2. **Pedir evidências ao fornecedor** a partir das lacunas: um clique reabre só as perguntas fracas e envia o link, com aviso no sino quando ele responde.
3. **Score ajustado por evidência**: mostrar, ao lado do score, quanto dele está comprovado por anexo.
4. **Lacunas viram plano de ação** no hub de Planos de Ação, ligadas ao fornecedor.
5. **Reavaliação periódica** pela criticidade do fornecedor (ex.: alta = anual), com lembrete no sino.
6. **Histórico/tendência**: comparar com a avaliação anterior no relatório ("Backup piorou desde 2025").

## Detalhes técnicos
- Reescrever `src/components/due-diligence/relatorio-fornecedor.ts` (jsPDF, helpers de `@/lib/pdf-utils`); corrigir rótulo da capa passando idioma a `addAkurisCover`.
- `gerarRelatorio` em `AssessmentsManagerEnhanced.tsx` passa a buscar também: seção, peso máximo e opções da pergunta, observação/justificativa da resposta, dados de `due_diligence_fornecedores` (CNPJ, criticidade) — todas as consultas com `.eq('empresa_id', empresaId)`.
- Nota máxima por pergunta = peso da pergunta; "lacuna" = nota 0 ou abaixo de 50% do peso.
- `ParecerDaIA.secoes[].oQuePedir` passa a ser renderizado na seção 4.
- Novas chaves PT/EN em `dueDiligence.relatorio.*`.
- Teste unitário das regras: classificação por faixa, detecção de lacuna e alerta "score alto sem evidência".
- Melhorias 1–6 só após sua escolha; 1 e 2 exigiriam colunas novas em `due_diligence_assessments` (decisão, justificativa, decidido_por, decidido_em).
