import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { IconDownload, IconRefresh } from '@/components/icons';

type Provisionado = { meshId: string; links: { windows: string; macos: string; linuxComando: string }; ultimaSincronizacao: string | null };

export default function AgenteInventarioDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, locale } = useLanguage();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const qc = useQueryClient();
  const [ativando, setAtivando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [dados, setDados] = useState<Provisionado | null>(null);

  const grupo = useQuery({
    queryKey: ['mesh-grupo', empresaId],
    enabled: open && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from('mesh_grupos' as any).select('mesh_id, ultima_sincronizacao').eq('empresa_id', empresaId).maybeSingle();
      if (error) throw error;
      return data as unknown as { mesh_id: string; ultima_sincronizacao: string | null } | null;
    },
  });

  const erros = { 403: t('agenteInventario.apenasAdmin'), 503: t('agenteInventario.naoConfigurado'), 502: t('agenteInventario.indisponivel') };

  const provisionar = async () => {
    setAtivando(true);
    const { data } = await invokeEdgeFunction<Provisionado>('mesh-provisionar', { errorMessages: erros });
    setAtivando(false);
    if (data) { setDados(data); qc.invalidateQueries({ queryKey: ['mesh-grupo', empresaId] }); }
  };

  const sincronizar = async () => {
    setSincronizando(true);
    const { data } = await invokeEdgeFunction<{ sincronizados: number }>('mesh-sincronizar', { errorMessages: erros });
    setSincronizando(false);
    if (data) {
      toast.success(t('agenteInventario.sincronizado', { n: data.sincronizados }));
      qc.invalidateQueries({ queryKey: ['mesh-grupo', empresaId] });
      qc.invalidateQueries({ queryKey: ['ativos'] });
    }
  };

  const ativo = !!grupo.data || !!dados;
  const ultima = grupo.data?.ultima_sincronizacao ?? dados?.ultimaSincronizacao;

  return (
    <DialogShell open={open} onOpenChange={onOpenChange} title={t('agenteInventario.titulo')} description={t('agenteInventario.descricao')} size="md"
      footer={<Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>}>
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">{t('agenteInventario.somenteInventario')}</p>
        {!ativo ? (
          <Button onClick={provisionar} loading={ativando}>{ativando ? t('agenteInventario.ativando') : t('agenteInventario.ativar')}</Button>
        ) : !dados ? (
          <Button onClick={provisionar} loading={ativando} variant="secondary"><IconDownload className="mr-2 h-4 w-4" />{t('agenteInventario.windows')} / macOS / Linux</Button>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button asChild><a href={dados.links.windows} rel="noopener"><IconDownload className="mr-2 h-4 w-4" />{t('agenteInventario.windows')}</a></Button>
              <Button asChild variant="outline"><a href={dados.links.macos} rel="noopener"><IconDownload className="mr-2 h-4 w-4" />{t('agenteInventario.macos')}</a></Button>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{t('agenteInventario.linux')}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs" title={dados.links.linuxComando}>{dados.links.linuxComando}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(dados.links.linuxComando); toast.success(t('agenteInventario.copiado')); }}>{t('agenteInventario.copiar')}</Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('agenteInventario.silencioso')}</p>
          </div>
        )}
        {ativo && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">{ultima ? t('agenteInventario.ultima', { data: new Date(ultima).toLocaleString(locale) }) : t('agenteInventario.nunca')}</span>
            <Button size="sm" variant="outline" onClick={sincronizar} loading={sincronizando}><IconRefresh className="mr-2 h-4 w-4" />{t('agenteInventario.sincronizar')}</Button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
