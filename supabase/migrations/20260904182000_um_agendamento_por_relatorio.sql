-- A interface trabalha com um agendamento vigente por relatório. Normaliza
-- dados antigos antes de transformar essa regra em garantia do banco.
DELETE FROM public.relatorio_agendamentos antigo
 USING public.relatorio_agendamentos recente
 WHERE antigo.relatorio_id = recente.relatorio_id
   AND antigo.created_at < recente.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_relatorio_agendamento_unico
  ON public.relatorio_agendamentos(relatorio_id);
