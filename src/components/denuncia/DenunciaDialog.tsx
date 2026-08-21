/**
 * DenunciaDialog — a ficha de uma denúncia, do lado de quem a apura.
 *
 * Três correcções de fundo em relação ao que estava:
 *
 * 1. **O campo «Observações da Movimentação» saía para fora.** O texto que o
 *    investigador escrevia ali era devolvido pela consulta pública e impresso
 *    na tela de quem denunciou. Deixou de haver campo de notas neste
 *    formulário: a deliberação escreve-se na aba Apuração, que nasce interna e
 *    diz, em cada linha, se é interna ou partilhada.
 *
 * 2. **O responsável era escolhido entre administradores.** Mas quem tem
 *    acesso à denúncia é o COMITÉ (`pode_ver_denuncia`). Atribuir a um
 *    administrador de fora do comité criava um responsável que via o caso por
 *    ser responsável, sem nunca ter sido nomeado para o canal — e a lista
 *    escondia os membros do comité que não fossem administradores.
 *
 * 3. **Faltava a resposta ao que importa antes de abrir uma aba.** Estado,
 *    responsável, prazo e desfecho estavam espalhados por dentro das abas.
 *    Agora estão no topo, sempre visíveis.
 */
import { useState, useEffect } from 'react';
import {
  IconCalendar,
  IconPerson,
  IconMail,
  IconShield,
  IconSave,
  IconLock,
} from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveGravidadeTone, resolveDenunciaStatusTone } from '@/lib/status-tone';
import { severidadeDeFaixas } from '@/lib/metrics/riscos';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { formatDateOnly } from '@/lib/date-utils';
import { useIntegrationNotify } from '@/hooks/useIntegrationNotify';
import { useLanguage } from '@/contexts/LanguageContext';
import { DenunciaConversa } from './DenunciaConversa';
import { DenunciaRelogio } from './DenunciaRelogio';
import { DenunciaApuracao } from './DenunciaApuracao';
import { DenunciaReunioes } from './DenunciaReunioes';
import { DenunciaAnexos } from './DenunciaAnexos';
import { DenunciaConverter } from './DenunciaConverter';

interface DenunciaDialogProps {
  denuncia: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDenunciaAtualizada: () => void;
}

function getStatusOptions(t: (k: string) => string) {
  return [
    { value: 'nova', label: t('denunciasAdmin.dialog.statusNova') },
    { value: 'em_analise', label: t('denunciasAdmin.dialog.statusEmAnalise') },
    { value: 'em_investigacao', label: t('denunciasAdmin.dialog.statusEmInvestigacao') },
    { value: 'resolvida', label: t('denunciasAdmin.dialog.statusResolvida') },
    { value: 'arquivada', label: t('denunciasAdmin.dialog.statusArquivada') }
  ];
}

