/**
 * T4 · Parte B — Registo de uma constatação de auditoria.
 * A constatação é sempre ancorada num item e pode referenciar um requisito de
 * framework (Gap Analysis) ou um controlo interno — nunca texto livre.
 */
import { useEffect, useState } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { RequisitoSelect } from '@/components/auditorias/RequisitoSelect';
import { ControleSelect } from '@/components/auditorias/ControleSelect';
import { CLASSIFICACOES, derivarTipoCriticidade, type ClassificacaoAchado } from '@/lib/constatacoes';
;
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { IconWarning } from '@/components/icons';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditoriaId: string;
  itemId?: string | null;
  achado?: any | null;
}

export function ConstatacaoDialog({ open, onOpenChange, auditoriaId, itemId, achado }: Props) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();

  const [titulo, setTitulo] = useState('');
  const [classificacao, setClassificacao] = useState<ClassificacaoAchado>('nc_menor');
  const [descricao, setDescricao] = useState('');
  const [evidencia, setEvidencia] = useState('');
  const [status, setStatus] = useState('aberto');
  const [requisitoId, setRequisitoId] = useState('');
  const [controleId, setControleId] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitulo(achado?.titulo || '');
    setClassificacao((achado?.classificacao as ClassificacaoAchado) || 'nc_menor');
    setDescricao(achado?.descricao || '');
    setEvidencia(achado?.evidencia_objetiva || '');
    setStatus(achado?.status || 'aberto');
    setRequisitoId(achado?.requisito_ref_id || '');
    setControleId(achado?.controle_ref_id || '');
  }, [open, achado]);

  const salvar = useMutation({
    mutationFn: async () => {
      const { tipo, criticidade } = derivarTipoCriticidade(classificacao);
      const payload = {
        auditoria_id: auditoriaId,
        item_id: itemId ?? achado?.item_id ?? null,
        titulo: titulo.trim(),
        descricao: descricao.trim() || titulo.trim(),
        evidencia_objetiva: evidencia.trim() || null,
        classificacao,
        tipo,
        criticidade,
        status,
        requisito_ref_id: requisitoId || null,
        controle_ref_id: controleId || null,
      };

      if (achado?.id) {
        const { error } = await supabase.from('auditoria_achados').update(payload).eq('id', achado.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('auditoria_achados')
          .insert({ ...payload, created_by: userData.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditoria-achados'] });
      queryClient.invalidateQueries({ queryKey: ['auditorias'] });
      toast.success(achado?.id ? t('t4.constatacoes.atualizada') : t('t4.constatacoes.criada'));
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error('Erro ao guardar constatação', error);
      toast.error(t('t4.constatacoes.erro'));
    },
  });

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={achado?.id ? t('t4.constatacoes.editar') : t('t4.constatacoes.nova')}
      icon={IconWarning}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={!titulo.trim() || salvar.isPending || !empresaId}>
            {t('t4.constatacoes.guardar')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="titulo">{t('t4.constatacoes.campoTitulo')}</Label>
          <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('t4.constatacoes.campoClassificacao')}</Label>
            <Select value={classificacao} onValueChange={(v) => setClassificacao(v as ClassificacaoAchado)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASSIFICACOES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`t4.constatacoes.classificacaoLabel.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('t4.constatacoes.campoStatus')}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aberto">{t('t4.constatacoes.statusAberto')}</SelectItem>
                <SelectItem value="em_tratamento">{t('t4.constatacoes.statusEmTratamento')}</SelectItem>
                <SelectItem value="fechado">{t('t4.constatacoes.statusFechado')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="descricao">{t('t4.constatacoes.campoDescricao')}</Label>
          <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="evidencia">{t('t4.constatacoes.campoEvidencia')}</Label>
          <Textarea id="evidencia"
            value={evidencia}
            onChange={(e) => setEvidencia(e.target.value)}
            rows={2}
            placeholder={t('t4.constatacoes.campoEvidenciaPlaceholder')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('t4.constatacoes.campoRequisito')}</Label>
            <RequisitoSelect value={requisitoId} onValueChange={(v) => setRequisitoId(v)} />
          </div>
          <div className="space-y-2">
            <Label>{t('t4.constatacoes.campoControlo')}</Label>
            <ControleSelect value={controleId} onValueChange={(v) => setControleId(v)} />
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

