import { useState, useEffect } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { IconPin } from "@/components/icons";
import { exigirEscrita, exigirLinhas } from "@/lib/supabase-write";

interface MapeamentoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  mapeamento?: any;
}

export function MapeamentoDialog({
  isOpen,
  onClose,
  onSave,
  mapeamento,
}: MapeamentoDialogProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    dados_pessoais_id: mapeamento?.dados_pessoais_id || "",
    ativo_id: mapeamento?.ativo_id || "",
    tipo_armazenamento: mapeamento?.tipo_armazenamento || "primario",
    localizacao_dados: mapeamento?.localizacao_dados || "",
    criptografia_aplicada: mapeamento?.criptografia_aplicada || false,
    controles_acesso: mapeamento?.controles_acesso || "",
    volume_aproximado: mapeamento?.volume_aproximado || "",
    frequencia_acesso: mapeamento?.frequencia_acesso || "",
    observacoes: mapeamento?.observacoes || "",
  });
  const [dadosPessoais, setDadosPessoais] = useState<any[]>([]);
  const [ativos, setAtivos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { empresaId } = useEmpresaId();

  useEffect(() => {
    if (isOpen) {
      loadDadosPessoais();
      loadAtivos();
    }
  }, [isOpen]);

  const loadDadosPessoais = async () => {
    if (!empresaId) return;
    try {
      const { data, error } = await supabase
        .from("dados_pessoais")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("nome");

      if (error) throw error;
      setDadosPessoais(data || []);
    } catch (error) {
      console.error("Erro ao carregar dados pessoais:", error);
    }
  };

  const loadAtivos = async () => {
    if (!empresaId) return;
    try {
      const { data, error } = await supabase
        .from("ativos")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("nome");

      if (error) throw error;
      setAtivos(data || []);
    } catch (error) {
      console.error("Erro ao carregar ativos:", error);
    }
  };

  const handleSave = async () => {
    if (!empresaId) return;
    try {
      setIsLoading(true);

      // `dados_mapeamento` NÃO tem coluna `empresa_id` — mandá-la fazia o
      // PostgREST recusar com PGRST204, e criar um mapeamento era impossível.
      // O isolamento por empresa vem da RLS através de `dados_pessoais_id`.
      const payload = { ...formData };

      if (mapeamento?.id) {
        await exigirLinhas(
          supabase
            .from("dados_mapeamento")
            .update(payload)
            .eq("id", mapeamento.id)
            .select("id"),
        );
        toast({ title: t("dadosDashboard.mapeamentoDialog.toastUpdated") });
      } else {
        await exigirEscrita(
          supabase.from("dados_mapeamento").insert([payload]),
        );
        toast({ title: t("dadosDashboard.mapeamentoDialog.toastCreated") });
      }

      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: t("dadosDashboard.mapeamentoDialog.toastErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogShell
      open={isOpen}
      onOpenChange={onClose}
      title={
        mapeamento?.id
          ? t("dadosDashboard.mapeamentoDialog.titleEdit")
          : t("dadosDashboard.mapeamentoDialog.titleNew")
      }
      icon={IconPin}
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
            <Label htmlFor="dados_pessoais_id">
              {t("dadosDashboard.mapeamentoDialog.labelDadosPessoais")}
            </Label>
            <Select
              value={formData.dados_pessoais_id}
              onValueChange={(value) =>
                setFormData({ ...formData, dados_pessoais_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.mapeamentoDialog.placeholderDadosPessoais",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {dadosPessoais.map((dado) => (
                  <SelectItem key={dado.id} value={dado.id}>
                    {dado.nome} ({dado.categoria_dados})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ativo_id">
              {t("dadosDashboard.mapeamentoDialog.labelAtivo")}
            </Label>
            <Select
              value={formData.ativo_id}
              onValueChange={(value) =>
                setFormData({ ...formData, ativo_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.mapeamentoDialog.placeholderAtivo",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {ativos.map((ativo) => (
                  <SelectItem key={ativo.id} value={ativo.id}>
                    {ativo.nome} ({ativo.tipo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tipo_armazenamento">
              {t("dadosDashboard.mapeamentoDialog.labelTipoArmazenamento")}
            </Label>
            <Select
              value={formData.tipo_armazenamento}
              onValueChange={(value) =>
                setFormData({ ...formData, tipo_armazenamento: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.mapeamentoDialog.placeholderTipoArmazenamento",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primario">
                  {t("dadosDashboard.mapeamentoDialog.tipoPrimario")}
                </SelectItem>
                <SelectItem value="backup">
                  {t("dadosDashboard.mapeamentoDialog.tipoBackup")}
                </SelectItem>
                <SelectItem value="temporario">
                  {t("dadosDashboard.mapeamentoDialog.tipoTemporario")}
                </SelectItem>
                <SelectItem value="cache">
                  {t("dadosDashboard.mapeamentoDialog.tipoCache")}
                </SelectItem>
                <SelectItem value="arquivo">
                  {t("dadosDashboard.mapeamentoDialog.tipoArquivo")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="localizacao_dados">
              {t("dadosDashboard.mapeamentoDialog.labelLocalizacaoDados")}
            </Label>
            <Select
              value={formData.localizacao_dados}
              onValueChange={(value) =>
                setFormData({ ...formData, localizacao_dados: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.mapeamentoDialog.placeholderLocalizacaoDados",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="servidor_local">
                  {t(
                    "dadosDashboard.mapeamentoDialog.localizacaoServidorLocal",
                  )}
                </SelectItem>
                <SelectItem value="cloud_publica">
                  {t("dadosDashboard.mapeamentoDialog.localizacaoCloudPublica")}
                </SelectItem>
                <SelectItem value="cloud_privada">
                  {t("dadosDashboard.mapeamentoDialog.localizacaoCloudPrivada")}
                </SelectItem>
                <SelectItem value="hibrido">
                  {t("dadosDashboard.mapeamentoDialog.localizacaoHibrido")}
                </SelectItem>
                <SelectItem value="terceiros">
                  {t("dadosDashboard.mapeamentoDialog.localizacaoTerceiros")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="volume_aproximado">
              {t("dadosDashboard.mapeamentoDialog.labelVolumeAproximado")}
            </Label>
            <Select
              value={formData.volume_aproximado}
              onValueChange={(value) =>
                setFormData({ ...formData, volume_aproximado: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.mapeamentoDialog.placeholderVolumeAproximado",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pequeno">
                  {t("dadosDashboard.mapeamentoDialog.volumePequeno")}
                </SelectItem>
                <SelectItem value="medio">
                  {t("dadosDashboard.mapeamentoDialog.volumeMedio")}
                </SelectItem>
                <SelectItem value="grande">
                  {t("dadosDashboard.mapeamentoDialog.volumeGrande")}
                </SelectItem>
                <SelectItem value="muito_grande">
                  {t("dadosDashboard.mapeamentoDialog.volumeMuitoGrande")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="frequencia_acesso">
              {t("dadosDashboard.mapeamentoDialog.labelFrequenciaAcesso")}
            </Label>
            <Select
              value={formData.frequencia_acesso}
              onValueChange={(value) =>
                setFormData({ ...formData, frequencia_acesso: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.mapeamentoDialog.placeholderFrequenciaAcesso",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diaria">
                  {t("dadosDashboard.mapeamentoDialog.frequenciaDiaria")}
                </SelectItem>
                <SelectItem value="semanal">
                  {t("dadosDashboard.mapeamentoDialog.frequenciaSemanal")}
                </SelectItem>
                <SelectItem value="mensal">
                  {t("dadosDashboard.mapeamentoDialog.frequenciaMensal")}
                </SelectItem>
                <SelectItem value="eventual">
                  {t("dadosDashboard.mapeamentoDialog.frequenciaEventual")}
                </SelectItem>
                <SelectItem value="rara">
                  {t("dadosDashboard.mapeamentoDialog.frequenciaRara")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="criptografia_aplicada"
            checked={formData.criptografia_aplicada}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, criptografia_aplicada: !!checked })
            }
          />
          <Label htmlFor="criptografia_aplicada">
            {t("dadosDashboard.mapeamentoDialog.labelCriptografiaAplicada")}
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="controles_acesso">
            {t("dadosDashboard.mapeamentoDialog.labelControlesAcesso")}
          </Label>
          <Textarea
            id="controles_acesso"
            value={formData.controles_acesso}
            onChange={(e) =>
              setFormData({ ...formData, controles_acesso: e.target.value })
            }
            placeholder={t(
              "dadosDashboard.mapeamentoDialog.placeholderControlesAcesso",
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="observacoes">
            {t("dadosDashboard.mapeamentoDialog.labelObservacoes")}
          </Label>
          <Textarea
            id="observacoes"
            value={formData.observacoes}
            onChange={(e) =>
              setFormData({ ...formData, observacoes: e.target.value })
            }
            placeholder={t(
              "dadosDashboard.mapeamentoDialog.placeholderObservacoes",
            )}
          />
        </div>
      </div>
    </DialogShell>
  );
}
