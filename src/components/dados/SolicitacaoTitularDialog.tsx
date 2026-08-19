import { useState, useEffect } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseDateForDB, parseDataLocal } from "@/lib/date-utils";
import { prazoResposta } from "@/lib/jurisdicao";
import { useJurisdicao } from "@/hooks/useJurisdicao";
import { tiposSolicitacaoDaJurisdicao, normalizarTipoSolicitacao, rotuloTipoSolicitacao } from "@/lib/direitos-titular";
import { useLanguage } from "@/contexts/LanguageContext";
import { IconCalendar, IconUserCheck } from '@/components/icons';
import { dateFnsLocale, datePattern } from '@/lib/date-utils';
import { opcoesCanalSolicitacao } from '@/lib/canal-solicitacao';
interface SolicitacaoTitularDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  solicitacao?: any;
}

export function SolicitacaoTitularDialog({ isOpen, onClose, onSave, solicitacao }: SolicitacaoTitularDialogProps) {
  const { t } = useLanguage();
  const jurisdicao = useJurisdicao();

  /**
   * O prazo de resposta ao titular é o da lei aplicável: 15 dias na LGPD, 1 mês
   * no RGPD/GDPR. Aqui estavam 15 dias fixos em três sítios, sem olhar a
   * jurisdição — uma empresa europeia abria a solicitação já com metade do
   * prazo que a lei lhe dá, e o número contradizia o KPI "Fora do prazo" do
   * ecrã anterior, que sempre usou `prazoResposta`.
   */
  const prazoLegalPadrao = () => prazoResposta(new Date(), jurisdicao.codigo);


  // Campos separados para dados do titular (mais amigáveis)
  const [titularNome, setTitularNome] = useState("");
  const [titularEmail, setTitularEmail] = useState("");
  const [titularDocumento, setTitularDocumento] = useState("");
  const [titularTelefone, setTitularTelefone] = useState("");
  
  const [formData, setFormData] = useState({
    tipo_solicitacao: "",
    dados_solicitados: "",
    justificativa: "",
    canal_solicitacao: "",
    status: "pendente",
    data_resposta: undefined as Date | undefined,
    prazo_resposta: new Date(),
    responsavel_analise: "",
    observacoes_internas: "",
    resposta_titular: "",
    evidencias_atendimento: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  /**
   * Os direitos são os da lei aplicável. Estavam seis escritos à mão, iguais
   * para toda a gente: faltavam a confirmação de tratamento, a anonimização e
   * a informação sobre partilha (LGPD Art. 18) e sobrava a oposição, que é
   * figura do RGPD. Um valor antigo já gravado continua na lista para não
   * desaparecer ao abrir o registo.
   */
  const tiposDaLei = tiposSolicitacaoDaJurisdicao(jurisdicao.codigo, t);
  const tipoGravado = normalizarTipoSolicitacao(formData.tipo_solicitacao);
  const tiposDisponiveis = tipoGravado && !tiposDaLei.some((d) => d.key === tipoGravado)
    ? [{ key: tipoGravado, label: rotuloTipoSolicitacao(tipoGravado, jurisdicao.codigo, t) }, ...tiposDaLei]
    : tiposDaLei;

  // Carregar dados existentes quando editar
  useEffect(() => {
    if (solicitacao) {
      const dadosTitular = solicitacao.dados_titular || {};
      setTitularNome(dadosTitular.nome || "");
      setTitularEmail(dadosTitular.email || "");
      setTitularDocumento(dadosTitular.documento || "");
      setTitularTelefone(dadosTitular.telefone || "");
      
      setFormData({
        tipo_solicitacao: normalizarTipoSolicitacao(solicitacao.tipo_solicitacao),
        dados_solicitados: solicitacao.dados_solicitados || "",
        justificativa: solicitacao.justificativa || "",
        canal_solicitacao: solicitacao.canal_solicitacao || "",
        status: solicitacao.status || "pendente",
        data_resposta: solicitacao.data_resposta ? new Date(solicitacao.data_resposta) : undefined,
        prazo_resposta: solicitacao.prazo_resposta ? parseDataLocal(solicitacao.prazo_resposta) : prazoLegalPadrao(),
        responsavel_analise: solicitacao.responsavel_analise || "",
        observacoes_internas: solicitacao.observacoes_internas || "",
        resposta_titular: solicitacao.resposta_titular || "",
        evidencias_atendimento: solicitacao.evidencias_atendimento || ""
      });
    } else {
      // Resetar para novo
      setTitularNome("");
      setTitularEmail("");
      setTitularDocumento("");
      setTitularTelefone("");
      setFormData({
        tipo_solicitacao: "",
        dados_solicitados: "",
        justificativa: "",
        canal_solicitacao: "",
        status: "pendente",
        data_resposta: undefined,
        prazo_resposta: prazoLegalPadrao(),
        responsavel_analise: "",
        observacoes_internas: "",
        resposta_titular: "",
        evidencias_atendimento: ""
      });
    }
  }, [solicitacao, isOpen]);

  const handleSave = async () => {
    try {
      setIsLoading(true);
      
      // Validar campos obrigatórios
      if (!formData.tipo_solicitacao) {
        toast({
          title: t('dadosDashboard.solicitacaoTitularDialog.toastCampoObrigatorioTitle'),
          description: t('dadosDashboard.solicitacaoTitularDialog.toastCampoObrigatorioDescription'),
          variant: "destructive"
        });
        return;
      }
      
      if (!titularNome && !titularEmail) {
        toast({
          title: t('dadosDashboard.solicitacaoTitularDialog.toastDadosTitularTitle'),
          description: t('dadosDashboard.solicitacaoTitularDialog.toastDadosTitularDescription'),
          variant: "destructive"
        });
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.empresa_id) {
        throw new Error(t('dadosDashboard.solicitacaoTitularDialog.errorEmpresaNaoEncontrada'));
      }

      // Montar objeto dados_titular a partir dos campos separados
      const dadosTitular = {
        nome: titularNome,
        email: titularEmail,
        documento: titularDocumento,
        telefone: titularTelefone
      };

      const payload = {
        tipo_solicitacao: formData.tipo_solicitacao,
        dados_titular: dadosTitular,
        dados_solicitados: formData.dados_solicitados,
        justificativa: formData.justificativa,
        canal_solicitacao: formData.canal_solicitacao,
        status: formData.status,
        data_resposta: formData.data_resposta ? parseDateForDB(format(formData.data_resposta, 'yyyy-MM-dd')) : null,
        prazo_resposta: parseDateForDB(format(formData.prazo_resposta, 'yyyy-MM-dd')),
        // `responsavel_analise` é `uuid`: um <Select> por escolher guarda ""
        // no estado, e o Postgres recusa com "invalid input syntax for type
        // uuid". Sem responsável escolhido, a solicitação não se gravava.
        responsavel_analise: formData.responsavel_analise || null,
        observacoes_internas: formData.observacoes_internas,
        resposta_titular: formData.resposta_titular,
        evidencias_atendimento: formData.evidencias_atendimento,
        empresa_id: profile.empresa_id
      };

      if (solicitacao?.id) {
        const { error } = await supabase
          .from('dados_solicitacoes_titular')
          .update(payload)
          .eq('id', solicitacao.id);
        
        if (error) throw error;
        toast({ title: t('dadosDashboard.solicitacaoTitularDialog.toastUpdated') });
      } else {
        const { error } = await supabase
          .from('dados_solicitacoes_titular')
          .insert([payload]);
        
        if (error) throw error;
        toast({ title: t('dadosDashboard.solicitacaoTitularDialog.toastCreated') });
      }
      
      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: t('dadosDashboard.solicitacaoTitularDialog.toastErrorTitle'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogShell
        open={isOpen}
        onOpenChange={onClose}
        title={solicitacao?.id ? t('dadosDashboard.solicitacaoTitularDialog.titleEdit') : t('dadosDashboard.solicitacaoTitularDialog.titleNew')}
        icon={IconUserCheck}
        size="lg"
        onSubmit={handleSave}
      >
<div className="grid gap-4 py-4">
          {/* Dados do Titular - Campos separados */}
          <div className="space-y-4 p-4 bg-card rounded-lg border border-border">
            <h3 className="font-medium text-sm text-muted-foreground">{t('dadosDashboard.solicitacaoTitularDialog.sectionTitularTitle')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="titular_nome">{t('dadosDashboard.solicitacaoTitularDialog.labelTitularNome')}</Label>
                <Input
                  id="titular_nome"
                  value={titularNome}
                  onChange={(e) => setTitularNome(e.target.value)}
                  placeholder={t('dadosDashboard.solicitacaoTitularDialog.placeholderTitularNome')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="titular_email">{t('dadosDashboard.solicitacaoTitularDialog.labelTitularEmail')}</Label>
                <Input
                  id="titular_email"
                  type="email"
                  value={titularEmail}
                  onChange={(e) => setTitularEmail(e.target.value)}
                  placeholder={t('dadosDashboard.solicitacaoTitularDialog.placeholderTitularEmail')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="titular_documento">{t('dadosDashboard.solicitacaoTitularDialog.labelTitularDocumento')}</Label>
                <Input
                  id="titular_documento"
                  value={titularDocumento}
                  onChange={(e) => setTitularDocumento(e.target.value)}
                  placeholder={t('dadosDashboard.solicitacaoTitularDialog.placeholderTitularDocumento')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="titular_telefone">{t('dadosDashboard.solicitacaoTitularDialog.labelTitularTelefone')}</Label>
                <Input
                  id="titular_telefone"
                  value={titularTelefone}
                  onChange={(e) => setTitularTelefone(e.target.value)}
                  placeholder={t('dadosDashboard.solicitacaoTitularDialog.placeholderTitularTelefone')}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_solicitacao">{t('dadosDashboard.solicitacaoTitularDialog.labelTipoSolicitacao')}</Label>
              <Select value={formData.tipo_solicitacao} onValueChange={(value) => setFormData({ ...formData, tipo_solicitacao: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.solicitacaoTitularDialog.placeholderTipoSolicitacao')} />
                </SelectTrigger>
                <SelectContent>
                  {tiposDisponiveis.map((tipo) => (
                    <SelectItem key={tipo.key} value={tipo.key}>{tipo.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="canal_solicitacao">{t('dadosDashboard.solicitacaoTitularDialog.labelCanalSolicitacao')}</Label>
              <Select value={formData.canal_solicitacao} onValueChange={(value) => setFormData({ ...formData, canal_solicitacao: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.solicitacaoTitularDialog.placeholderCanalSolicitacao')} />
                </SelectTrigger>
                <SelectContent>
                  {opcoesCanalSolicitacao(t).map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dados_solicitados">{t('dadosDashboard.solicitacaoTitularDialog.labelDadosSolicitados')}</Label>
            <Textarea
              id="dados_solicitados"
              value={formData.dados_solicitados}
              onChange={(e) => setFormData({ ...formData, dados_solicitados: e.target.value })}
              placeholder={t('dadosDashboard.solicitacaoTitularDialog.placeholderDadosSolicitados')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="justificativa">{t('dadosDashboard.solicitacaoTitularDialog.labelJustificativa')}</Label>
            <Textarea
              id="justificativa"
              value={formData.justificativa}
              onChange={(e) => setFormData({ ...formData, justificativa: e.target.value })}
              placeholder={t('dadosDashboard.solicitacaoTitularDialog.placeholderJustificativa')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">{t('dadosDashboard.solicitacaoTitularDialog.labelStatus')}</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.solicitacaoTitularDialog.placeholderStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">{t('dadosDashboard.solicitacaoTitularDialog.statusPendente')}</SelectItem>
                  <SelectItem value="em_analise">{t('dadosDashboard.solicitacaoTitularDialog.statusEmAnalise')}</SelectItem>
                  <SelectItem value="atendida">{t('dadosDashboard.solicitacaoTitularDialog.statusAtendida')}</SelectItem>
                  <SelectItem value="rejeitada">{t('dadosDashboard.solicitacaoTitularDialog.statusRejeitada')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('dadosDashboard.solicitacaoTitularDialog.labelPrazoResposta')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <IconCalendar className="mr-2 h-4 w-4" />
                    {format(formData.prazo_resposta, datePattern(), { locale: dateFnsLocale() })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.prazo_resposta}
                    onSelect={(date) => date && setFormData({ ...formData, prazo_resposta: date })}
                    locale={dateFnsLocale()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {(formData.status === "em_analise" || formData.status === "atendida" || formData.status === "rejeitada") && (
            <>
              <div className="space-y-2">
                <Label htmlFor="observacoes_internas">{t('dadosDashboard.solicitacaoTitularDialog.labelObservacoesInternas')}</Label>
                <Textarea
                  id="observacoes_internas"
                  value={formData.observacoes_internas}
                  onChange={(e) => setFormData({ ...formData, observacoes_internas: e.target.value })}
                  placeholder={t('dadosDashboard.solicitacaoTitularDialog.placeholderObservacoesInternas')}
                />
              </div>

              {(formData.status === "atendida" || formData.status === "rejeitada") && (
                <>
                  <div className="space-y-2">
                    <Label>{t('dadosDashboard.solicitacaoTitularDialog.labelDataResposta')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <IconCalendar className="mr-2 h-4 w-4" />
                          {formData.data_resposta ? format(formData.data_resposta, datePattern(), { locale: dateFnsLocale() }) : t('dadosDashboard.solicitacaoTitularDialog.placeholderSelecionarData')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.data_resposta}
                          onSelect={(date) => setFormData({ ...formData, data_resposta: date })}
                          locale={dateFnsLocale()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resposta_titular">{t('dadosDashboard.solicitacaoTitularDialog.labelRespostaTitular')}</Label>
                    <Textarea
                      id="resposta_titular"
                      value={formData.resposta_titular}
                      onChange={(e) => setFormData({ ...formData, resposta_titular: e.target.value })}
                      placeholder={t('dadosDashboard.solicitacaoTitularDialog.placeholderRespostaTitular')}
                    />
                  </div>

                  {formData.status === "atendida" && (
                    <div className="space-y-2">
                      <Label htmlFor="evidencias_atendimento">{t('dadosDashboard.solicitacaoTitularDialog.labelEvidenciasAtendimento')}</Label>
                      <Textarea
                        id="evidencias_atendimento"
                        value={formData.evidencias_atendimento}
                        onChange={(e) => setFormData({ ...formData, evidencias_atendimento: e.target.value })}
                        placeholder={t('dadosDashboard.solicitacaoTitularDialog.placeholderEvidenciasAtendimento')}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        </DialogShell>
  );
}