export function DenunciaDialog({
  denuncia,
  open,
  onOpenChange,
  onDenunciaAtualizada
}: DenunciaDialogProps) {
  const { t } = useLanguage();
  const statusOptions = getStatusOptions(t);
  const [comite, setComite] = useState<{ user_id: string; nome: string; papel: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { notify } = useIntegrationNotify();
  const { empresaId } = useEmpresaId();

  const [formData, setFormData] = useState({
    status: denuncia.status,
    responsavel_id: denuncia.responsavel_id || '',
    parecer_final: denuncia.parecer_final || '',
    resultado: denuncia.resultado || '',
    medidas_adotadas: denuncia.medidas_adotadas || '',
  });

  /*
    `empresaId` chega depois do primeiro render.

    Sem ele na lista de dependências, o efeito corria uma vez com `undefined`,
    o bloco do comité era saltado, e a ficha dizia «nenhum membro no comité» a
    uma empresa que tem comité — mandando quem apura configurar o que já
    estava configurado.
  */
  useEffect(() => {
    if (open && denuncia && empresaId) {
      carregarDados();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, denuncia?.id, empresaId]);

  const carregarDados = async () => {
    try {
      /*
        Quem pode ficar responsável é quem já tem acesso: o comité.

        Isto era uma lista de `profiles` com papel de administrador. Um
        administrador que não esteja no comité não devia ver esta denúncia —
        e passava a ver, por ter sido nomeado responsável a partir de uma
        lista onde nunca devia ter aparecido.
      */
      if (empresaId) {
        const { data: membros } = await supabase
          .from('denuncias_comite')
          .select('user_id, papel')
          .eq('empresa_id', empresaId);

        if (membros?.length) {
          const { data: perfis } = await supabase
            .from('profiles')
            .select('user_id, nome')
            .in('user_id', membros.map((m) => m.user_id));

          setComite(
            membros.map((m) => ({
              user_id: m.user_id,
              papel: m.papel,
              nome: perfis?.find((p) => p.user_id === m.user_id)?.nome ?? '',
            })),
          );
        } else {
          setComite([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleSalvar = async () => {
    setSaving(true);
    try {
      const statusAnterior = denuncia.status;
      const statusNovo = formData.status;

      const updateData: any = {
        status: formData.status,
        responsavel_id: formData.responsavel_id || null,
        parecer_final: formData.parecer_final,
        resultado: formData.resultado || null,
        medidas_adotadas: formData.medidas_adotadas || null,
      };

      /* O parecer ganha data quando ganha desfecho: é o carimbo que a
         auditoria procura, e antes não existia. */
      if (formData.resultado && !denuncia.data_parecer) {
        updateData.data_parecer = new Date().toISOString();
      }

      // Definir datas baseadas no status
      if (statusNovo === 'em_analise' && statusAnterior === 'nova') {
        updateData.data_atribuicao = new Date().toISOString();
      }
      if (statusNovo === 'em_investigacao' && statusAnterior !== 'em_investigacao') {
        updateData.data_inicio_investigacao = new Date().toISOString();
      }
      if (['resolvida', 'arquivada'].includes(statusNovo) && !['resolvida', 'arquivada'].includes(statusAnterior)) {
        updateData.data_conclusao = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('denuncias')
        .update(updateData)
        .eq('id', denuncia.id);

      if (updateError) throw updateError;

      /*
        A mudança de estado entra na trilha assinada por quem a fez. O texto
        fica de fora de propósito: a nota vive na aba Apuração, onde se decide
        linha a linha se sai do comité.
      */
      if (statusAnterior !== statusNovo) {
        const { data: sessao } = await supabase.auth.getUser();
        const { error: movError } = await supabase
          .from('denuncias_movimentacoes')
          .insert({
            denuncia_id: denuncia.id,
            acao: 'status_alterado',
            status_anterior: statusAnterior,
            status_novo: statusNovo,
            visibilidade: 'publica',
            usuario_id: sessao?.user?.id ?? null,
          });

        if (movError) throw movError;
      }

      // Notificar integrações externas sobre atualização da denúncia
      try {
        await notify('denuncia_recebida', {
          titulo: `Denúncia ${denuncia.protocolo} atualizada para ${statusNovo}`,
          descricao: `A denúncia "${denuncia.titulo}" teve seu status alterado de ${statusAnterior} para ${statusNovo}.`,
          link: `${window.location.origin}/denuncia`,
          gravidade: denuncia.gravidade === 'critico' ? 'critica' : denuncia.gravidade === 'alto' ? 'alta' : 'media',
          dados: { protocolo: denuncia.protocolo, status_anterior: statusAnterior, status_novo: statusNovo }
        });
      } catch (notifyErr) {
        console.error('Erro ao notificar integrações:', notifyErr);
      }

      toast({
        title: t('denunciasAdmin.dialog.updated'),
        description: t('denunciasAdmin.dialog.updated')
      });

      onDenunciaAtualizada();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: t('denunciasAdmin.dialog.errorUpdate'),
        description: t('denunciasAdmin.dialog.errorUpdate'),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const datePart = formatDateOnly(dateString);
    const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  };

  /*
    O mapa estava na grafia feminina — baixa/media/alta/critica — e o
    vocabulário canónico do produto é baixo/medio/alto/critico. Nenhuma chave
    batia: a ficha mostrava «medio» em minúsculas, o valor cru da base.
  */
  const gravidadeLabel: Record<string, string> = {
    baixo: t('denunciasAdmin.dialog.gravidadeBaixa'),
    medio: t('denunciasAdmin.dialog.gravidadeMedia'),
    alto: t('denunciasAdmin.dialog.gravidadeAlta'),
    critico: t('denunciasAdmin.dialog.gravidadeCritica'),
  };

  const nivel: string = denuncia.nivel_identificacao ?? (denuncia.anonima ? 'anonima' : 'identificada');
  const responsavelNome = comite.find((c) => c.user_id === denuncia.responsavel_id)?.nome;

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('denunciasAdmin.dialog.title', { protocolo: denuncia.protocolo })}
      description={t('denunciasAdmin.dialog.description')}
      icon={IconShield}
      size="lg"
      hideFooter
      disableShortcuts
    >
        {/*
          O resumo antes das abas.

          Quem abre esta ficha quer responder a quatro perguntas antes de
          decidir onde clicar: em que pé está, de quem é, quando vence e como
          acabou. Estavam em três abas diferentes.
        */}
        <dl className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          {[
            {
              rotulo: t('denunciasAdmin.dialog.resumoEstado'),
              valor: (
                <StatusBadge {...resolveDenunciaStatusTone(denuncia.status)}>
                  {statusOptions.find((s) => s.value === denuncia.status)?.label ?? denuncia.status}
                </StatusBadge>
              ),
            },
            {
              rotulo: t('denunciasAdmin.dialog.resumoResponsavel'),
              valor: (
                <span className="text-sm text-foreground">
                  {responsavelNome || t('denunciasAdmin.dialog.semResponsavel')}
                </span>
              ),
            },
            {
              rotulo: t('denunciasAdmin.dialog.resumoPrazo'),
              valor: (
                <span className="text-sm tabular-nums text-foreground">
                  {denuncia.prazo_retorno ? formatDateOnly(denuncia.prazo_retorno) : '—'}
                </span>
              ),
            },
            {
              rotulo: t('denunciasAdmin.dialog.resumoDesfecho'),
              valor: (
                <span className="text-sm text-foreground">
                  {denuncia.resultado
                    ? t(`denunciasAdmin.dialog.resultado${resultadoEmChave(denuncia.resultado)}`)
                    : t('denunciasAdmin.dialog.resultadoPendente')}
                </span>
              ),
            },
          ].map((item) => (
            <div key={item.rotulo} className="bg-card px-3 py-2.5">
              <dt className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
                {item.rotulo}
              </dt>
              <dd className="mt-1">{item.valor}</dd>
            </div>
          ))}
        </dl>

        {/* Quem pediu reserva de identidade pediu-a por escrito. Diz-se aqui. */}
        {nivel === 'confidencial' && (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
            <IconLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.5} />
            <span>
              <span className="font-semibold text-foreground">
                {t('denunciasAdmin.dialog.confidencialTitulo')}{' '}
              </span>
              {t('denunciasAdmin.dialog.confidencialTexto')}
            </span>
          </p>
        )}

        <Tabs defaultValue="detalhes">
          <TabsList>
            <TabsTrigger value="detalhes">{t('denunciasAdmin.dialog.tabDetalhes')}</TabsTrigger>
            <TabsTrigger value="tratamento">{t('denunciasAdmin.dialog.tabTratamento')}</TabsTrigger>
            <TabsTrigger value="apuracao">{t('denunciasAdmin.dialog.tabApuracao')}</TabsTrigger>
            <TabsTrigger value="conversa">{t('denunciasAdmin.dialog.tabConversa')}</TabsTrigger>
            <TabsTrigger value="reunioes">{t('denunciasAdmin.dialog.tabReunioes')}</TabsTrigger>
            <TabsTrigger value="anexos">{t('denunciasAdmin.dialog.tabAnexos')}</TabsTrigger>
          </TabsList>

          {/* Tab Detalhes */}
          <TabsContent value="detalhes" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{t('denunciasAdmin.dialog.infoTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{t('denunciasAdmin.dialog.labelProtocolo')}</Label>
                    <div className="font-mono text-sm">{denuncia.protocolo}</div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{t('denunciasAdmin.dialog.labelTitulo')}</Label>
                    <div className="text-sm">{denuncia.titulo}</div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{t('denunciasAdmin.dialog.labelGravidade')}</Label>
                    <div>
                      <StatusBadge {...resolveGravidadeTone(denuncia.gravidade)}>
                        {gravidadeLabel[severidadeDeFaixas(denuncia.gravidade)] || denuncia.gravidade}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{t('denunciasAdmin.dialog.labelDataDenuncia')}</Label>
                    <div className="flex items-center gap-1 text-sm">
                      <IconCalendar className="h-4 w-4" />
                      {formatDateTime(denuncia.created_at)}
                    </div>
                  </div>

                  {denuncia.categoria && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t('denunciasAdmin.dialog.labelCategoria')}</Label>
                      <div>
                        <Badge variant="outline" style={{ borderColor: denuncia.categoria.cor }}>
                          {denuncia.categoria.nome}
                        </Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{t('denunciasAdmin.dialog.denuncianteTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      {t('denunciasAdmin.dialog.labelNivel')}
                    </Label>
                    <div>
                      <Badge variant="secondary">{t(`denunciasAdmin.dialog.nivel.${nivel}`)}</Badge>
                    </div>
                    <p className="text-micro leading-relaxed text-muted-foreground">
                      {t(`denunciasAdmin.dialog.nivelAjuda.${nivel}`)}
                    </p>
                  </div>

                  {nivel !== 'anonima' && (
                    <>
                      {denuncia.nome_denunciante && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t('denunciasAdmin.dialog.labelNome')}</Label>
                          <div className="flex items-center gap-2 text-sm">
                            <IconPerson className="h-4 w-4" />
                            {denuncia.nome_denunciante}
                          </div>
                        </div>
                      )}

                      {denuncia.email_denunciante && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t('denunciasAdmin.dialog.labelEmail')}</Label>
                          <div className="flex items-center gap-2 text-sm">
                            <IconMail className="h-4 w-4" />
                            {denuncia.email_denunciante}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {denuncia.ip_origem && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t('denunciasAdmin.dialog.labelIp')}</Label>
                      <div className="font-mono text-sm">{denuncia.ip_origem}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('denunciasAdmin.dialog.descriptionTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg">
                  {denuncia.descricao}
                </div>

                {/* O que a apuração precisa e ninguém mostrava na ficha. */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['labelLocal', denuncia.local_ocorrencia],
                    ['labelDataOcorrencia', denuncia.data_ocorrencia ? formatDateOnly(denuncia.data_ocorrencia) : null],
                    ['labelTestemunhas', denuncia.testemunhas],
                    ['labelEvidencias', denuncia.evidencias_descricao],
                  ]
                    .filter(([, valor]) => !!valor)
                    .map(([chave, valor]) => (
                      <div key={String(chave)} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {t(`denunciasAdmin.dialog.${chave}`)}
                        </Label>
                        <p className="whitespace-pre-wrap text-sm text-foreground">{valor}</p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Tratamento */}
          <TabsContent value="tratamento" className="space-y-4">
            {/* O relógio primeiro: é o que tem prazo legal a correr. */}
            <DenunciaRelogio denuncia={denuncia} onAtualizado={onDenunciaAtualizada} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">{t('denunciasAdmin.dialog.labelStatus')}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="responsavel">{t('denunciasAdmin.dialog.labelResponsavel')}</Label>
                <Select
                  value={formData.responsavel_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, responsavel_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('denunciasAdmin.dialog.placeholderResponsavel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {comite.map((membro) => (
                      <SelectItem key={membro.user_id} value={membro.user_id}>
                        {membro.nome || membro.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-micro text-muted-foreground">
                  {comite.length === 0
                    ? t('denunciasAdmin.dialog.comiteVazio')
                    : t('denunciasAdmin.dialog.responsavelAjuda')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {/*
                O desfecho, em campo próprio.

                O parecer era só texto solto: não dava para contar quantas
                denúncias foram procedentes, que é a primeira pergunta de
                qualquer auditoria ao canal.
              */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="resultado">{t('denunciasAdmin.dialog.labelResultado')}</Label>
                  <Select
                    value={formData.resultado || 'sem_resultado'}
                    onValueChange={(v) =>
                      setFormData({ ...formData, resultado: v === 'sem_resultado' ? '' : v })
                    }
                  >
                    <SelectTrigger id="resultado">
                      <SelectValue placeholder={t('denunciasAdmin.dialog.placeholderResultado')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem_resultado">{t('denunciasAdmin.dialog.resultadoPendente')}</SelectItem>
                      <SelectItem value="procedente">{t('denunciasAdmin.dialog.resultadoProcedente')}</SelectItem>
                      <SelectItem value="parcialmente_procedente">{t('denunciasAdmin.dialog.resultadoParcial')}</SelectItem>
                      <SelectItem value="improcedente">{t('denunciasAdmin.dialog.resultadoImprocedente')}</SelectItem>
                      <SelectItem value="inconclusiva">{t('denunciasAdmin.dialog.resultadoInconclusiva')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medidas">{t('denunciasAdmin.dialog.labelMedidas')}</Label>
                  <Input
                    id="medidas"
                    value={formData.medidas_adotadas || ''}
                    onChange={(e) => setFormData({ ...formData, medidas_adotadas: e.target.value })}
                    placeholder={t('denunciasAdmin.dialog.placeholderMedidas')}
                  />
                </div>
              </div>

              <Label htmlFor="parecer">{t('denunciasAdmin.dialog.labelParecerFinal')}</Label>
              <Textarea
                id="parecer"
                value={formData.parecer_final}
                onChange={(e) => setFormData(prev => ({ ...prev, parecer_final: e.target.value }))}
                placeholder={t('denunciasAdmin.dialog.placeholderParecerFinal')}
                rows={4}
              />
              <p className="flex items-start gap-1.5 text-micro text-muted-foreground">
                <IconLock className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.5} />
                {t('denunciasAdmin.dialog.parecerInterno')}
              </p>
            </div>

            {/* O que a denúncia gera no resto do GRC. Fica depois do desfecho
                porque é dele que decorre: converte-se o que ficou provado. */}
            <DenunciaConverter denuncia={denuncia} onAtualizado={onDenunciaAtualizada} />

            <div className="flex justify-end">
              <Button onClick={handleSalvar} disabled={saving}>
                <IconSave className="w-4 h-4 mr-2" />
                {saving ? t('denunciasAdmin.dialog.saving') : t('denunciasAdmin.dialog.saveChanges')}
              </Button>
            </div>
          </TabsContent>

          {/* Tab Apuração — a trilha com autor, e o sítio onde se opina. */}
          <TabsContent value="apuracao" className="space-y-4">
            <DenunciaApuracao
              denunciaId={denuncia.id}
              status={denuncia.status}
              onAtualizado={onDenunciaAtualizada}
            />
          </TabsContent>

          <TabsContent value="conversa" className="space-y-4">
            <DenunciaConversa denunciaId={denuncia.id} empresaId={denuncia.empresa_id} />
          </TabsContent>

          <TabsContent value="reunioes" className="space-y-4">
            <DenunciaReunioes
              denunciaId={denuncia.id}
              empresaId={denuncia.empresa_id}
              status={denuncia.status}
              onAtualizado={onDenunciaAtualizada}
            />
          </TabsContent>

          <TabsContent value="anexos" className="space-y-4">
            <DenunciaAnexos
              denunciaId={denuncia.id}
              empresaId={denuncia.empresa_id}
              status={denuncia.status}
              onAtualizado={onDenunciaAtualizada}
            />
          </TabsContent>
        </Tabs>
    </DialogShell>
  );
}

/** `parcialmente_procedente` → `Parcial`, para casar com as chaves existentes. */
function resultadoEmChave(resultado: string): string {
  if (resultado === 'parcialmente_procedente') return 'Parcial';
  return resultado.charAt(0).toUpperCase() + resultado.slice(1);
}
