-- Uma denúncia que nasce fechada tem de nascer com data de fecho.
--
-- `criar_denuncia_manual` aceita `p_status` e o formulário de nova denúncia
-- permite escolher "resolvida" ou "arquivada" logo à criação. A função nunca
-- escrevia `data_conclusao`, e o diálogo de edição só a escreve na TRANSIÇÃO de
-- estado — portanto quem nasce resolvida nunca a tem.
--
-- O efeito: o relatório de Denúncias exportava "Taxa de Resolução 0,0%" e
-- "Tempo Médio 0,0 dias" ao lado de um gráfico que contava as mesmas denúncias
-- como resolvidas. Três resolvidas ou arquivadas na base, zero com data.
--
-- Um gatilho resolve os dois sentidos de uma vez, e não só o caminho do RPC:
-- qualquer escrita que ponha a denúncia num estado terminal sem data carimba-a;
-- qualquer escrita que a tire de lá limpa-a. Assim a coluna deixa de depender
-- de quem escreve.

CREATE OR REPLACE FUNCTION public.denuncia_carimba_conclusao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('resolvida', 'arquivada') THEN
    IF NEW.data_conclusao IS NULL THEN
      NEW.data_conclusao := CURRENT_DATE;
    END IF;
  ELSE
    -- Reabrir uma denúncia apaga a data: uma denúncia aberta com data de
    -- conclusão faria o tempo médio contar um ciclo que não terminou.
    NEW.data_conclusao := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS denuncia_carimba_conclusao ON public.denuncias;
CREATE TRIGGER denuncia_carimba_conclusao
  BEFORE INSERT OR UPDATE OF status, data_conclusao ON public.denuncias
  FOR EACH ROW
  EXECUTE FUNCTION public.denuncia_carimba_conclusao();

-- As que já estão fechadas sem data: `updated_at` é o momento mais próximo do
-- fecho que existe registado.
UPDATE public.denuncias
   SET data_conclusao = COALESCE(updated_at::date, created_at::date)
 WHERE status IN ('resolvida', 'arquivada')
   AND data_conclusao IS NULL;
