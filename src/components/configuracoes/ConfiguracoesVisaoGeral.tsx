/**
 * Visão geral de Configurações: progresso medido, pendências com atalho,
 * busca sem acento e cartões com o estado real de cada área (tenant-scoped).
 */
import { useMemo, useState, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Chip, type ChipTone } from '@/components/ui/chip';
import { IconSearch, IconArrowRight, IconPerson, IconLayers, IconShield, IconSuccess, IconWarning } from '@/components/icons';
import { useConexoesAtivas } from '@/components/configuracoes/integrations/ConexoesAtivas';
import {
  calcularProgressoConfiguracao, normalizarBusca, SECAO_DO_ITEM, type StatusConfiguracao,
} from '@/lib/configuracoes/progresso';

export interface SecaoConfig {
  id: string;
  grupo: 'conta' | 'plataforma' | 'admin';
  titulo: string;
  icon: ComponentType<{ className?: string }>;
  palavras?: string;
}

interface Props {
  empresaId: string;
  secoes: SecaoConfig[];
  isAdmin: boolean;
  onOpen: (id: string) => void;
}

function useConfiguracoesStatus(empresaId: string, isAdmin: boolean) {
  const conexoes = useConexoesAtivas(isAdmin ? empresaId : '');
  const q = useQuery({
    queryKey: ['configuracoes-status', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const [usuarios, empresa, denuncia, trust] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
        supabase.from('empresas').select('logo_url, slug, plano:planos(nome)').eq('id', empresaId).maybeSingle(),
        supabase.from('denuncias_configuracoes').select('ativo').eq('empresa_id', empresaId).maybeSingle(),
        supabase.from('trust_center').select('ativo').eq('empresa_id', empresaId).maybeSingle(),
      ]);
      const emp = empresa.data as { logo_url: string | null; slug: string | null; plano: { nome: string } | null } | null;
      return {
        usuarios: usuarios.error ? null : usuarios.count ?? 0,
        logo: empresa.error ? null : !!emp?.logo_url,
        slug: empresa.error ? null : !!emp?.slug,
        plano: emp?.plano?.nome ?? null,
        denunciaAtiva: denuncia.error ? null : !!denuncia.data?.ativo,
        trustPublicado: trust.error ? null : !!trust.data?.ativo,
      };
    },
  });
  const status: StatusConfiguracao | null = q.data ? {
    usuarios: q.data.usuarios, logo: q.data.logo, slug: q.data.slug,
    integracoes: conexoes.data ? conexoes.data.conns.length : null,
    denunciaAtiva: q.data.denunciaAtiva, trustPublicado: q.data.trustPublicado,
  } : null;
  return { status, plano: q.data?.plano ?? null };
}

