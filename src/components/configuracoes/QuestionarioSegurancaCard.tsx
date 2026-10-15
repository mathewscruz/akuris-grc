import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { exportCSV } from '@/lib/csv-utils';

interface Resposta { pergunta: string; resposta: 'sim' | 'parcial' | 'nao' | 'na'; justificativa: string; evidencias: string[] }

const tom = { sim: 'success', parcial: 'warning', nao: 'destructive', na: 'neutral' } as const;

export function QuestionarioSegurancaCard() {
  const { t, locale } = useLanguage();
  const [texto, setTexto] = useState('');
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [busy, setBusy] = useState(false);

  const perguntas = texto.split('\n').map((l) => l.trim()).filter((l) => l.length >= 3);

  const gerar = async () => {
    setBusy(true);
    const { data } = await invokeEdgeFunction<{ respostas: Resposta[] }>('answer-security-questionnaire', {
      body: { perguntas: perguntas.slice(0, 80), idioma: locale.startsWith('en') ? 'en' : 'pt' },
      isAiCall: true,
    });
    setBusy(false);
    if (data?.respostas) setRespostas(data.respostas);
  };

  const exportar = () =>
    exportCSV(
      [t('trustCenter.q.pergunta'), t('trustCenter.q.resposta'), t('trustCenter.q.justificativa'), t('trustCenter.q.evidencias')],
      respostas.map((r) => [r.pergunta, t(`trustCenter.q.${r.resposta}`), r.justificativa, r.evidencias.join('; ')]),
      'questionario-seguranca',
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('trustCenter.q.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('trustCenter.q.description')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t('trustCenter.q.placeholder')} />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={gerar} disabled={busy || perguntas.length === 0}>{t('trustCenter.q.gerar', { count: Math.min(perguntas.length, 80) })}</Button>
          {respostas.length > 0 && <Button variant="outline" onClick={exportar}>{t('trustCenter.q.exportar')}</Button>}
          {busy && <AkurisPulse size={20} />}
        </div>
        {respostas.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('trustCenter.q.revisar')}</p>
            {respostas.map((r, i) => (
              <div key={i} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{r.pergunta}</p>
                  <StatusBadge tone={tom[r.resposta]}>{t(`trustCenter.q.${r.resposta}`)}</StatusBadge>
                </div>
                <p className="text-sm text-muted-foreground">{r.justificativa}</p>
                {r.evidencias.length > 0 && <p className="text-xs text-muted-foreground">{t('trustCenter.q.evidencias')}: {r.evidencias.join('; ')}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
