import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { StatusBadge } from '@/components/ui/status-badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { resolveCriticidadeTone, resolveItemStatusTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { formatDateOnly, formatDateTime, intlLocale } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  IconServer, IconCloud, IconMonitor, IconPhone, IconDatabase, IconGlobe, IconCode, IconQr, IconSettings,
  IconHistory, IconEdit, IconDelete, IconChevronUp, IconChevronDown, IconPlug, IconTag, IconShieldAlert,
} from '@/components/icons';

export interface AtivoFichaData {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  criticidade?: string | null;
  fornecedor?: string | null;
  localizacao?: string | null;
  proprietario_nome?: string | null;
  descricao?: string | null;
  tags?: string[] | null;
  imei?: string | null;
  created_at?: string;
  atributos?: Record<string, unknown> | null;
}

interface Props {
  ativo: AtivoFichaData | null;
  empresaId?: string | null;
  tipoLabel: (tipo: string) => string;
  criticidadeLabel: (a: AtivoFichaData) => string;
  onClose: () => void;
  onEdit: (a: AtivoFichaData) => void;
  onDelete: (a: AtivoFichaData) => void;
  onManutencao: (a: AtivoFichaData) => void;
  onTrilha: (a: AtivoFichaData) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

const FONTES: Record<string, string> = { intune: 'Microsoft Intune', aws: 'AWS' };

function iconeDoTipo(a: AtivoFichaData) {
  const attr = a.atributos ?? {};
  const disp = String(attr.tipo_dispositivo ?? '').toLowerCase();
  if (disp === 'smartphone') return IconPhone;
  if (disp === 'notebook') return IconMonitor;
  if (attr.origem === 'aws') return a.tipo === 'banco_dados' ? IconDatabase : IconCloud;
  if (a.tipo === 'banco_dados') return IconDatabase;
  if (a.tipo === 'rede') return IconGlobe;
  if (a.tipo === 'aplicacao' || a.tipo === 'software') return IconCode;
  return IconServer;
}

const Field: React.FC<{ label: string; value?: React.ReactNode; full?: boolean }> = ({ label, value, full }) => (
  <div className={`flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 text-sm last:border-b-0 ${full ? 'sm:col-span-2' : ''}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium text-foreground break-all">{value === null || value === undefined || value === '' ? '—' : value}</span>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="overflow-hidden rounded-lg border bg-card dark:shadow-none">
    <h3 className="border-b bg-muted/40 px-4 py-3 text-sm font-semibold text-foreground">{title}</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 sm:[&>*:nth-child(odd)]:border-r">{children}</div>
  </section>
);

export const AtivoFicha: React.FC<Props> = ({
  ativo, empresaId, tipoLabel, criticidadeLabel, onClose, onEdit, onDelete, onManutencao, onTrilha, onPrev, onNext,
}) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [showQr, setShowQr] = useState(false);
  const attr = (ativo?.atributos ?? {}) as Record<string, any>;
  const origem = typeof attr.origem === 'string' ? attr.origem : null;

  const { data: riscos, isLoading: loadingRiscos } = useQuery({
    queryKey: ['ativo-ficha-riscos', empresaId, ativo?.id],
    enabled: !!ativo?.id && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riscos_ativos')
        .select('risco_id, riscos!inner(id, codigo, nome, nivel_risco_inicial, severidade_efetiva, empresa_id)')
        .eq('ativo_id', ativo!.id)
        .eq('riscos.empresa_id', empresaId!);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.riscos);
    },
  });

  const { data: manutencoes, isLoading: loadingMan } = useQuery({
    queryKey: ['ativo-ficha-manutencoes', empresaId, ativo?.id],
    enabled: !!ativo?.id && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ativos_manutencoes')
        .select('*')
        .eq('ativo_id', ativo!.id)
        .eq('empresa_id', empresaId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: lastScan } = useQuery({
    queryKey: ['ativo-ficha-scan', empresaId, origem],
    enabled: !!origem && !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from('integration_connections')
        .select('last_success_at')
        .eq('empresa_id', empresaId!)
        .eq('provider', origem!)
        .maybeSingle();
      return data?.last_success_at ?? null;
    },
  });

  if (!ativo) return null;
  const Icone = iconeDoTipo(ativo);
  const isAws = origem === 'aws';
  const custo = typeof attr.custo_mensal === 'number'
    ? new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: 'BRL' }).format(attr.custo_mensal)
    : null;
  const simNao = (v: unknown) => (v === true ? t('ativoFicha.sim') : v === false ? t('ativoFicha.nao') : null);
  const tags = (ativo.tags ?? []).filter((x) => x !== 'demo');

  return (
    <Sheet open={!!ativo} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-full p-0 sm:max-w-4xl">
        <div className="flex h-full flex-col overflow-y-auto md:flex-row md:overflow-hidden">
          {/* Coluna esquerda */}
          <aside className="flex w-full shrink-0 flex-col gap-4 border-b p-5 md:w-72 md:overflow-y-auto md:border-b-0 md:border-r">
            <div className="flex flex-col items-center gap-2 pt-2 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border bg-muted/40">
                <Icone className="h-12 w-12 text-muted-foreground" />
              </div>
              <SheetTitle className="text-lg font-semibold leading-tight">{ativo.nome}</SheetTitle>
              <SheetDescription className="text-xs">
                {attr.serie ? `${t('ativoFicha.serie')} ${attr.serie}` : tipoLabel(ativo.tipo)}
              </SheetDescription>
              <div className="flex flex-wrap justify-center gap-1.5">
                <StatusBadge {...resolveItemStatusTone(ativo.status)}>{formatStatus(ativo.status)}</StatusBadge>
                <Chip family="type">{attr.tipo_dispositivo ?? attr.servico ?? tipoLabel(ativo.tipo)}</Chip>
                {ativo.fornecedor && <Chip family="category">{ativo.fornecedor}</Chip>}
              </div>
              {origem && (
                <div className="mt-1 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] text-muted-foreground">
                  <IconPlug className="h-3.5 w-3.5" />
                  <span>
                    {t('ativoFicha.sincronizado', { fonte: FONTES[origem] ?? origem })}
                    {lastScan ? ` · ${t('ativoFicha.ultimoScan', { data: formatDateTime(lastScan) })}` : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('ativoFicha.etiquetas')}</span>
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => onEdit(ativo)}>{t('ativoFicha.editar')}</button>
              </div>
              {tags.length ? (
                <div className="flex flex-wrap gap-1">
                  {tags.map((tg) => <Chip key={tg} family="category" icon={<IconTag className="h-3 w-3" />}>{tg}</Chip>)}
                </div>
              ) : <p className="text-center text-xs text-muted-foreground">{t('ativoFicha.semEtiquetas')}</p>}
            </div>

            <Button variant="outline" className="justify-start" onClick={() => setShowQr((v) => !v)}>
              <IconQr className="mr-2 h-4 w-4" />{showQr ? t('ativoFicha.ocultarQr') : t('ativoFicha.verQr')}
            </Button>
            {showQr && (
              <div className="flex justify-center rounded-lg border bg-background p-3">
                <QRCodeCanvas value={`${window.location.origin}/ativos?ativo=${ativo.id}`} size={140} />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('ativoFicha.acoes')}</span>
              <Button className="justify-start" onClick={() => onManutencao(ativo)}>
                <IconSettings className="mr-2 h-4 w-4" />{t('ativoFicha.registrarManutencao')}
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => onTrilha(ativo)}>
                <IconHistory className="mr-2 h-4 w-4" />{t('ativoFicha.trilha')}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => onEdit(ativo)}><IconEdit className="mr-2 h-4 w-4" />{t('ativoFicha.editarAtivo')}</Button>
                <Button variant="destructive" onClick={() => onDelete(ativo)}><IconDelete className="mr-2 h-4 w-4" />{t('ativoFicha.arquivar')}</Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="icon" aria-label={t('ativoFicha.anterior')} disabled={!onPrev} onClick={onPrev}><IconChevronUp className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" aria-label={t('ativoFicha.proximo')} disabled={!onNext} onClick={onNext}><IconChevronDown className="h-4 w-4" /></Button>
            </div>
          </aside>

          {/* Coluna direita */}
          <div className="flex-1 p-5 md:overflow-y-auto">
            <Tabs defaultValue="detalhes" key={ativo.id}>
              <TabsList className="mb-4">
                <TabsTrigger value="detalhes">{t('ativoFicha.tabDetalhes')}</TabsTrigger>
                <TabsTrigger value="riscos">{t('ativoFicha.tabRiscos')}{riscos?.length ? ` (${riscos.length})` : ''}</TabsTrigger>
                <TabsTrigger value="manutencoes">{t('ativoFicha.tabManutencoes')}</TabsTrigger>
                <TabsTrigger value="linha">{t('ativoFicha.tabLinha')}</TabsTrigger>
              </TabsList>

              <TabsContent value="detalhes" className="space-y-4">
                <Section title={isAws ? t('ativoFicha.recurso') : t('ativoFicha.hardware')}>
                  <Field label={t('ativoFicha.tipo')} value={attr.tipo_dispositivo ?? attr.servico ?? tipoLabel(ativo.tipo)} />
                  <Field label={t('ativoFicha.situacao')} value={formatStatus(ativo.status)} />
                  <Field label={t('ativoFicha.marca')} value={attr.marca ?? ativo.fornecedor} />
                  <Field label={t('ativoFicha.modelo')} value={attr.modelo} />
                  <Field label={t('ativoFicha.condicao')} value={attr.condicao} />
                  <Field label={t('ativoFicha.localidade')} value={ativo.localizacao} />
                  {isAws ? (
                    <>
                      <Field label={t('ativoFicha.regiao')} value={attr.regiao} />
                      <Field label={t('ativoFicha.conta')} value={attr.conta} />
                    </>
                  ) : (
                    <>
                      <Field label={t('ativoFicha.sistema')} value={attr.sistema} />
                      <Field label={t('ativoFicha.criptografia')} value={simNao(attr.criptografado)} />
                    </>
                  )}
                </Section>

                <Section title={t('ativoFicha.identificacao')}>
                  <Field label={t('ativoFicha.serie')} value={attr.serie} />
                  <Field label={t('ativoFicha.patrimonio')} value={attr.patrimonio} />
                  <Field label={t('ativoFicha.imei')} value={ativo.imei} />
                  <Field label={t('ativoFicha.hostname')} value={attr.hostname} />
                  <Field label={t('ativoFicha.idExterno')} value={attr.id_externo} full />
                </Section>

                <Section title={t('ativoFicha.contrato')}>
                  <Field label={t('ativoFicha.fornecedor')} value={ativo.fornecedor} />
                  <Field
                    label={t('ativoFicha.contratoNum')}
                    value={attr.contrato_numero ? (
                      <button type="button" className="text-primary hover:underline" onClick={() => navigate('/contratos')}>{attr.contrato_numero}</button>
                    ) : null}
                  />
                  <Field label={t('ativoFicha.custoMensal')} value={custo} />
                  <Field label={t('ativoFicha.criticidade')} value={
                    ativo.criticidade ? <StatusBadge {...resolveCriticidadeTone(ativo.criticidade)}>{criticidadeLabel(ativo)}</StatusBadge> : null
                  } />
                </Section>

                <Section title={t('ativoFicha.gestao')}>
                  <Field label={t('ativoFicha.responsavel')} value={ativo.proprietario_nome} />
                  <Field label={t('ativoFicha.usuarioAtual')} value={attr.usuario_atual} />
                  <Field label={t('ativoFicha.ultimoCheckin')} value={attr.ultimo_checkin ? formatDateTime(attr.ultimo_checkin) : null} />
                  {!isAws && <Field label={t('ativoFicha.conformidade')} value={attr.conforme === undefined ? null : attr.conforme ? t('ativoFicha.conforme') : t('ativoFicha.naoConforme')} />}
                  <Field label={t('ativoFicha.cadastradoEm')} value={formatDateOnly(ativo.created_at)} />
                  <Field label={t('ativoFicha.observacoes')} value={ativo.descricao} full />
                </Section>
              </TabsContent>

              <TabsContent value="riscos">
                {loadingRiscos ? <div className="flex justify-center py-10"><AkurisPulse /></div> : !riscos?.length ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">{t('ativoFicha.semRiscos')}</p>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                    {riscos.map((r: any) => (
                      <li key={r.id}>
                        <button type="button" onClick={() => navigate(`/riscos?risco=${r.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50">
                          <IconShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-mono text-xs text-muted-foreground">{r.codigo}</span>
                          <span className="flex-1 font-medium">{r.nome}</span>
                          {r.severidade_efetiva && <StatusBadge {...resolveCriticidadeTone(r.severidade_efetiva)}>{r.nivel_risco_inicial ?? r.severidade_efetiva}</StatusBadge>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="manutencoes">
                {loadingMan ? <div className="flex justify-center py-10"><AkurisPulse /></div> : !manutencoes?.length ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">{t('ativoFicha.semManutencoes')}</p>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                    {manutencoes.map((m: any) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <span className="font-medium">{m.titulo ?? m.descricao ?? formatStatus(m.tipo ?? '')}</span>
                        <span className="text-muted-foreground">{formatDateOnly(m.data_agendada ?? m.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="linha">
                <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-10 text-center">
                  <IconHistory className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('ativoFicha.linhaDesc')}</p>
                  <Button variant="outline" onClick={() => onTrilha(ativo)}>{t('ativoFicha.abrirTrilha')}</Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AtivoFicha;
