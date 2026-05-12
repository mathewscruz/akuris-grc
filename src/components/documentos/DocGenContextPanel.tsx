import React from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronDown, Layers, ShieldAlert, Boxes, Sparkles } from 'lucide-react';
import { AkurisPulse } from '@/components/ui/AkurisPulse';

export interface CompanyContext {
  empresa?: {
    nome?: string;
    cnpj?: string;
    setor_atuacao?: string;
    porte_empresa?: string;
    objetivo_compliance?: string;
  } | null;
  frameworks?: Array<{ nome?: string; versao?: string; score?: number; status?: string }>;
  ativos_criticos?: Array<{ nome?: string; tipo?: string; criticidade?: string }>;
  riscos_altos?: Array<{ nome?: string; nivel?: string; status?: string }>;
}

interface Props {
  context: CompanyContext | null;
  loading?: boolean;
  defaultOpen?: boolean;
}

export const DocGenContextPanel: React.FC<Props> = ({ context, loading, defaultOpen = true }) => {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card/50 p-4 flex items-center gap-3">
        <AkurisPulse size={24} />
        <span className="text-sm text-muted-foreground">Carregando contexto da empresa…</span>
      </div>
    );
  }

  if (!context || !context.empresa) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
        Sem contexto disponível — a IA usará apenas o briefing.
      </div>
    );
  }

  const emp = context.empresa;
  const fw = context.frameworks || [];
  const ativos = context.ativos_criticos || [];
  const riscos = context.riscos_altos || [];

  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border border-border bg-card/50">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 group">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <span className="font-medium">Contexto enviado à IA</span>
          <Badge variant="secondary" className="ml-1 text-[10px]">
            {[emp.nome && 'empresa', fw.length && `${fw.length} fw`, ativos.length && `${ativos.length} ativos`, riscos.length && `${riscos.length} riscos`].filter(Boolean).join(' · ')}
          </Badge>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.5} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 space-y-3 text-sm">
        <Section icon={<Building2 className="h-3.5 w-3.5" strokeWidth={1.5} />} label="Empresa">
          <div className="text-foreground">{emp.nome}</div>
          <div className="text-xs text-muted-foreground">
            {[emp.setor_atuacao, emp.porte_empresa, emp.cnpj].filter(Boolean).join(' · ') || '—'}
          </div>
          {emp.objetivo_compliance && (
            <div className="text-xs text-muted-foreground mt-1">Objetivo: {emp.objetivo_compliance}</div>
          )}
        </Section>

        {fw.length > 0 && (
          <Section icon={<Layers className="h-3.5 w-3.5" strokeWidth={1.5} />} label="Frameworks">
            <div className="flex flex-wrap gap-1.5">
              {fw.slice(0, 6).map((f, i) => (
                <Badge key={i} variant="outline" className="text-[11px]">
                  {f.nome}{f.versao ? ` ${f.versao}` : ''} · {Math.round(Number(f.score || 0))}%
                </Badge>
              ))}
            </div>
          </Section>
        )}

        {ativos.length > 0 && (
          <Section icon={<Boxes className="h-3.5 w-3.5" strokeWidth={1.5} />} label={`Ativos críticos (${ativos.length})`}>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {ativos.slice(0, 5).map((a, i) => (
                <li key={i}>• {a.nome} <span className="opacity-70">— {a.tipo} · {a.criticidade}</span></li>
              ))}
            </ul>
          </Section>
        )}

        {riscos.length > 0 && (
          <Section icon={<ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.5} />} label={`Riscos altos (${riscos.length})`}>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {riscos.slice(0, 5).map((r, i) => (
                <li key={i}>• {r.nome} <span className="opacity-70">— {r.nivel}</span></li>
              ))}
            </ul>
          </Section>
        )}

        <p className="text-[11px] text-muted-foreground/80 pt-1 border-t border-border/50">
          Estes dados são enviados ao DocGen automaticamente para personalizar o documento. Você não precisa repeti-los no chat.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
};

const Section: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div>
    <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground mb-1">
      {icon}
      <span>{label}</span>
    </div>
    {children}
  </div>
);
