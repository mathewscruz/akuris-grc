import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { FileBarChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchTemplateData } from './generateTemplatePDF';

interface RelatorioPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatorio: any;
  empresaId: string;
}

export function RelatorioPreviewDialog({ open, onOpenChange, relatorio, empresaId }: RelatorioPreviewDialogProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && relatorio?.template_base && empresaId) {
      setLoading(true);
      fetchTemplateData(relatorio.template_base, empresaId)
        .then(setData)
        .catch(() => setData({ sections: [] }))
        .finally(() => setLoading(false));
    }
  }, [open, relatorio, empresaId]);

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FileBarChart}
      title={`Preview: ${relatorio?.nome ?? ''}`}
      description={relatorio?.template_base || undefined}
      size="lg"
      hideFooter
    >
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <AkurisPulse size={32} />
            </div>
          ) : !data || data.sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">Nenhum dado encontrado</p>
              <p className="text-sm mt-1">Cadastre dados nos módulos correspondentes para gerar o relatório.</p>
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
                              <TableRow><TableCell colSpan={section.tableHeaders.length} className="text-center text-muted-foreground text-sm py-4">Sem registros</TableCell></TableRow>
                            ) : section.tableRows.slice(0, 20).map((row: string[], ri: number) => (
                              <TableRow key={ri}>
                                {row.map((cell: string, ci: number) => (
                                  <TableCell key={ci} className="text-xs">{cell || '-'}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                            {section.tableRows.length > 20 && (
                              <TableRow><TableCell colSpan={section.tableHeaders.length} className="text-center text-muted-foreground text-xs py-2">... e mais {section.tableRows.length - 20} registros (visíveis no PDF)</TableCell></TableRow>
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
