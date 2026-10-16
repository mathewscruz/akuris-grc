# Análise de conformidade sem limite de tamanho

## Situação atual (verificada)
- A análise roda numa única chamada que fica aberta até terminar; documentos grandes + frameworks grandes (ISO 27001, 121 requisitos) estouram o tempo.
- Só os primeiros 30.000 caracteres do documento são lidos — o resto é ignorado em silêncio.
- Existe um teto de requisitos por análise; os excedentes não são avaliados.

## O que muda para o usuário
- Ao clicar em analisar, a análise começa e a tela mostra progresso real ("Lendo documento 3/8", "Avaliando requisitos 50/121").
- Pode fechar a janela: a análise continua e o sino avisa quando terminar.
- Documento inteiro e todos os requisitos são avaliados, de qualquer tamanho.
- Se uma parte falhar, só ela é refeita; botão "Tentar novamente" retoma de onde parou.
- Crédito de IA descontado uma única vez, só quando a análise conclui.

## Como funciona
```text
Upload -> cria "trabalho de análise" -> resposta imediata
   etapa 1: documento dividido em trechos; cada trecho vira um resumo de evidências
   etapa 2: requisitos em lotes de 25 avaliados contra os resumos
   etapa 3: junta resultados, calcula escore, grava, notifica no sino
Tela acompanha o progresso a cada 3s
```

## Detalhes técnicos
- Nova tabela `analise_aderencia_jobs` (empresa_id, framework_id, documento, status, etapa, progresso, total, resultados parciais jsonb, erro, idempotency_key, locked_until), RLS por empresa_id (membros leem; escrita só service_role).
- `analyze-document-adherence` passa a: validar, criar o job, devolver `job_id`, e processar em fatias curtas (~1 trecho ou 1 lote por invocação), salvando progresso a cada passo e reinvocando a si mesma com token interno até concluir. Nenhuma invocação passa de ~60s.
- Trechos do documento: ~12k caracteres com sobreposição; resumos de evidências por trecho (map), depois avaliação por lote de requisitos contra os resumos (reduce). Remove o corte de 30k e o teto de requisitos.
- Reaproveita `lotes.ts` (retry só em 429/5xx com backoff; 402/403 pausam o job com mensagem).
- Lock por job (`locked_until`) evita processamento duplo; job travado >5 min é retomado pelo `pg_cron` existente.
- Crédito: `consume_ai_credit_idempotente` com a chave do job, só na conclusão.
- `AdherenceAssessmentDialog.tsx`: inicia o job, faz polling do status, mostra AkurisPulse + barra/etapas, permite fechar; resultado final abre o mesmo relatório atual. Textos PT/EN.
- Testes Deno: divisão em trechos, retomada após falha, idempotência do crédito, conclusão parcial.