export function ConfiguracoesVisaoGeral({ empresaId, secoes, isAdmin, onOpen }: Props) {
  const { t } = useLanguage();
  const [busca, setBusca] = useState('');
  const { status, plano } = useConfiguracoesStatus(empresaId, isAdmin);
  const progresso = status ? calcularProgressoConfiguracao(status) : null;

  const chip = (id: string): { label: string; tone: ChipTone } | null => {
    if (!status) return null;
    switch (id) {
      case 'usuarios': return status.usuarios == null ? null : { label: t('configVisao.status.usuarios', { n: status.usuarios }), tone: 'rest' };
      case 'organizacao': return status.logo == null ? null : status.logo ? { label: t('configVisao.status.logoOk'), tone: 'done' } : { label: t('configVisao.status.logoPendente'), tone: 'attention' };
      case 'integracoes': return status.integracoes == null ? null : status.integracoes > 0 ? { label: t('configVisao.status.conectadas', { n: status.integracoes }), tone: 'done' } : { label: t('configVisao.status.nenhumaConexao'), tone: 'rest' };
      case 'denuncia': return status.denunciaAtiva == null ? null : status.denunciaAtiva ? { label: t('configVisao.status.ativo'), tone: 'done' } : { label: t('configVisao.status.inativo'), tone: 'attention' };
      case 'trust-center': return status.trustPublicado == null ? null : status.trustPublicado ? { label: t('configVisao.status.publicado'), tone: 'done' } : { label: t('configVisao.status.naoPublicado'), tone: 'rest' };
      case 'assinatura': return plano ? { label: plano, tone: 'active' } : null;
      default: return null;
    }
  };

  const filtradas = useMemo(() => {
    const q = normalizarBusca(busca);
    if (!q) return secoes;
    return secoes.filter((s) => normalizarBusca(`${s.titulo} ${t(`configVisao.desc.${s.id}`)} ${s.palavras ?? ''}`).includes(q));
  }, [busca, secoes, t]);

  const grupos: SecaoConfig['grupo'][] = ['conta', 'plataforma', 'admin'];
  const pendentes = progresso?.pendentes.filter((p) => secoes.some((s) => s.id === SECAO_DO_ITEM[p])) ?? [];

  return (
    <div className="space-y-8 akuris-stagger">
      <div className="relative max-w-xl">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={t('configVisao.buscar')}
          aria-label={t('configVisao.buscar')}
          className="pl-9"
        />
      </div>

      {isAdmin && progresso && !busca && (
        <section className="rounded-xl border border-border bg-card p-5 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)] items-center">
          <div className="flex items-center gap-4">
            <AnelProgresso valor={progresso.feitos / progresso.total} />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">
                {progresso.pendentes.length === 0
                  ? t('configVisao.progressoTudo')
                  : t('configVisao.progressoTitulo', { feitos: progresso.feitos, total: progresso.total })}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-5">{t('configVisao.progressoDesc')}</p>
            </div>
          </div>
          <div>
            <Progress value={(progresso.feitos / progresso.total) * 100} className="h-2.5" aria-label={t('configVisao.progressoTitulo', { feitos: progresso.feitos, total: progresso.total })} />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{t('configVisao.concluidas', { n: progresso.feitos })}</span>
              <span>{t('configVisao.pendentesN', { n: progresso.pendentes.length })}</span>
            </div>
          </div>
          {pendentes.length > 0 && (
            <div className="lg:border-l border-border lg:pl-6">
              <p className="text-sm font-medium text-foreground mb-2">{t('configVisao.pendencias')}</p>
              <ul className="space-y-3">
                {pendentes.map((p) => (
                  <li key={p} className="flex items-center gap-3">
                    <IconWarning className="h-4 w-4 text-warning shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{t(`configVisao.itens.${p}`)}</p>
                      <p className="text-xs text-muted-foreground">{t(`configVisao.itensDesc.${p}`)}</p>
                    </div>
                    <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => onOpen(SECAO_DO_ITEM[p])}>
                      {t('configVisao.resolver')}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {filtradas.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('configVisao.semResultados')}</p>
      )}

      {grupos.map((g) => {
        const lista = filtradas.filter((s) => s.grupo === g);
        if (!lista.length) return null;
        return (
          <section key={g} className="space-y-3">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
              {(() => { const GI = g === 'conta' ? IconPerson : g === 'plataforma' ? IconLayers : IconShield; return <GI className="h-5 w-5 text-primary" aria-hidden />; })()}
              {t(`configVisao.grupos.${g}`)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {lista.map((s) => {
                const c = chip(s.id);
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onOpen(s.id)}
                    className="group text-left rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex flex-col gap-3 min-h-[132px]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{s.titulo}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-5 line-clamp-2">{t(`configVisao.desc.${s.id}`)}</p>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      {c ? <Chip family="state" tone={c.tone} className="ml-[52px]"><span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${c.tone === 'done' ? 'bg-success' : c.tone === 'attention' ? 'bg-warning' : c.tone === 'active' ? 'bg-primary' : 'bg-muted-foreground'}`} />{c.label}</Chip> : <span />}
                      <IconArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AnelProgresso({ valor }: { valor: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 52 52" className="h-14 w-14 -rotate-90" aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-success transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, valor)))} />
      </svg>
      <span className="absolute inset-2.5 rounded-full bg-success/15 flex items-center justify-center">
        <IconSuccess className="h-5 w-5 text-success" aria-hidden />
      </span>
    </div>
  );
}
