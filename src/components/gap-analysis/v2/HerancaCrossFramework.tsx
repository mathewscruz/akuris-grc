import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { SectionHead } from './SectionHead';
import { IconArrowRight, IconCheck, IconLink } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';

/**
 * Aproveitar o que já foi avaliado noutro framework.
 *
 * É o trabalho mais caro do processo de conformidade: quem certificou ISO 27001
 * e começa NIST CSF responde de novo às mesmas perguntas, com as mesmas
 * evidências, sobre o mesmo controlo. Vanta e Drata vendem exatamente isto como
 * principal — avaliar uma vez e ver o resto preenchido.
 *
 * Duas decisões deliberadas:
 *
 * 1. **Nada é aplicado sozinho.** A proposta aparece com a origem à vista e
 *    alguém aceita. Conformidade herdada em silêncio é conformidade que não se
 *    sustenta numa auditoria — o auditor pergunta quem decidiu, e "o sistema
 *    decidiu" não é resposta.
 * 2. **Vínculo parcial nunca promove.** Se o controlo de origem cobre só parte
 *    do requisito, a herança propõe `parcial` mesmo que a origem esteja
 *    conforme. É mais fácil subir depois do que descobrir na auditoria que o
 *    verde era otimismo.
 */

interface Proposta {
  requisito_id: string;
  requisito_codigo: string | null;
  requisito_titulo: string;
  origem_id: string;
  origem_codigo: string | null;
  origem_framework: string;
  origem_status: string;
  relacao: string;
  status_proposto: string;
}

interface Props {
  frameworkId: string;
  empresaId: string;
  /** Recarrega a tela do framework depois de aplicar. */
  onAplicado?: () => void;
}

export function HerancaCrossFramework({ frameworkId, empresaId, onAplicado }: Props) {
  const { t } = useLanguage();
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [aplicando, setAplicando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!frameworkId || !empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('gap_propostas_de_heranca', {
        p_framework_alvo: frameworkId,
        p_empresa_id: empresaId,
      });
      if (error) throw error;
      setPropostas((data as Proposta[]) || []);
    } catch (e) {
      logger.error('HerancaCrossFramework', { error: e instanceof Error ? e.message : String(e) });
      setPropostas([]);
    } finally {
      setLoading(false);
    }
  }, [frameworkId, empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const aplicar = async (itens: Proposta[]) => {
    if (itens.length === 0) return;
    setAplicando(itens.length === 1 ? itens[0].requisito_id : 'todas');
    try {
      // A origem fica escrita na observação: numa auditoria, a pergunta é
      // sempre "de onde veio esta conclusão".
      const linhas = itens.map((p) => ({
        requirement_id: p.requisito_id,
        framework_id: frameworkId,
        empresa_id: empresaId,
        conformity_status: p.status_proposto,
        observacoes: t('gapV2.heranca.observacao', {
          framework: p.origem_framework,
          codigo: p.origem_codigo || '',
        }),
        data_avaliacao: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('gap_analysis_evaluations')
        .upsert(linhas, { onConflict: 'framework_id,requirement_id,empresa_id' });
      if (error) throw error;

      toast.success(t('gapV2.heranca.aplicado', { count: itens.length }));
      await carregar();
      onAplicado?.();
    } catch (e) {
      logger.error('HerancaCrossFramework aplicar', { error: e instanceof Error ? e.message : String(e) });
      toast.error(t('gapV2.heranca.erro'));
    } finally {
      setAplicando(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card py-8">
        <AkurisPulse size={26} />
      </div>
    );
  }

  // Sem equivalência mapeada não há secção: uma caixa vazia a dizer "nada a
  // herdar" só ocupa a dobra de quem está a começar do zero.
  if (propostas.length === 0) return null;

  return (
    <section>
      <SectionHead
        title={t('gapV2.heranca.titulo')}
        count={propostas.length}
        right={
          <Button
            size="sm"
            onClick={() => aplicar(propostas)}
            disabled={aplicando !== null}
            className="gap-1.5"
          >
            <IconCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
            {t('gapV2.heranca.aplicarTodas')}
          </Button>
        }
      />

      <p className="mb-3 text-xs text-muted-foreground">{t('gapV2.heranca.explicacao')}</p>

      <ul className="space-y-2">
        {propostas.map((p) => (
          <li
            key={p.requisito_id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <IconLink className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground tabular-nums">
                  {p.origem_framework} {p.origem_codigo}
                </span>
                <IconArrowRight className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-micro font-semibold uppercase tracking-wider text-foreground tabular-nums">
                  {p.requisito_codigo}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-sm text-foreground">{p.requisito_titulo}</span>
            </span>

            <StatusBadge tone={p.status_proposto === 'conforme' ? 'success' : 'warning'}>
              {t(`gapUi.status.${p.status_proposto === 'conforme' ? 'conforme' : 'parcial'}`)}
            </StatusBadge>

            {p.relacao === 'parcial' && (
              <span className="text-micro text-muted-foreground">{t('gapV2.heranca.coberturaParcial')}</span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => aplicar([p])}
              disabled={aplicando !== null}
            >
              {t('gapV2.heranca.aplicar')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
