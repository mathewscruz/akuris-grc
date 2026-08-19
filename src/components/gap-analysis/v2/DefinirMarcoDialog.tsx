import { useEffect, useState } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import {
  useSalvarMarco,
  useRemoverMarco,
  type MarcoCertificacao,
} from '@/hooks/useMarcoCertificacao';
import { formatarDiaParaDB } from '@/lib/date-utils';

/**
 * Definir o marco de certificação **deste framework**.
 *
 * Três campos e nada mais: o que se vai certificar, quando, e com que score.
 * Deliberadamente não é um planeador — datas de tarefa, responsáveis e
 * dependências vivem no módulo de projetos. Aqui só existe a linha de chegada
 * contra a qual o score deste framework passa a ser lido.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  frameworkId: string;
  /** Marco em aberto, quando já existe um — o diálogo passa a editá-lo. */
  marco?: MarcoCertificacao | null;
  /** Score de hoje, mostrado como referência ao escolher a meta. */
  scoreAtual: number;
}

/** Daqui a seis meses: prazo típico de um ciclo de certificação. */
function dataSugerida(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return formatarDiaParaDB(d);
}

export function DefinirMarcoDialog({
  open,
  onOpenChange,
  empresaId,
  frameworkId,
  marco,
  scoreAtual,
}: Props) {
  const { t } = useLanguage();
  const salvar = useSalvarMarco();
  const remover = useRemoverMarco();

  const [rotulo, setRotulo] = useState('');
  const [dataAlvo, setDataAlvo] = useState('');
  const [scoreAlvo, setScoreAlvo] = useState('90');

  useEffect(() => {
    if (!open) return;
    setRotulo(marco?.rotulo ?? '');
    setDataAlvo(marco?.data_alvo ?? dataSugerida());
    // A meta parte de 90, ou do próximo múltiplo de dez acima do score de hoje
    // quando já se está acima disso — propor meta abaixo do atual é ruído.
    setScoreAlvo(
      String(marco?.score_alvo ?? Math.min(100, Math.max(90, Math.ceil((scoreAtual + 5) / 10) * 10))),
    );
  }, [open, marco, scoreAtual]);

  const alvoNumero = Number(scoreAlvo);
  const dataValida = !!dataAlvo && !Number.isNaN(Date.parse(dataAlvo));
  const podeGravar =
    rotulo.trim().length > 0 &&
    dataValida &&
    Number.isFinite(alvoNumero) &&
    alvoNumero >= 1 &&
    alvoNumero <= 100;

  const gravar = async () => {
    if (!podeGravar) return;
    try {
      await salvar.mutateAsync({
        id: marco?.id,
        empresaId,
        frameworkId,
        rotulo,
        dataAlvo,
        scoreAlvo: alvoNumero,
      });
      toast.success(t('gapV2.marco.gravado'));
      onOpenChange(false);
    } catch (e) {
      logger.error('Erro ao gravar marco', { error: e instanceof Error ? e.message : String(e) });
      toast.error(t('gapV2.marco.erroGravar'));
    }
  };

  const apagar = async () => {
    if (!marco) return;
    try {
      await remover.mutateAsync({ id: marco.id, empresaId, frameworkId });
      toast.success(t('gapV2.marco.removido'));
      onOpenChange(false);
    } catch (e) {
      logger.error('Erro ao remover marco', { error: e instanceof Error ? e.message : String(e) });
      toast.error(t('gapV2.marco.erroRemover'));
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={marco ? t('gapV2.marco.tituloEditar') : t('gapV2.marco.tituloNovo')}
      description={t('gapV2.marco.descricao')}
      size="sm"
      onSubmit={gravar}
      submitLabel={t('gapV2.marco.salvar')}
      submitDisabled={!podeGravar}
      isSubmitting={salvar.isPending}
      footer={
        marco ? (
          <div className="flex items-center justify-between gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={apagar}
              disabled={remover.isPending}
            >
              {t('gapV2.marco.remover')}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('gapV2.marco.cancelar')}
              </Button>
              <Button type="button" onClick={gravar} disabled={!podeGravar || salvar.isPending}>
                {t('gapV2.marco.salvar')}
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="marco-rotulo">{t('gapV2.marco.campoRotulo')}</Label>
          <Input
            id="marco-rotulo"
            value={rotulo}
            onChange={(e) => setRotulo(e.target.value)}
            placeholder={t('gapV2.marco.exemploRotulo')}
            maxLength={120}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="marco-data">{t('gapV2.marco.campoData')}</Label>
            <Input
              id="marco-data"
              type="date"
              value={dataAlvo}
              onChange={(e) => setDataAlvo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="marco-score">{t('gapV2.marco.campoScore')}</Label>
            <Input
              id="marco-score"
              type="number"
              min={1}
              max={100}
              value={scoreAlvo}
              onChange={(e) => setScoreAlvo(e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('gapV2.marco.referenciaAtual', { score: Math.round(scoreAtual) })}
        </p>
      </div>
    </DialogShell>
  );
}
