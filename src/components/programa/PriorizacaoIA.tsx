import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { toast } from 'sonner';

interface ItemInput { titulo: string; categoria?: string | null; impacto?: string | null; status?: string | null; }
interface Prioridade { titulo: string; motivo: string; urgencia: 'alta' | 'media' | 'baixa' | string; }

const URG_TONE: Record<string, 'warning' | 'info' | 'neutral'> = { alta: 'warning', media: 'info', baixa: 'neutral' };
const URG_LABEL: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

export function PriorizacaoIA({ frameworkNome, itens }: { frameworkNome?: string | null; itens: ItemInput[] }) {
  const [loading, setLoading] = useState(false);
  const [prioridades, setPrioridades] = useState<Prioridade[] | null>(null);

  const gerar = async () => {
    if (itens.length === 0) { toast.info('Não há controles pendentes para priorizar.'); return; }
    setLoading(true);
    const { data, error } = await invokeEdgeFunction<{ success: boolean; prioridades: Prioridade[]; error?: string }>(
      'programa-priorizacao',
      { body: { framework_nome: frameworkNome, itens } },
    );
    setLoading(false);
    if (error || !data?.success) { toast.error(data?.error || 'Não foi possível gerar as prioridades.'); return; }
    setPrioridades(data.prioridades || []);
  };

  return (
    <Card className="rounded-xl border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-base font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" strokeWidth={1.5} /> Por onde começar</h3>
          {prioridades && <Button variant="ghost" size="sm" onClick={gerar} disabled={loading}>Refazer</Button>}
        </div>
        <p className="text-xs text-muted-foreground mb-3">A IA avalia seus controles pendentes e sugere o que priorizar.</p>

        {loading ? (
          <div className="py-8 flex flex-col items-center gap-2"><AkurisPulse size={40} /><p className="text-xs text-muted-foreground">Analisando os controles...</p></div>
        ) : !prioridades ? (
          <div className="py-6 text-center">
            <Button onClick={gerar} disabled={itens.length === 0}><Sparkles className="h-4 w-4 mr-2" strokeWidth={1.5} /> Sugerir prioridades com IA</Button>
            <p className="text-[11px] text-muted-foreground mt-2">{itens.length} controle(s) pendente(s)</p>
          </div>
        ) : prioridades.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">A IA não retornou sugestões. Tente refazer.</p>
        ) : (
          <ol className="space-y-2">
            {prioridades.map((pr, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-border/60 bg-background p-2.5">
                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{pr.titulo}</span>
                    <StatusBadge tone={URG_TONE[pr.urgencia] || 'neutral'} size="sm">{URG_LABEL[pr.urgencia] || pr.urgencia}</StatusBadge>
                  </div>
                  {pr.motivo && <p className="text-xs text-muted-foreground mt-0.5">{pr.motivo}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
