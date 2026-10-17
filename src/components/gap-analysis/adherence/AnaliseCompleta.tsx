import React from 'react';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

/** Destaca códigos de requisito (A.5.19, 9.2), percentuais e contagens. */
const TOKEN = /(\b[A-Z]?\.?\d+(?:\.\d+)+\b|\b\d+(?:[.,]\d+)?%|\(PO \d+\))/g;

function realcar(texto: string) {
  return texto.split(TOKEN).map((parte, i) => {
    if (!parte) return null;
    if (/^\d+(?:[.,]\d+)?%$/.test(parte)) {
      return <strong key={i} className="font-semibold text-foreground">{parte}</strong>;
    }
    if (/^\(PO \d+\)$/.test(parte) || /^[A-Z]?\.?\d+(?:\.\d+)+$/.test(parte)) {
      return (
        <span key={i} className="mx-0.5 inline-flex items-center rounded border border-border bg-muted px-1.5 py-px font-mono text-micro text-foreground align-[1px]">
          {parte.replace(/[()]/g, '')}
        </span>
      );
    }
    return <React.Fragment key={i}>{parte}</React.Fragment>;
  });
}

function blocos(texto: string) {
  return texto
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((b) => b.replace(/^#+\s*/gm, '').trim())
    .filter(Boolean);
}

export function AnaliseCompleta({ texto }: { texto: string }) {
  const { t } = useLanguage();
  const k = (s: string) => t(`gapAnalysis.adherenceUi.verdict.ui.${s}`);
  const partes = blocos(texto);
  const [resumo, ...resto] = partes;
  const conclusao = resto.length > 1 ? resto[resto.length - 1] : null;
  const meio = conclusao ? resto.slice(0, -1) : resto;
  const minutos = Math.max(1, Math.round(texto.split(/\s+/).length / 220));

  return (
    <div className="mx-auto max-w-[820px] space-y-4">
      <Card className="relative overflow-hidden border-l-[3px] border-l-primary p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{k('fullSummary')}</p>
          <span className="text-xs text-muted-foreground">{minutos} {k('fullReading')}</span>
        </div>
        <p className="text-[15px] leading-7 text-foreground">{realcar(resumo ?? '')}</p>
      </Card>

      {meio.length > 0 && (
        <Card className="p-6">
          <ol className="space-y-6">
            {meio.map((p, i) => (
              <li key={i} className="grid grid-cols-[28px_1fr] gap-4 animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {k('fullSection')} {i + 1}
                  </p>
                  <p className="text-sm leading-7 text-muted-foreground">{realcar(p)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {conclusao && (
        <Card className="bg-muted/40 p-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{k('fullConclusion')}</p>
          <p className="text-sm leading-7 text-foreground">{realcar(conclusao)}</p>
        </Card>
      )}
    </div>
  );
}
