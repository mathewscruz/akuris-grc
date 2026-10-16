import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';

/** Nome de quem enviou cada análise — só perfis da mesma empresa. */
export function useAutoresDaEmpresa(empresaId: string | null | undefined, analises: { created_by?: string | null }[]) {
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const ids = Array.from(new Set(analises.map(a => a.created_by).filter(Boolean) as string[])).sort();
  const chave = ids.join(',');
  useEffect(() => {
    if (!empresaId || !ids.length) return;
    let vivo = true;
    supabase.from('profiles').select('user_id, nome').eq('empresa_id', empresaId).in('user_id', ids)
      .then(({ data, error }) => {
        if (error) { logger.warn('Autores das análises indisponíveis', { error: error.message }); return; }
        if (vivo) setNomes(Object.fromEntries((data ?? []).map((p: any) => [p.user_id, p.nome || ''])));
      });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, chave]);
  return nomes;
}

/** Abre o arquivo analisado com link temporário (a pasta começa pelo empresa_id). */
export async function abrirDocumentoAnalisado(analise: any, t: (k: string) => string) {
  const caminho = analise?.metadados_analise?.arquivo_storage as string | undefined;
  if (!caminho) return;
  const janela = window.open('', '_blank');
  const { data, error } = await supabase.storage.from('adherence-documents').createSignedUrl(caminho, 300);
  if (error || !data?.signedUrl) {
    janela?.close();
    logger.error('Falha ao abrir documento analisado', { error: error?.message });
    toast.error(t('gapAnalysis.adherenceUi.view.openDocumentError'));
    return;
  }
  if (janela) janela.location.href = data.signedUrl; else window.location.href = data.signedUrl;
}
