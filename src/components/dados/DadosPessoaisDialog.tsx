import { useState, useEffect } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { IconDatabase } from '@/components/icons';
import { useJurisdicao } from "@/hooks/useJurisdicao";

interface DadosPessoaisDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  dados?: any;
}

export function DadosPessoaisDialog({ isOpen, onClose, onSave, dados }: DadosPessoaisDialogProps) {
  const { t } = useLanguage();
  const jurisdicao = useJurisdicao();
  const [formData, setFormData] = useState({
    nome: dados?.nome || "",
    descricao: dados?.descricao || "",
    categoria_dados: dados?.categoria_dados || "",
    tipo_dados: dados?.tipo_dados || "",
    sensibilidade: dados?.sensibilidade || "comum",
    origem_coleta: dados?.origem_coleta || "",
    finalidade_tratamento: dados?.finalidade_tratamento || "",
    base_legal: dados?.base_legal || "",
    prazo_retencao: dados?.prazo_retencao || "",
    forma_coleta: dados?.forma_coleta || "",
    observacoes: dados?.observacoes || ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  /**
   * A lei separa as bases por sensibilidade: dado sensível tem lista própria
   * e mais curta. A lista era única e fixa, o que permitia gravar biometria
   * com base em legítimo interesse — hipótese que a LGPD não admite para dado
   * sensível (Art. 11) nem o RGPD para categoria especial (Art. 9).
   */
  const basesLegaisDaLei = jurisdicao.basesLegais(formData.sensibilidade);

  /**
   * Um valor já gravado que a lei não admite continua na lista, marcado.
   * Apagá-lo ao abrir esconderia do utilizador exactamente o problema que ele
   * precisa de ver — e um registo que ele nunca reviu passaria a parecer
   * apenas "por preencher".
   */
  const baseGravadaForaDaLista =
    formData.base_legal && !basesLegaisDaLei.some((b) => b.key === formData.base_legal)
      ? formData.base_legal
      : null;

  const basesDisponiveis = baseGravadaForaDaLista
    ? [
        {
          key: baseGravadaForaDaLista,
          label: `${jurisdicao.baseLegal(baseGravadaForaDaLista, formData.sensibilidade).label} — ${t('dadosDashboard.dadosPessoaisDialog.baseLegalNaoAdmitida')}`,
        },
        ...basesLegaisDaLei,
      ]
    : basesLegaisDaLei;

  /**
   * Trocar a sensibilidade pode invalidar a base já escolhida — mas só quando
   * é o UTILIZADOR a trocar. Fazer isto num efeito sobre `formData` não
   * distingue essa troca do recarregamento do formulário quando se abre outro
   * registo, e a primeira versão apagava a base gravada só por abrir a
   * biometria para revisão. No handler não há essa ambiguidade.
   */
  const trocarSensibilidade = (valor: string) => {
    const permitidas = jurisdicao.basesLegais(valor).map((b) => b.key);
    setFormData((f) => ({
      ...f,
      sensibilidade: valor,
      base_legal: f.base_legal && !permitidas.includes(f.base_legal) ? '' : f.base_legal,
    }));
  };

  useEffect(() => {
    setFormData({
      nome: dados?.nome || "",
      descricao: dados?.descricao || "",
      categoria_dados: dados?.categoria_dados || "",
      tipo_dados: dados?.tipo_dados || "",
      sensibilidade: dados?.sensibilidade || "comum",
      origem_coleta: dados?.origem_coleta || "",
      finalidade_tratamento: dados?.finalidade_tratamento || "",
      base_legal: dados?.base_legal || "",
      prazo_retencao: dados?.prazo_retencao || "",
      forma_coleta: dados?.forma_coleta || "",
      observacoes: dados?.observacoes || ""
    });
  }, [dados]);

  const handleSave = async () => {
    try {
      setIsLoading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.empresa_id) {
        throw new Error(t('dadosDashboard.common.errorEmpresaNaoEncontrada'));
      }

      const payload = {
        ...formData,
        empresa_id: profile.empresa_id,
        ...(dados?.id ? {} : { created_by: (await supabase.auth.getUser()).data.user?.id })
      };

      if (dados?.id) {
        const { error } = await supabase
          .from('dados_pessoais')
          .update(payload)
          .eq('id', dados.id);
        
        if (error) throw error;
        toast({ title: t('dadosDashboard.dadosPessoaisDialog.toastUpdated') });
      } else {
        const { error } = await supabase
          .from('dados_pessoais')
          .insert([payload]);
        
        if (error) throw error;
        toast({ title: t('dadosDashboard.dadosPessoaisDialog.toastCreated') });
      }
      
      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: t('dadosDashboard.dadosPessoaisDialog.toastErrorTitle'),
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
        title={dados?.id ? t('dadosDashboard.dadosPessoaisDialog.titleEdit') : t('dadosDashboard.dadosPessoaisDialog.titleNew')}
        icon={IconDatabase}
        size="lg"
        /* `isSubmitting`: sem isto o botao nunca se desligava e um
           duplo-clique gravava duas linhas. O estado ja existia — so
           nao chegava ao rodape que sabe usa-lo. */
        onSubmit={handleSave}
        isSubmitting={isLoading}
      >
<div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">{t('dadosDashboard.dadosPessoaisDialog.labelNome')}</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder={t('dadosDashboard.dadosPessoaisDialog.placeholderNome')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria_dados">{t('dadosDashboard.dadosPessoaisDialog.labelCategoria')}</Label>
              <Select value={formData.categoria_dados} onValueChange={(value) => setFormData({ ...formData, categoria_dados: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.dadosPessoaisDialog.placeholderCategoria')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="identificacao">{t('dadosDashboard.dadosPessoaisDialog.categoriaIdentificacao')}</SelectItem>
                  <SelectItem value="contato">{t('dadosDashboard.dadosPessoaisDialog.categoriaContato')}</SelectItem>
                  <SelectItem value="localizacao">{t('dadosDashboard.dadosPessoaisDialog.categoriaLocalizacao')}</SelectItem>
                  <SelectItem value="financeiro">{t('dadosDashboard.dadosPessoaisDialog.categoriaFinanceiro')}</SelectItem>
                  <SelectItem value="saude">{t('dadosDashboard.dadosPessoaisDialog.categoriaSaude')}</SelectItem>
                  <SelectItem value="biometrico">{t('dadosDashboard.dadosPessoaisDialog.categoriaBiometrico')}</SelectItem>
                  <SelectItem value="profissional">{t('dadosDashboard.dadosPessoaisDialog.categoriaProfissional')}</SelectItem>
                  <SelectItem value="comportamental">{t('dadosDashboard.dadosPessoaisDialog.categoriaComportamental')}</SelectItem>
                  <SelectItem value="outros">{t('dadosDashboard.dadosPessoaisDialog.categoriaOutros')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_dados">{t('dadosDashboard.dadosPessoaisDialog.labelTipoDados')}</Label>
              <Select value={formData.tipo_dados} onValueChange={(value) => setFormData({ ...formData, tipo_dados: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.dadosPessoaisDialog.placeholderTipoDados')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comum">{t('dadosDashboard.dadosPessoaisDialog.tipoComum')}</SelectItem>
                  <SelectItem value="sensivel">{t('dadosDashboard.dadosPessoaisDialog.tipoSensivel')}</SelectItem>
                  <SelectItem value="infantil">{t('dadosDashboard.dadosPessoaisDialog.tipoInfantil')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sensibilidade">{t('dadosDashboard.dadosPessoaisDialog.labelSensibilidade')}</Label>
              <Select value={formData.sensibilidade} onValueChange={trocarSensibilidade}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.dadosPessoaisDialog.placeholderSensibilidade')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comum">{t('dadosDashboard.dadosPessoaisDialog.sensibilidadeComum')}</SelectItem>
                  <SelectItem value="sensivel">{t('dadosDashboard.dadosPessoaisDialog.sensibilidadeSensivel')}</SelectItem>
                  <SelectItem value="muito_sensivel">{t('dadosDashboard.dadosPessoaisDialog.sensibilidadeMuitoSensivel')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">{t('dadosDashboard.dadosPessoaisDialog.labelDescricao')}</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder={t('dadosDashboard.dadosPessoaisDialog.placeholderDescricao')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origem_coleta">{t('dadosDashboard.dadosPessoaisDialog.labelOrigemColeta')}</Label>
              <Select value={formData.origem_coleta} onValueChange={(value) => setFormData({ ...formData, origem_coleta: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.dadosPessoaisDialog.placeholderOrigemColeta')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formulario_web">{t('dadosDashboard.dadosPessoaisDialog.origemFormularioWeb')}</SelectItem>
                  <SelectItem value="sistema_interno">{t('dadosDashboard.dadosPessoaisDialog.origemSistemaInterno')}</SelectItem>
                  <SelectItem value="terceiros">{t('dadosDashboard.dadosPessoaisDialog.origemTerceiros')}</SelectItem>
                  <SelectItem value="publico">{t('dadosDashboard.dadosPessoaisDialog.origemPublico')}</SelectItem>
                  <SelectItem value="diretamente_titular">{t('dadosDashboard.dadosPessoaisDialog.origemDiretamenteTitular')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="forma_coleta">{t('dadosDashboard.dadosPessoaisDialog.labelFormaColeta')}</Label>
              <Select value={formData.forma_coleta} onValueChange={(value) => setFormData({ ...formData, forma_coleta: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.dadosPessoaisDialog.placeholderFormaColeta')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatica">{t('dadosDashboard.dadosPessoaisDialog.formaAutomatica')}</SelectItem>
                  <SelectItem value="manual">{t('dadosDashboard.dadosPessoaisDialog.formaManual')}</SelectItem>
                  <SelectItem value="importacao">{t('dadosDashboard.dadosPessoaisDialog.formaImportacao')}</SelectItem>
                  <SelectItem value="integracao">{t('dadosDashboard.dadosPessoaisDialog.formaIntegracao')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="finalidade_tratamento">{t('dadosDashboard.dadosPessoaisDialog.labelFinalidadeTratamento')}</Label>
            <Textarea
              id="finalidade_tratamento"
              value={formData.finalidade_tratamento}
              onChange={(e) => setFormData({ ...formData, finalidade_tratamento: e.target.value })}
              placeholder={t('dadosDashboard.dadosPessoaisDialog.placeholderFinalidadeTratamento')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base_legal">{t('dadosDashboard.dadosPessoaisDialog.labelBaseLegal')}</Label>
              <Select value={formData.base_legal} onValueChange={(value) => setFormData({ ...formData, base_legal: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.dadosPessoaisDialog.placeholderBaseLegal')} />
                </SelectTrigger>
                <SelectContent>
                  {basesDisponiveis.map((base) => (
                    <SelectItem key={base.key} value={base.key}>{base.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prazo_retencao">{t('dadosDashboard.dadosPessoaisDialog.labelPrazoRetencao')}</Label>
              <Input
                id="prazo_retencao"
                value={formData.prazo_retencao}
                onChange={(e) => setFormData({ ...formData, prazo_retencao: e.target.value })}
                placeholder={t('dadosDashboard.dadosPessoaisDialog.placeholderPrazoRetencao')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">{t('dadosDashboard.dadosPessoaisDialog.labelObservacoes')}</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder={t('dadosDashboard.dadosPessoaisDialog.placeholderObservacoes')}
            />
          </div>
        </div>

        </DialogShell>
  );
}
