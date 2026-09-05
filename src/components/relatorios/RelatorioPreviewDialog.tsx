import { useQuery } from '@tanstack/react-query';
import { QueryError } from '@/components/ui/query-error';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchTemplateData } from './generateTemplatePDF';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconChart } from '@/components/icons';

interface RelatorioPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatorio: any;
  empresaId: string;
}

export function RelatorioPreviewDialog({ open, onOpenChange, relatorio, empresaId }: RelatorioPreviewDialogProps) {
  const { t } = useLanguage();
  const widgets = Array.isArray(relatorio?.configuracao?.widgets) ? relatorio.configuracao.widgets : [];
  const fontes: string[] = widgets.length ? widgets : relatorio?.template_base ? [relatorio.template_base] : [];
  const { data, isLoading: loading, isError, refetch } = useQuery({
    queryKey: ['report-preview', empresaId, relatorio?.id, fontes],
    enabled: open && !!empresaId && fontes.length > 0,
    queryFn: async () => {
      const conjuntos = await Promise.all(fontes.map(fonte => fetchTemplateData(fonte, empresaId)));
      return { sections: conjuntos.flatMap(conjunto => conjunto.sections) };
    },
  });

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconChart}
      title={t('relatoriosComp.preview.title', { nome: relatorio?.nome ?? '' })}
      description={relatorio?.descricao || undefined}
      size="lg"
      hideFooter
    >
        <div>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{t('experience.reportScope')}</p>
          {isError ? <QueryError onRetry={() => void refetch()} /> : loading ? (
            <div className="flex items-center justify-center py-16">
              <AkurisPulse size={32} />
            </div>
          ) : !data || data.sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">{t('relatoriosComp.preview.emptyTitle')}</p>
              <p className="text-sm mt-1">{t('relatoriosComp.preview.emptyDescription')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {data.sections.map((section: any, idx: number) => (
                <Card key={idx}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {section.metrics && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {section.metrics.map((m: any, mi: number) => (
                          <div key={mi} className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">{m.label}</p>
                            <p className="text-lg font-bold">{m.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {section.tableHeaders && section.tableRows && (
                      <div className="rounded-md border overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {section.tableHeaders.map((h: string, hi: number) => (
                                <TableHead key={hi} className="text-xs">{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {section.tableRows.length === 0 ? (
                              <TableRow><TableCell colSpan={section.tableHeaders.length} className="text-center text-muted-foreground text-sm py-4">{t('relatoriosComp.preview.semRegistros')}</TableCell></TableRow>
                            ) : section.tableRows.slice(0, 20).map((row: string[], ri: number) => (
                              <TableRow key={ri}>
                                {row.map((cell: string, ci: number) => (
                                  <TableCell key={ci} className="text-xs">{cell || '-'}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                            {section.tableRows.length > 20 && (
                              <TableRow><TableCell colSpan={section.tableHeaders.length} className="text-center text-muted-foreground text-xs py-2">{t('relatoriosComp.preview.maisRegistros', { count: section.tableRows.length - 20 })}</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
    </DialogShell>
  );
}
