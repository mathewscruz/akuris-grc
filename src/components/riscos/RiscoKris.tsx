import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateField } from '@/components/ui/date-field';
import { DialogShell } from '@/components/ui/dialog-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconActivity, IconAdd, IconGauge, IconWarning } from '@/components/icons';
import { toast } from '@/lib/toast';
import { formatDateOnly } from '@/lib/date-utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface Kri {
  id: string;
  nome: string;
  descricao: string | null;
  unidade: string | null;
  direcao: 'maximo' | 'minimo';
  limite: number;
  valor_atual: number | null;
  periodicidade: string;
  proxima_medicao: string | null;
  ultima_medicao_em: string | null;
}

function emAlerta(kri: Kri): boolean {
  if (kri.valor_atual == null) return false;
  return kri.direcao === 'maximo'
    ? kri.valor_atual > kri.limite
    : kri.valor_atual < kri.limite;
}

export function RiscoKris({ riscoId }: { riscoId: string }) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { canCreate, canUpdate } = usePermissions();
  const queryClient = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [medicaoKri, setMedicaoKri] = useState<Kri | null>(null);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [unidade, setUnidade] = useState('');
  const [direcao, setDirecao] = useState<'maximo' | 'minimo'>('maximo');
  const [limite, setLimite] = useState('');
  const [periodicidade, setPeriodicidade] = useState('mensal');
  const [proximaMedicao, setProximaMedicao] = useState('');
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');

  const queryKey = ['risco-kris', riscoId];
  const { data: kris = [], isLoading, isError, refetch } = useQuery<Kri[]>({
    queryKey,
    enabled: !!riscoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('riscos_kris')
        .select('id, nome, descricao, unidade, direcao, limite, valor_atual, periodicidade, proxima_medicao, ultima_medicao_em')
        .eq('risco_id', riscoId)
        .eq('ativo', true)
        .order('created_at');
      if (error) throw error;
      return (data || []) as Kri[];
    },
  });

  const criar = async () => {
    if (!profile?.empresa_id || !nome.trim() || !limite || !Number.isFinite(Number(limite))) {
      toast.error(t('riscosDetalhe.kri.validationCreate'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('riscos_kris').insert({
        empresa_id: profile.empresa_id,
        risco_id: riscoId,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        unidade: unidade.trim() || null,
        direcao,
        limite: Number(limite),
        periodicidade,
        proxima_medicao: proximaMedicao || null,
        created_by: profile.user_id,
      });
      if (error) throw error;
      setNovoOpen(false);
      setNome(''); setDescricao(''); setUnidade(''); setLimite(''); setProximaMedicao('');
      await queryClient.invalidateQueries({ queryKey });
      toast.success(t('riscosDetalhe.kri.created'));
    } catch (error: any) {
      toast.error(t('riscosDetalhe.kri.createError', { mensagem: error.message }));
    } finally {
      setSaving(false);
    }
  };

  const medir = async () => {
    if (!profile?.empresa_id || !medicaoKri || valor === '' || !Number.isFinite(Number(valor))) {
      toast.error(t('riscosDetalhe.kri.validationMeasure'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('riscos_kri_medicoes').insert({
        kri_id: medicaoKri.id,
        empresa_id: profile.empresa_id,
        valor: Number(valor),
        observacao: observacao.trim() || null,
        medido_por: profile.user_id,
      });
      if (error) throw error;
      setMedicaoKri(null); setValor(''); setObservacao('');
      await queryClient.invalidateQueries({ queryKey });
      toast.success(t('riscosDetalhe.kri.measureSuccess'));
    } catch (error: any) {
      toast.error(t('riscosDetalhe.kri.measureError', { mensagem: error.message }));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-10"><AkurisPulse size={30} /></div>;
  if (isError) return (
    <div className="space-y-3 py-8 text-center">
      <p className="text-sm text-destructive">{t('riscosDetalhe.kri.loadError')}</p>
      <Button variant="outline" size="sm" onClick={() => refetch()}>{t('riscosDetalhe.kri.retry')}</Button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-muted-foreground">{t('riscosDetalhe.kri.title')}</div>
          <p className="mt-1 text-micro text-muted-foreground">{t('riscosDetalhe.kri.intro')}</p>
        </div>
        {canCreate('riscos') && <Button size="sm" variant="outline" onClick={() => setNovoOpen(true)}>
          <IconAdd className="mr-1.5 h-3.5 w-3.5" /> {t('riscosDetalhe.kri.new')}
        </Button>}
      </div>

      {kris.length === 0 ? (
        <EmptyState
          icon={<IconGauge className="h-8 w-8" />}
          title={t('riscosDetalhe.kri.emptyTitle')}
          description={t('riscosDetalhe.kri.emptyDescription')}
          action={canCreate('riscos') ? { label: t('riscosDetalhe.kri.emptyAction'), onClick: () => setNovoOpen(true) } : undefined}
        />
      ) : kris.map((kri) => {
        const alerta = emAlerta(kri);
        return (
          <div key={kri.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{kri.nome}</span>
                  <StatusBadge tone={kri.valor_atual == null ? 'neutral' : alerta ? 'destructive' : 'success'}>
                    {kri.valor_atual == null ? t('riscosDetalhe.kri.noMeasurement') : alerta ? t('riscosDetalhe.kri.exceeded') : t('riscosDetalhe.kri.withinLimit')}
                  </StatusBadge>
                </div>
                {kri.descricao && <p className="mt-1 text-xs text-muted-foreground">{kri.descricao}</p>}
              </div>
              {canUpdate('riscos') && <Button size="sm" variant="outline" onClick={() => setMedicaoKri(kri)}>{t('riscosDetalhe.kri.register')}</Button>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-muted-foreground">{t('riscosDetalhe.kri.current')}</span><div className="mt-0.5 font-semibold tabular-nums">{kri.valor_atual ?? '—'} {kri.unidade || ''}</div></div>
              <div><span className="text-muted-foreground">{t('riscosDetalhe.kri.limit')}</span><div className="mt-0.5 font-semibold tabular-nums">{kri.direcao === 'maximo' ? '≤' : '≥'} {kri.limite} {kri.unidade || ''}</div></div>
              <div><span className="text-muted-foreground">{t('riscosDetalhe.kri.next')}</span><div className="mt-0.5 font-semibold">{kri.proxima_medicao ? formatDateOnly(kri.proxima_medicao) : t('riscosDetalhe.kri.notDefined')}</div></div>
            </div>
          </div>
        );
      })}

      <DialogShell
        open={novoOpen}
        onOpenChange={setNovoOpen}
        icon={IconActivity}
        title={t('riscosDetalhe.kri.newTitle')}
        description={t('riscosDetalhe.kri.newDescription')}
        size="sm"
        onSubmit={criar}
        submitLabel={t('riscosDetalhe.kri.create')}
        isSubmitting={saving}
        isDirty={!!(nome || descricao || unidade || limite || proximaMedicao)}
      >
        <div className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="kri-nome">{t('riscosDetalhe.kri.name')} *</Label><Input id="kri-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t('riscosDetalhe.kri.namePlaceholder')} /></div>
          <div className="space-y-1.5"><Label htmlFor="kri-desc">{t('riscosDetalhe.kri.description')}</Label><Textarea id="kri-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={t('riscosDetalhe.kri.descriptionPlaceholder')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="kri-limite">{t('riscosDetalhe.kri.limit')} *</Label><Input id="kri-limite" type="number" min={-999999999} step="any" value={limite} onChange={(e) => setLimite(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="kri-unidade">{t('riscosDetalhe.kri.unit')}</Label><Input id="kri-unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder={t('riscosDetalhe.kri.unitPlaceholder')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('riscosDetalhe.kri.rule')}</Label><Select value={direcao} onValueChange={(v) => setDirecao(v as 'maximo' | 'minimo')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="maximo">{t('riscosDetalhe.kri.alertAbove')}</SelectItem><SelectItem value="minimo">{t('riscosDetalhe.kri.alertBelow')}</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>{t('riscosDetalhe.kri.frequency')}</Label><Select value={periodicidade} onValueChange={setPeriodicidade}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['semanal','mensal','trimestral','semestral','anual'] as const).map((v) => <SelectItem key={v} value={v}>{t(`riscosDetalhe.kri.frequencies.${v}`)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label>{t('riscosDetalhe.kri.nextMeasurement')}</Label><DateField value={proximaMedicao || null} onChange={(v) => setProximaMedicao(v || '')} /></div>
        </div>
      </DialogShell>

      <DialogShell
        open={!!medicaoKri}
        onOpenChange={(open) => !open && setMedicaoKri(null)}
        icon={IconGauge}
        title={t('riscosDetalhe.kri.registerMeasurement')}
        description={medicaoKri?.nome}
        size="sm"
        onSubmit={medir}
        submitLabel={t('riscosDetalhe.kri.registerMeasurement')}
        isSubmitting={saving}
        isDirty={!!(valor || observacao)}
      >
        <div className="space-y-4">
          {medicaoKri && <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground"><IconWarning className="mt-0.5 h-4 w-4 shrink-0" />{t('riscosDetalhe.kri.expectedLimit', { regra: medicaoKri.direcao === 'maximo' ? t('riscosDetalhe.kri.upTo') : t('riscosDetalhe.kri.atLeast'), limite: medicaoKri.limite, unidade: medicaoKri.unidade || '' })}</div>}
          <div className="space-y-1.5"><Label htmlFor="kri-valor">{t('riscosDetalhe.kri.measuredValue')} *</Label><Input id="kri-valor" type="number" min={-999999999} step="any" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus /></div>
          <div className="space-y-1.5"><Label htmlFor="kri-obs">{t('riscosDetalhe.kri.evidence')}</Label><Textarea id="kri-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder={t('riscosDetalhe.kri.evidencePlaceholder')} /></div>
        </div>
      </DialogShell>
    </div>
  );
}
