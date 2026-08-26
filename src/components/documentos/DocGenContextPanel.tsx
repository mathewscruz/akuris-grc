import React from 'react';
import { IconOrg, IconChevronDown, IconLayers, IconShieldAlert, IconPackage } from '@/components/icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';

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
  /**
   * A leitura do contexto FALHOU — diferente de a empresa não ter contexto.
   *
   * Sem esta distinção o painel dizia «Sem contexto disponível — a IA usará
   * apenas o briefing» nos dois casos, e a geração seguia em frente sem os
   * riscos, controlos e frameworks reais. O documento sai plausível e
   * genérico, e ninguém fica a saber que faltou o que importava.
   */
  erro?: boolean;
  onRetry?: () => void;
}

export const DocGenContextPanel: React.FC<Props> = ({ context, loading, defaultOpen = true, erro, onRetry }) => {
  const { t } = useLanguage();
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card/50 p-4 flex items-center gap-3">
        <AkurisPulse size={24} />
        <span className="text-sm text-muted-foreground">{t('docgen.contextPanel.loading')}</span>
      </div>
    );
  }

  if (erro && !context) {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning flex flex-wrap items-center gap-2">
        <IconShieldAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
        <span className="flex-1 min-w-[12rem]">{t('docgen.contextPanel.contextFailed')}</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="underline underline-offset-2 font-medium">
            {t('docgen.contextPanel.contextRetry')}
          </button>
        )}
      </div>
    );
  }

  if (!context || !context.empresa) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
        {t('docgen.contextPanel.noContext')}
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
          <span className="font-medium">{t('docgen.contextPanel.title')}</span>
        </div>
        <IconChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.5} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 space-y-3 text-sm">
        <Section icon={<IconOrg className="h-3.5 w-3.5" strokeWidth={1.5} />} label={t('docgen.contextPanel.company')}>
          <div className="text-foreground">{emp.nome}</div>
          <div className="text-xs text-muted-foreground">
            {[emp.setor_atuacao, emp.porte_empresa, emp.cnpj].filter(Boolean).join(' · ') || '—'}
          </div>
          {emp.objetivo_compliance && (
            <div className="text-xs text-muted-foreground mt-1">{t('docgen.contextPanel.objective')}: {emp.objetivo_compliance}</div>
          )}
        </Section>

        {fw.length > 0 && (
          <Section icon={<IconLayers className="h-3.5 w-3.5" strokeWidth={1.5} />} label={t('docgen.contextPanel.frameworks')}>
            <div className="flex flex-wrap gap-1.5">
              {fw.slice(0, 6).map((f, i) => (
                <Badge key={i} variant="outline" className="text-micro">
                  {f.nome}{f.versao ? ` ${f.versao}` : ''} · {Math.round(Number(f.score || 0))}%
                </Badge>
              ))}
            </div>
          </Section>
        )}

        {ativos.length > 0 && (
          <Section icon={<IconPackage className="h-3.5 w-3.5" strokeWidth={1.5} />} label={t('docgen.contextPanel.criticalAssets', { count: ativos.length })}>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {ativos.slice(0, 5).map((a, i) => (
                <li key={i}>• {a.nome} <span className="opacity-70">— {a.tipo} · {a.criticidade}</span></li>
              ))}
            </ul>
          </Section>
        )}

        {riscos.length > 0 && (
          <Section icon={<IconShieldAlert className="h-3.5 w-3.5" strokeWidth={1.5} />} label={t('docgen.contextPanel.highRisks', { count: riscos.length })}>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {riscos.slice(0, 5).map((r, i) => (
                <li key={i}>• {r.nome} <span className="opacity-70">— {r.nivel}</span></li>
              ))}
            </ul>
          </Section>
        )}

        <p className="text-micro text-muted-foreground pt-1 border-t border-border/50">
          {t('docgen.contextPanel.footerNote')}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
};

const Section: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div>
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
      {icon}
      <span>{label}</span>
    </div>
    {children}
  </div>
);
