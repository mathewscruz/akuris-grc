import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { IconChecklist, IconDownload, IconSuccess } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import { exportCSV, spreadsheetText } from '@/lib/csv-utils';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { compareReviewRows, nextReviewSort, type ReviewSort } from '@/lib/access-review-sort';
import { readAllPages } from '@/lib/read-all-pages';
import { useReviewData } from '@/hooks/useReviewData';
import { supabase } from '@/integrations/supabase/client';
import { ReviewItemDecisionDialog } from './ReviewItemDecisionDialog';
import ConfirmDialog from '@/components/ConfirmDialog';

interface ReviewItemsDialogProps {
  open: boolean; onClose: () => void; review: any; onSuccess: () => void;
}
export function ReviewItemsDialog({ open, onClose, review, onSuccess }: ReviewItemsDialogProps) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const { finalizeReview } = useReviewData();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [sort, setSort] = useState<ReviewSort | null>(null);
  useEffect(() => { setSelectedItem(null); setSearchTerm(''); setConfirm(false); setSort(null); }, [review?.id, empresaId]);

  const campaignQuery = useQuery({
    queryKey: ['review-detail', empresaId, review?.id], enabled: open && !!empresaId && !!review?.id,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('access_reviews').select('*, sistema:sistemas_privilegiados(nome_sistema)')
        .eq('empresa_id', empresaId!).eq('id', review.id).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const campaign = campaignQuery.data;
  const itemsQuery = useQuery({
    queryKey: ['review-items', empresaId, review?.id], enabled: open && !!campaign?.id,
    queryFn: async ({ signal }) => (await readAllPages((from, to) => supabase.from('access_review_items').select('*')
      .eq('review_id', campaign!.id).order('usuario_beneficiario').order('id').range(from, to).abortSignal(signal), signal)).data,
  });
  const items = itemsQuery.data ?? [];
  type Item = (typeof items)[number];
  const failed = campaignQuery.isError || itemsQuery.isError || (campaignQuery.isSuccess && !campaign);
  const loading = campaignQuery.isLoading || (!!campaign && itemsQuery.isLoading);
  const completed = items.filter(item => item.decisao !== 'pendente').length;
  const pending = items.length - completed;
  const closed = campaign?.status === 'concluida' || campaign?.status === 'cancelada';
  const progress = items.length ? completed / items.length * 100 : 0;
  const filtered = items.filter(item => [item.usuario_beneficiario, item.email_beneficiario]
    .some(value => value?.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase()))).sort((a,b) => compareReviewRows(a,b,sort));
  const origin = (item: Item) => t(item.conta_id ? 'experience.reviewPrivilegedAccount' : 'experience.reviewSystemUser');
  const decision = (value: string) => {
    const labels: Record<string, [StatusTone, string]> = {
      pendente: ['neutral', 'decisaoPendente'], aprovar: ['success', 'decisaoAprovado'],
      revogar: ['destructive', 'decisaoRevogado'], modificar: ['info', 'decisaoModificado'],
    };
    const [tone, key] = labels[value] ?? labels.pendente;
    return <StatusBadge tone={tone}>{t('revisaoAcessosComp.itemsDialog.' + key)}</StatusBadge>;
  };
  const columns: Column<Item>[] = [
    { key: 'usuario_beneficiario', label: t('revisaoAcessosComp.itemsDialog.colUsuario'), sortable: true,
      render: (_, item) => <div><span className="font-medium">{item.usuario_beneficiario}</span><p className="text-xs text-muted-foreground">{item.email_beneficiario}</p></div> },
    { key: 'sistema_usuario_id', label: t('experience.reviewOrigin'), mobilePriority: 2, sortable: false, render: (_, item) => origin(item) },
    { key: 'nivel_privilegio', label: t('revisaoAcessosComp.itemsDialog.colNivel'), mobilePriority: 4, render: value => formatStatus(value) },
    { key: 'data_expiracao', label: t('experience.reviewExpiry'), mobilePriority: 1, sortable: true,
      render: value => value ? formatDateOnly(value) : t('experience.noExpiry') },
    { key: 'decisao', label: t('revisaoAcessosComp.itemsDialog.colDecisao'), mobilePriority: 0, render: value => decision(value) },
    { key: 'data_revisao', label: t('revisaoAcessosComp.itemsDialog.colRevisadoEm'), mobilePriority: 3, sortable: true, render: value => value ? formatDateOnly(value) : '—' },
    ...(!closed ? [{ key: 'actions' as keyof Item, label: t('fin.comum.acoes'), render: (_: unknown, item: Item) =>
      <Button variant="outline" size="sm" onClick={() => setSelectedItem(item)}>{t(item.decisao === 'pendente' ? 'revisaoAcessosComp.itemsDialog.buttonRevisar' : 'revisaoAcessosComp.itemsDialog.buttonEditar')}</Button> }] : []),
  ];
  const retry = () => { void campaignQuery.refetch(); if (campaign) void itemsQuery.refetch(); };
  const exportReview = () => exportCSV(
    [t('revisaoAcessosComp.itemsDialog.colUsuario'), t('revisaoAcessosComp.itemsDialog.colSistema'), t('experience.reviewOrigin'),
      t('revisaoAcessosComp.itemsDialog.colNivel'), t('revisaoAcessosComp.itemsDialog.colDecisao'), t('revisaoAcessosComp.itemsDialog.colJustificativa'), t('revisaoAcessosComp.itemsDialog.colRevisadoEm')],
    filtered.map(item => [item.usuario_beneficiario, campaign?.sistema?.nome_sistema, origin(item), formatStatus(item.nivel_privilegio),
      formatStatus(item.decisao), item.justificativa_revisor, item.data_revisao ? formatDateOnly(item.data_revisao) : ''].map(spreadsheetText)),
    'revisao-acessos-' + review.id,
  );
  const finish = async () => {
    if (!campaign || failed || loading || pending || !items.length || closed || finalizing) return;
    setFinalizing(true);
    try { await finalizeReview(campaign.id); setConfirm(false); onSuccess(); onClose(); }
    catch { /* Mutation keeps the mapped error visible; database rolled back failures. */ }
    finally { setFinalizing(false); }
  };

  return <>
    <DialogShell open={open && !selectedItem && !confirm} onOpenChange={next => { if (!next) onClose(); }}
      icon={IconChecklist} title={t('revisaoAcessosComp.itemsDialog.title', { nome: campaign?.nome_revisao ?? review?.nome_revisao ?? '' })} size="xl" hideFooter>
      <div className="space-y-4">
        {!failed && !loading && <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="min-w-48 flex-1 max-w-sm">
            <p className="mb-2 text-sm font-medium">{completed} / {items.length} · {t('revisaoAcessosComp.itemsDialog.progressoTitle')}</p>
            <Progress value={progress} aria-label={t('revisaoAcessosComp.itemsDialog.progressoTitle')} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!filtered.length} onClick={exportReview}><IconDownload className="mr-2 h-4 w-4" />{t('revisaoAcessosComp.itemsDialog.buttonExportar')}</Button>
            {!closed && <Button disabled={!!pending || !items.length || finalizing} onClick={() => setConfirm(true)}><IconSuccess className="mr-2 h-4 w-4" />{t('revisaoAcessosComp.itemsDialog.buttonFinalizar')}</Button>}
          </div>
        </div>}
        <p className="text-sm leading-relaxed text-muted-foreground">{t(closed ? 'experience.reviewClosed' : 'experience.reviewEffectHint')}</p>
        {!closed && pending > 0 && <p className="text-sm text-muted-foreground">{t('experience.reviewPendingItems')}</p>}
        <DataTable paginated pageSize={20} data={filtered} columns={columns} loading={loading} error={failed} onRefresh={retry}
          sortField={sort?.field} sortDirection={sort?.direction} onSort={field => setSort(current => nextReviewSort(current, field))}
          searchValue={searchTerm} onSearchChange={setSearchTerm} searchPlaceholder={t('revisaoAcessosComp.itemsDialog.searchPlaceholder')}
          onRowClick={closed ? undefined : setSelectedItem} emptyState={{ title: t('revisaoAcessosComp.itemsDialog.emptyItems') }} />
      </div>
    </DialogShell>
    <ReviewItemDecisionDialog open={open && !!selectedItem} item={selectedItem} onClose={() => setSelectedItem(null)}
      onSuccess={() => { setSelectedItem(null); retry(); onSuccess(); }} />
    <ConfirmDialog open={open && confirm} onOpenChange={setConfirm} onConfirm={() => void finish()} loading={finalizing}
      title={t('experience.reviewFinalizeConfirm')} description={t('experience.reviewFinalizeDescription')} />
  </>;
}
