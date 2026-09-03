/**
 * VincularRequisitoControleDialog — liga um controlo interno a requisitos de
 * qualquer framework activo do Gap Analysis (ISO 27001, SOC 2, …), N para N.
 */
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DialogShell } from '@/components/ui/dialog-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveConformityTone } from '@/lib/status-tone';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { toast } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRequisitosDisponiveis, type RequisitoOpcao } from '@/hooks/useRiscoRequisitos';
import { useControleRequisitos, useSalvarControleRequisitos } from '@/hooks/useControleRequisitos';
import { cn } from '@/lib/utils';
import { IconSearch, IconShieldCheck, IconLink } from '@/components/icons';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controleId: string;
  controleNome: string;
  onSuccess?: () => void;
}

const STATUS_KEY: Record<string, string> = {
  conforme: 'gapUi.status.conforme',
  parcial: 'gapUi.status.parcial',
  nao_conforme: 'gapUi.status.naoConforme',
  nao_aplicavel: 'gapUi.status.na',
  nao_avaliado: 'gapUi.status.naoAvaliado',
};

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function VincularRequisitoControleDialog({ open, onOpenChange, controleId, controleNome, onSuccess }: Props) {
  const { t } = useLanguage();

  const { data: requisitos = [], isLoading } = useRequisitosDisponiveis(open);
  const { data: ligados = [] } = useControleRequisitos(open ? controleId : null);
  const salvar = useSalvarControleRequisitos(controleId);

  const [busca, setBusca] = useState('');
  const [frameworkFiltro, setFrameworkFiltro] = useState<string>('todos');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelecionados(new Set(ligados.map((v) => v.requirement_id)));
  }, [open, ligados]);

  const frameworks = useMemo(() => {
    const m = new Map<string, string>();
    requisitos.forEach((r) => m.set(r.framework_id, r.framework_nome));
    return Array.from(m, ([id, nome]) => ({ id, nome }));
  }, [requisitos]);

  const filtrados = useMemo(() => {
    const q = norm(busca.trim());
    return requisitos.filter((r) => {
      if (frameworkFiltro !== 'todos' && r.framework_id !== frameworkFiltro) return false;
      if (!q) return true;
      return norm(`${r.codigo} ${r.titulo} ${r.categoria}`).includes(q);
    });
  }, [requisitos, busca, frameworkFiltro]);

  const grupos = useMemo(() => {
    const byFw = new Map<string, Map<string, RequisitoOpcao[]>>();
    filtrados.forEach((r) => {
      const secs = byFw.get(r.framework_nome) || new Map<string, RequisitoOpcao[]>();
      const list = secs.get(r.categoria || '—') || [];
      list.push(r);
      secs.set(r.categoria || '—', list);
      byFw.set(r.framework_nome, secs);
    });
    return Array.from(byFw, ([fw, secs]) => ({
      framework: fw,
      seccoes: Array.from(secs, ([sec, itens]) => ({ sec, itens })),
    }));
  }, [filtrados]);

  const toggle = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    const byId = new Map(requisitos.map((r) => [r.id, r]));
    const payload = Array.from(selecionados)
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((r) => ({ requirement_id: r!.id, framework_id: r!.framework_id }));
    try {
      await salvar.mutateAsync(payload);
      toast.success(t('vinculoReq.sucessoTitulo'), {
        description: t('vinculoReq.sucessoDesc', { count: payload.length }),
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(t('vinculoReq.erroTitulo'), { description: e?.message || t('vinculoReq.erroDesc') });
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconLink}
      title={t('vinculoReq.tituloControlo')}
      description={controleNome}
      size="lg"
      submitLabel={t('vinculoReq.salvar')}
      isSubmitting={salvar.isPending}
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <IconShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
        {t('vinculoReq.selecionados', { count: selecionados.size })}
      </div>

      <div className="relative mb-3">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={t('vinculoReq.buscar')}
          className="pl-9"
        />
      </div>

      {frameworks.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Button
            type="button"
            size="sm"
            variant={frameworkFiltro === 'todos' ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setFrameworkFiltro('todos')}
          >
            {t('vinculoReq.todosFrameworks')}
          </Button>
          {frameworks.map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={frameworkFiltro === f.id ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setFrameworkFiltro(f.id)}
            >
              {f.nome}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><AkurisPulse size={40} /></div>
      ) : filtrados.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {requisitos.length === 0 ? t('vinculoReq.semFrameworks') : t('vinculoReq.semResultados')}
        </div>
      ) : (
        <div className="space-y-5 max-h-[52vh] overflow-y-auto pr-1">
          {grupos.map((g) => (
            <div key={g.framework}>
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                {g.framework}
              </div>
              <div className="space-y-3">
                {g.seccoes.map((s) => (
                  <div key={s.sec}>
                    <div className="text-micro text-muted-foreground mb-1">{s.sec}</div>
                    <div className="space-y-1">
                      {s.itens.map((r) => {
                        const checked = selecionados.has(r.id);
                        return (
                          <label
                            key={r.id}
                            className={cn(
                              'flex items-start gap-3 rounded-lg border border-border p-2.5 cursor-pointer transition-colors',
                              checked ? 'bg-primary/5 border-primary/40' : 'hover:bg-accent',
                            )}
                          >
                            <Checkbox checked={checked} onCheckedChange={() => toggle(r.id)} className="mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {r.codigo && (
                                  <span className="font-mono text-micro text-muted-foreground">{r.codigo}</span>
                                )}
                                <span className="text-sm font-medium">{r.titulo}</span>
                              </div>
                            </div>
                            <StatusBadge {...resolveConformityTone(r.conformity_status)}>
                              {t(STATUS_KEY[r.conformity_status] || STATUS_KEY.nao_avaliado)}
                            </StatusBadge>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </DialogShell>
  );
}
