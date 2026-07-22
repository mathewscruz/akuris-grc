import { useState } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Documento {
  id: string;
  nome: string;
  versao: number;
  data_vencimento?: string;
  empresa_id: string;
  arquivo_nome?: string;
  requer_aprovacao?: boolean;
}

interface RenovarDocumentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: Documento | null;
  onSuccess: () => void;
}

export const RenovarDocumentoDialog = ({
  open,
  onOpenChange,
  documento,
  onSuccess,
}: RenovarDocumentoDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [novoArquivo, setNovoArquivo] = useState<File | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [novaDataVencimento, setNovaDataVencimento] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNovoArquivo(e.target.files[0]);
    }
  };

  const resetForm = () => {
    setNovoArquivo(null);
    setObservacoes("");
    setNovaDataVencimento("");
  };

  const handleSubmit = async () => {
    if (!documento || !novoArquivo) {
      toast.error("Selecione um arquivo para continuar");
      return;
    }

    try {
      setLoading(true);

      // 1. Upload do novo arquivo para o Storage
      const fileName = `${Date.now()}_${novoArquivo.name}`;
      const filePath = `${documento.empresa_id}/documentos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(filePath, novoArquivo);

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw new Error('Erro ao fazer upload do arquivo');
      }

      // 2. Armazenar PATH (bucket é privado; HistoricoVersoesDialog/DocumentoPreview
      //    geram signed URL sob demanda). Nunca guardar getPublicUrl aqui.
      // 3. Atualizar o documento com o novo arquivo antes de renovar
      const { error: updateArquivoError } = await supabase
        .from('documentos')
        .update({
          arquivo_url: filePath,
          arquivo_nome: novoArquivo.name,
          arquivo_tipo: novoArquivo.type,
          arquivo_tamanho: novoArquivo.size,
        })
        .eq('id', documento.id);

      if (updateArquivoError) {
        console.error('Erro ao atualizar arquivo:', updateArquivoError);
        throw new Error('Erro ao atualizar arquivo do documento');
      }

      // 4. Chamar a Edge Function para renovar o documento
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        'https://lnlkahtugwmkznasapfd.supabase.co/functions/v1/renovar-documento',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            documento_id: documento.id,
            observacoes: observacoes || undefined,
            nova_data_vencimento: novaDataVencimento || undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Erro ao renovar documento');
      }

      toast.success(
        `Documento renovado com sucesso para v${result.nova_versao}!` +
        (documento.requer_aprovacao ? ' Aprovação necessária.' : '')
      );

      resetForm();
      onOpenChange(false);
      onSuccess();

    } catch (error: any) {
      console.error('Erro ao renovar documento:', error);
      toast.error(error.message || 'Erro ao renovar documento');
    } finally {
      setLoading(false);
    }
  };

  if (!documento) return null;

  // Calcular dias até o vencimento
  const diasAteVencimento = documento.data_vencimento
    ? Math.ceil(
        (new Date(documento.data_vencimento).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FileText}
      title="Renovar Documento"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading || !novoArquivo}>
            {loading ? (
              <>
                <AkurisPulse size={16} className="mr-2" />
                Renovando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Renovar para v{documento.versao + 1}
              </>
            )}
          </Button>
        </div>
      }
    >
        <div className="space-y-4">
          {/* Informações do documento atual */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">{documento.nome}</p>
                <p className="text-sm text-muted-foreground">
                  Versão atual: v{documento.versao}
                  {documento.arquivo_nome && ` • ${documento.arquivo_nome}`}
                </p>
                {documento.data_vencimento && (
                  <p className="text-sm text-muted-foreground">
                    Vencimento: {new Date(documento.data_vencimento).toLocaleDateString('pt-BR')}
                    {diasAteVencimento !== null && (
                      <span
                        className={
                          diasAteVencimento < 0
                            ? "text-destructive ml-1"
                            : diasAteVencimento <= 30
                            ? "text-warning ml-1"
                            : ""
                        }
                      >
                        ({diasAteVencimento < 0
                          ? `vencido há ${Math.abs(diasAteVencimento)} dias`
                          : `${diasAteVencimento} dias restantes`})
                      </span>
                    )}
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Upload do novo arquivo */}
          <div className="space-y-2">
            <Label htmlFor="arquivo" className="text-sm font-medium">
              Novo Arquivo <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="arquivo"
                type="file"
                onChange={handleFileChange}
                disabled={loading}
                className="flex-1"
              />
              {novoArquivo && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  <span className="truncate max-w-[200px]">{novoArquivo.name}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione o arquivo atualizado para a nova versão do documento
            </p>
          </div>

          {/* Nova data de vencimento */}
          <div className="space-y-2">
            <Label htmlFor="data_vencimento" className="text-sm font-medium">
              Nova Data de Vencimento
            </Label>
            <Input
              id="data_vencimento"
              type="date"
              value={novaDataVencimento}
              onChange={(e) => setNovaDataVencimento(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              {documento.data_vencimento
                ? "Deixe em branco para manter a data atual"
                : "Opcional - defina uma data de vencimento para esta versão"}
            </p>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes" className="text-sm font-medium">
              Observações sobre a Renovação
            </Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Atualização anual conforme revisão do comitê..."
              disabled={loading}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Opcional - descreva as mudanças ou motivo da renovação
            </p>
          </div>

          {/* Aviso sobre aprovação */}
          {documento.requer_aprovacao && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Este documento requer aprovação. Após a renovação, o status será alterado para{" "}
                <span className="font-medium">Pendente de Aprovação</span> e os aprovadores serão
                notificados automaticamente.
              </AlertDescription>
            </Alert>
          )}
        </div>
    </DialogShell>
  );
};
