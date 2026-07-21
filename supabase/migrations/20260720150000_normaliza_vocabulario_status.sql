-- Normaliza vocabulário legado com grafias divergentes que causavam contadores
-- errados e labels inconsistentes. Idempotente: cada UPDATE só toca linhas que
-- estão fora do padrão canônico usado pelos formulários.
--
-- Escopo deliberado: NÃO altera dados_pessoais.sensibilidade (já canônico:
-- comum/sensivel/muito_sensivel) nem tipo_dados (uso ambíguo). Também não toca
-- em probabilidade/impacto dos riscos (que usam gênero feminino legítimo:
-- media/alta/baixa) — apenas as colunas de NÍVEL do risco (masculino).

-- Riscos: nível deve ser minúsculo e sem acento (critico/alto/medio/baixo).
-- Ex.: "Médio" -> "medio", "Baixo" -> "baixo", "Crítico" -> "critico".
UPDATE public.riscos
SET nivel_risco_inicial = translate(lower(nivel_risco_inicial),
      'áàâãéèêíìîóòôõúùûç', 'aaaaeeeiiioooouuuc')
WHERE nivel_risco_inicial IS NOT NULL
  AND nivel_risco_inicial <> translate(lower(nivel_risco_inicial),
      'áàâãéèêíìîóòôõúùûç', 'aaaaeeeiiioooouuuc');

UPDATE public.riscos
SET nivel_risco_residual = translate(lower(nivel_risco_residual),
      'áàâãéèêíìîóòôõúùûç', 'aaaaeeeiiioooouuuc')
WHERE nivel_risco_residual IS NOT NULL
  AND nivel_risco_residual <> translate(lower(nivel_risco_residual),
      'áàâãéèêíìîóòôõúùûç', 'aaaaeeeiiioooouuuc');

-- Auditorias: 'em_execucao' não existe no formulário; canônico é 'em_andamento'.
UPDATE public.auditorias
SET status = 'em_andamento'
WHERE status = 'em_execucao';

-- Sistemas privilegiados: o formulário usa 'critica'; dado legado tem 'critico'.
UPDATE public.sistemas_privilegiados
SET criticidade = 'critica'
WHERE criticidade = 'critico';
