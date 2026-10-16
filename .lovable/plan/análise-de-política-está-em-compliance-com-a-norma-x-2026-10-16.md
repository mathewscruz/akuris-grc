# Análise de política: "Está em compliance com a norma X?"

## Mudança principal de abordagem
Hoje a política é comparada com todos os requisitos do framework (ex.: 121 da ISO 27001). Uma política de Mesa Limpa nunca passa, porque não trata de backup, fornecedores etc. — o resultado parece ruim e não ajuda.

Novo fluxo, respondendo uma pergunta só: **"De acordo com a [norma do framework aberto], esta política está em compliance?"**

1. **Entender a política** — a IA identifica o tipo e o tema (ex.: "Política de Controle de Acesso").
2. **Escolher só os requisitos que se aplicam** — a mesma lógica de tema já usada no DocGen seleciona os requisitos da norma que uma política desse tema deve cobrir. O usuário vê a lista e pode adicionar ou remover antes de confirmar.
3. **Avaliar só esses requisitos** contra o documento inteiro (mantém o processamento em segundo plano que acabamos de fazer).
4. **Interpretar e apresentar o resultado** em linguagem de consultor.

## Como o resultado aparece
- **Veredito no topo**: "Em compliance", "Em compliance com ressalvas" ou "Não está em compliance", com uma frase explicando o porquê e a nota daquele escopo.
- **O que precisa fazer**: lista priorizada (alta/média/baixa) de ajustes concretos, ex.: "Incluir prazo de revisão anual de acessos (exigido em 5.18)". Cada item mostra o requisito da norma e o trecho que falta.
- **O que já está bom**: pontos fortes com a citação literal da política.
- **Detalhe por requisito** (recolhido): situação, trecho citado, o que falta.
- **Fora do escopo desta política**: requisitos da norma que essa política não precisa cobrir, só informativos e sem penalizar a nota.

## Melhorias de experiência para a análise ficar completa
- **Ações de um clique** a partir do resultado:
  - "Criar plano de ação" para cada ponto de melhoria (já ligado ao requisito, com prazo sugerido pela prioridade).
  - "Usar como evidência" — liga o documento aos requisitos aprovados no Gap Analysis do framework.
  - "Corrigir com o DocGen" — abre o DocGen com a política e a lista de ajustes para gerar a versão revisada.
- **Nova versão, mesma análise**: enviar a versão revisada compara com a anterior ("3 pontos resolvidos, 1 ainda pendente").
- **Exportar PDF** do parecer (veredito, ações, evidências), no padrão visual dos relatórios do Akuris.
- **Aviso de qualidade do arquivo**: se o PDF for escaneado/sem texto legível, avisar antes de gastar crédito.

## Detalhes técnicos
- Edge function `analyze-document-adherence`: nova etapa inicial "classificando" (1 chamada curta com o início e os títulos do documento) → `resolveDocumentScope` passa a valer também para uploads (hoje só DocGen); o usuário confirma o escopo antes da avaliação (job fica em `aguardando_escopo`).
- Etapa final "interpretando": 1 chamada que recebe os resultados por requisito e devolve veredito, resumo e ações priorizadas (JSON com schema estrito). Nota continua determinística (`computeAnalyzedScore`) sobre o escopo; veredito: >= 80 sem não conformes críticos = em compliance; >= 60 = com ressalvas; abaixo = não está.
- Novos campos em `metadados_analise`: `veredito`, `escopo_ids`, `fora_escopo_ids`, `acoes[]`, `versao_anterior_id`.
- Criar plano de ação reusa `planos_acao` + `preenchimento-inteligente`; evidência reusa `evidence_library_links`; tudo com `empresa_id`.
- Tela de resultado reformulada com StatStrip, StatusBadge e Chip; textos PT/EN; testes do cálculo do veredito e da seleção de escopo.
- Crédito continua 1 por análise (classificação e interpretação incluídas).
