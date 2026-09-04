import { useEffect, useMemo, useState } from 'react';
import { ContinuidadeIcon, IconAdd, IconDelete, IconOrg, IconSave, IconTarget, IconUsers } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ModuleBanner } from '@/components/ui/module-banner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProcessoCritico {
  id: string;
  nome: string;
  responsavel: string;
  impacto: string;
  mtpd_horas: string;
  rto_horas: string;
  rpo_horas: string;
  dependencias: string;
  operacao_minima: string;
}

interface MembroCrise {
  id: string;
  nome: string;
  papel: string;
  contato: string;
  substituto: string;
}

const novoProcesso = (): ProcessoCritico => ({
  id: crypto.randomUUID(), nome: '', responsavel: '', impacto: 'alto', mtpd_horas: '',
  rto_horas: '', rpo_horas: '', dependencias: '', operacao_minima: '',
});

const novoMembro = (): MembroCrise => ({
  id: crypto.randomUUID(), nome: '', papel: '', contato: '', substituto: '',
});

export function PreparacaoContinuidade({ plano, onSuccess }: { plano: any; onSuccess?: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [processos, setProcessos] = useState<ProcessoCritico[]>([]);
  const [equipe, setEquipe] = useState<MembroCrise[]>([]);
  const [criterios, setCriterios] = useState('');
  const [estrategia, setEstrategia] = useState('');
  const [comunicacao, setComunicacao] = useState('');
  const [runbook, setRunbook] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProcessos(Array.isArray(plano?.processos_criticos) ? plano.processos_criticos : []);
    setEquipe(Array.isArray(plano?.equipe_crise) ? plano.equipe_crise : []);
    setCriterios(plano?.criterios_ativacao || '');
    setEstrategia(plano?.estrategia_recuperacao || '');
    setComunicacao(plano?.plano_comunicacao || '');
    setRunbook(plano?.runbook || '');
  }, [plano?.id]);

  const completude = useMemo(() => {
    const processosValidos = processos.length > 0 && processos.every((p) => p.nome && p.mtpd_horas && p.rto_horas);
    const itens = [processosValidos, !!estrategia.trim(), !!criterios.trim(), !!comunicacao.trim(), !!runbook.trim(), equipe.length > 0];
    return Math.round((itens.filter(Boolean).length / itens.length) * 100);
  }, [processos, equipe, criterios, estrategia, comunicacao, runbook]);

  const atualizarProcesso = (id: string, campo: keyof ProcessoCritico, valor: string) =>
    setProcessos((atuais) => atuais.map((p) => p.id === id ? { ...p, [campo]: valor } : p));
  const atualizarMembro = (id: string, campo: keyof MembroCrise, valor: string) =>
    setEquipe((atual) => atual.map((m) => m.id === id ? { ...m, [campo]: valor } : m));

  const salvar = async () => {
    if (processos.some((p) => !p.nome.trim())) {
      toast({ title: t('continuidadeComp.preparacao.processNameRequired'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('continuidade_planos' as any)
        .update({
          processos_criticos: processos,
          equipe_crise: equipe,
          criterios_ativacao: criterios.trim() || null,
          estrategia_recuperacao: estrategia.trim() || null,
          plano_comunicacao: comunicacao.trim() || null,
          runbook: runbook.trim() || null,
          bia_revisada_em: new Date().toISOString(),
        })
        .eq('id', plano.id);
      if (error) throw error;
      toast({ title: t('continuidadeComp.preparacao.saved') });
      onSuccess?.();
    } catch (error) {
      toast({
        title: t('continuidadeComp.preparacao.saveError'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <ModuleBanner icon={ContinuidadeIcon} className="bg-primary/[0.03]" contentClassName="space-y-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{t('continuidadeComp.preparacao.readiness')}</p>
              <p className="text-sm text-muted-foreground">{t('continuidadeComp.preparacao.readinessHint')}</p>
            </div>
            <span className="text-lg font-semibold tabular-nums">{completude}%</span>
          </div>
          <Progress value={completude} aria-label={t('continuidadeComp.preparacao.readiness')} />
      </ModuleBanner>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-semibold"><IconOrg className="h-4 w-4" />{t('continuidadeComp.preparacao.processes')}</h3>
            <p className="text-sm text-muted-foreground">{t('continuidadeComp.preparacao.processesHint')}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setProcessos((p) => [...p, novoProcesso()])}>
            <IconAdd className="mr-2 h-4 w-4" />{t('continuidadeComp.preparacao.addProcess')}
          </Button>
        </div>
        {processos.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('continuidadeComp.preparacao.emptyProcesses')}</CardContent></Card>
        ) : processos.map((processo, index) => (
          <Card key={processo.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm">{t('continuidadeComp.preparacao.processNumber', { number: index + 1 })}</CardTitle>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t('fin.comum.excluir')} onClick={() => setProcessos((p) => p.filter((item) => item.id !== processo.id))}>
                <IconDelete className="h-4 w-4 text-destructive" />
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5 lg:col-span-2"><Label htmlFor={`processo-${processo.id}-nome`}>{t('continuidadeComp.preparacao.processName')}</Label><Input id={`processo-${processo.id}-nome`} value={processo.nome} onChange={(e) => atualizarProcesso(processo.id, 'nome', e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor={`processo-${processo.id}-responsavel`}>{t('continuidadeComp.preparacao.owner')}</Label><Input id={`processo-${processo.id}-responsavel`} value={processo.responsavel} onChange={(e) => atualizarProcesso(processo.id, 'responsavel', e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor={`processo-${processo.id}-impacto`}>{t('continuidadeComp.preparacao.impact')}</Label><Select value={processo.impacto} onValueChange={(v) => atualizarProcesso(processo.id, 'impacto', v)}><SelectTrigger id={`processo-${processo.id}-impacto`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="moderado">{t('continuidadeComp.preparacao.impactModerate')}</SelectItem><SelectItem value="alto">{t('continuidadeComp.preparacao.impactHigh')}</SelectItem><SelectItem value="critico">{t('continuidadeComp.preparacao.impactCritical')}</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label htmlFor={`processo-${processo.id}-mtpd`}>{t('continuidadeComp.preparacao.mtpd')}</Label><Input id={`processo-${processo.id}-mtpd`} type="number" min="0" value={processo.mtpd_horas} onChange={(e) => atualizarProcesso(processo.id, 'mtpd_horas', e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor={`processo-${processo.id}-rto`}>{t('continuidadeComp.preparacao.rto')}</Label><Input id={`processo-${processo.id}-rto`} type="number" min="0" value={processo.rto_horas} onChange={(e) => atualizarProcesso(processo.id, 'rto_horas', e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor={`processo-${processo.id}-rpo`}>{t('continuidadeComp.preparacao.rpo')}</Label><Input id={`processo-${processo.id}-rpo`} type="number" min="0" value={processo.rpo_horas} onChange={(e) => atualizarProcesso(processo.id, 'rpo_horas', e.target.value)} /></div>
              <div className="space-y-1.5 lg:col-span-2"><Label htmlFor={`processo-${processo.id}-dependencias`}>{t('continuidadeComp.preparacao.dependencies')}</Label><Textarea id={`processo-${processo.id}-dependencias`} rows={2} value={processo.dependencias} onChange={(e) => atualizarProcesso(processo.id, 'dependencias', e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor={`processo-${processo.id}-operacao`}>{t('continuidadeComp.preparacao.minimumOperation')}</Label><Textarea id={`processo-${processo.id}-operacao`} rows={2} value={processo.operacao_minima} onChange={(e) => atualizarProcesso(processo.id, 'operacao_minima', e.target.value)} /></div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <div><h3 className="flex items-center gap-2 font-semibold"><IconTarget className="h-4 w-4" />{t('continuidadeComp.preparacao.responsePlan')}</h3><p className="text-sm text-muted-foreground">{t('continuidadeComp.preparacao.responsePlanHint')}</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="continuidade-estrategia">{t('continuidadeComp.preparacao.strategy')}</Label><Textarea id="continuidade-estrategia" rows={4} value={estrategia} onChange={(e) => setEstrategia(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="continuidade-criterios">{t('continuidadeComp.preparacao.activation')}</Label><Textarea id="continuidade-criterios" rows={4} value={criterios} onChange={(e) => setCriterios(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="continuidade-comunicacao">{t('continuidadeComp.preparacao.communication')}</Label><Textarea id="continuidade-comunicacao" rows={4} value={comunicacao} onChange={(e) => setComunicacao(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="continuidade-runbook">{t('continuidadeComp.preparacao.runbook')}</Label><Textarea id="continuidade-runbook" rows={4} value={runbook} onChange={(e) => setRunbook(e.target.value)} /></div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h3 className="flex items-center gap-2 font-semibold"><IconUsers className="h-4 w-4" />{t('continuidadeComp.preparacao.crisisTeam')}</h3><p className="text-sm text-muted-foreground">{t('continuidadeComp.preparacao.crisisTeamHint')}</p></div>
          <Button type="button" size="sm" variant="outline" onClick={() => setEquipe((e) => [...e, novoMembro()])}><IconAdd className="mr-2 h-4 w-4" />{t('continuidadeComp.preparacao.addMember')}</Button>
        </div>
        {equipe.map((membro) => (
          <Card key={membro.id}><CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <div className="space-y-1.5"><Label htmlFor={`membro-${membro.id}-nome`}>{t('continuidadeComp.preparacao.memberName')}</Label><Input id={`membro-${membro.id}-nome`} value={membro.nome} onChange={(e) => atualizarMembro(membro.id, 'nome', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor={`membro-${membro.id}-papel`}>{t('continuidadeComp.preparacao.role')}</Label><Input id={`membro-${membro.id}-papel`} value={membro.papel} onChange={(e) => atualizarMembro(membro.id, 'papel', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor={`membro-${membro.id}-contato`}>{t('continuidadeComp.preparacao.contact')}</Label><Input id={`membro-${membro.id}-contato`} value={membro.contato} onChange={(e) => atualizarMembro(membro.id, 'contato', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor={`membro-${membro.id}-substituto`}>{t('continuidadeComp.preparacao.backup')}</Label><Input id={`membro-${membro.id}-substituto`} value={membro.substituto} onChange={(e) => atualizarMembro(membro.id, 'substituto', e.target.value)} /></div>
            <Button type="button" variant="ghost" size="icon-sm" className="self-end" aria-label={t('fin.comum.excluir')} onClick={() => setEquipe((e) => e.filter((item) => item.id !== membro.id))}><IconDelete className="h-4 w-4 text-destructive" /></Button>
          </CardContent></Card>
        ))}
      </section>

      <div className="flex justify-end border-t pt-4">
        <Button onClick={salvar} disabled={saving}><IconSave className="mr-2 h-4 w-4" />{saving ? t('continuidadeComp.preparacao.saving') : t('continuidadeComp.preparacao.save')}</Button>
      </div>
    </div>
  );
}
