-- Toda empresa tem de ter matriz de risco configurada.
--
-- A Akuris e a CyberMe mostram permanentemente "Matriz de risco não
-- configurada" no ecrã de Riscos, e a VITRU não tem sequer a matriz. Sem
-- configuração, `apetiteScoreFromNiveis` devolve `null`, o mapa de calor não
-- tem faixas para pintar e "Acima do apetite" fica preso em zero — três
-- funcionalidades desligadas por uma linha em falta.
--
-- A migration `20260806130000_riscos_matriz_padrao.sql` devia ter provisionado
-- isto. Ou correu antes destas empresas existirem, ou falhou em silêncio: em
-- qualquer dos casos, o provisionamento não estava garantido. Este backfill é
-- idempotente e pode voltar a correr sempre que aparecerem empresas novas.

-- ── 1. Matriz por empresa ──────────────────────────────────────────────────
INSERT INTO public.riscos_matrizes (empresa_id, nome, descricao)
SELECT e.id, 'Matriz padrão', 'Matriz 5x5 provisionada automaticamente'
  FROM public.empresas e
 WHERE NOT EXISTS (SELECT 1 FROM public.riscos_matrizes m WHERE m.empresa_id = e.id);

-- ── 2. Configuração por matriz ─────────────────────────────────────────────
--
-- Escalas 5x5 e as quatro faixas — as mesmas que as empresas provisionadas
-- correctamente já têm, para que a leitura de severidade seja comparável entre
-- empresas que nunca personalizaram a sua matriz.
INSERT INTO public.riscos_matriz_configuracao
  (matriz_id, escala_probabilidade, escala_impacto, niveis_risco, metodo_calculo)
SELECT m.id,
  '[{"valor": "1", "descricao": "Rara"}, {"valor": "2", "descricao": "Baixa"}, {"valor": "3", "descricao": "Ocasional"}, {"valor": "4", "descricao": "Provável"}, {"valor": "5", "descricao": "Muito Provável"}]'::jsonb,
  '[{"valor": "1", "descricao": "Insignificante"}, {"valor": "2", "descricao": "Leve"}, {"valor": "3", "descricao": "Médio"}, {"valor": "4", "descricao": "Grave"}, {"valor": "5", "descricao": "Catastrófico"}]'::jsonb,
  '[{"cor": "#22c55e", "max": 4, "min": 1, "nivel": "Baixo", "apetite": false}, {"cor": "#eab308", "max": 9, "min": 5, "nivel": "Médio", "apetite": false}, {"cor": "#f97316", "max": 16, "min": 10, "nivel": "Alto", "apetite": true}, {"cor": "#dc2626", "max": 25, "min": 17, "nivel": "Crítico", "apetite": false}]'::jsonb,
  'multiplicacao'
  FROM public.riscos_matrizes m
 WHERE NOT EXISTS (
   SELECT 1 FROM public.riscos_matriz_configuracao c WHERE c.matriz_id = m.id
 );
