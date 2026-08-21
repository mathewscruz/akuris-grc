/**
 * DenunciaConverter — a denúncia procedente vira trabalho no resto do GRC.
 *
 * `denuncias` tem `risco_id`, `plano_acao_id` e `incidente_id` desde a onda 2 e
 * **nenhuma tela as usava**. Uma denúncia procedente sobre segurança devia
 * virar incidente; uma que revela controlo fraco devia virar risco; uma que
 * termina com medidas devia virar plano de ação. Sem isto, o canal é um
 * formulário bem feito ao LADO do GRC em vez de fazer parte dele — e é
 * justamente essa ligação que o concorrente, que só vende canal, não tem.
 *
 * Duas regras que o desenho segue:
 *
 *  · **Só aparece o que a empresa comprou.** No plano avulso do canal não há
 *    riscos nem incidentes para onde converter, e oferecer um botão que leva a
 *    «fora do seu plano» é pior do que não o oferecer.
 *
 *  · **Uma vez.** Convertido, o botão dá lugar ao link para o item criado. Duas
 *    conversões da mesma denúncia seriam dois riscos a dizer o mesmo, e a
 *    contagem do painel passaria a mentir.
 *
 * O que segue para o outro módulo é o TÍTULO e o protocolo, nunca a descrição:
 * o relato pode identificar quem denunciou, e do outro lado a plateia é outra.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { IconWarning, IconChecklist, IconTarget, IconArrowUpRight } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { severidadeDeFaixas } from '@/lib/metrics/riscos';
import { toast } from 'sonner';

type Destino = 'risco' | 'plano_acao' | 'incidente';

interface Props {
  denuncia: {
    id: string;
    empresa_id: string;
    protocolo: string;
    titulo: string;
    gravidade: string | null;
    medidas_adotadas: string | null;
    risco_id: string | null;
    plano_acao_id: string | null;
    incidente_id: string | null;
  };
  onAtualizado: () => void;
}

const DESTINOS: Array<{
  destino: Destino;
  modulo: string;
  coluna: 'risco_id' | 'plano_acao_id' | 'incidente_id';
  rota: string;
  icone: typeof IconWarning;
}> = [
  { destino: 'incidente', modulo: 'incidentes', coluna: 'incidente_id', rota: '/incidentes', icone: IconWarning },
  { destino: 'risco', modulo: 'riscos', coluna: 'risco_id', rota: '/riscos', icone: IconTarget },
  { destino: 'plano_acao', modulo: 'planos-acao', coluna: 'plano_acao_id', rota: '/planos-acao', icone: IconChecklist },
];

/** A escala de 1 a 5 dos riscos, a partir da gravidade da denúncia. */
const NOTA_POR_SEVERIDADE: Record<string, number> = {
  baixo: 2,
  medio: 3,
  alto: 4,
  critico: 5,
};

export function DenunciaConverter({ denuncia, onAtualizado }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();
  const [ocupado, setOcupado] = useState<Destino | null>(null);

  const disponiveis = DESTINOS.filter((d) => canAccess(d.modulo));
  if (disponiveis.length === 0) return null;

  const converter = async (alvo: (typeof DESTINOS)[number]) => {
    setOcupado(alvo.destino);
    try {
      const severidade = severidadeDeFaixas(denuncia.gravidade ?? 'medio');
      const nota = NOTA_POR_SEVERIDADE[severidade] ?? 3;
      /* Referência ao protocolo, nunca ao relato: do outro lado a plateia é
         outra e a descrição pode identificar quem denunciou. */
      const referencia = t('denunciasAdmin.converter.origem', { protocolo: denuncia.protocolo });

      let novoId: string | null = null;

      if (alvo.destino === 'incidente') {
        const { data, error } = await supabase
          .from('incidentes')
          .insert({
            empresa_id: denuncia.empresa_id,
            titulo: denuncia.titulo,
            descricao: referencia,
            status: 'aberto',
          })
          .select('id')
          .single();
        if (error) throw error;
        novoId = data.id;
      } else if (alvo.destino === 'risco') {
        const { data, error } = await supabase
          .from('riscos')
          .insert({
            empresa_id: denuncia.empresa_id,
            nome: denuncia.titulo,
            descricao: referencia,
            probabilidade_inicial: nota,
            impacto_inicial: nota,
          })
          .select('id')
          .single();
        if (error) throw error;
        novoId = data.id;
      } else {
        const { data, error } = await supabase
          .from('planos_acao')
          .insert({
            empresa_id: denuncia.empresa_id,
            titulo: denuncia.medidas_adotadas || denuncia.titulo,
            descricao: referencia,
            prioridade: severidade,
            responsavel_id: user?.id ?? null,
          })
          .select('id')
          .single();
        if (error) throw error;
        novoId = data.id;
      }

      const { error: erroLigacao } = await supabase
        .from('denuncias')
        .update({ [alvo.coluna]: novoId })
        .eq('id', denuncia.id);
      if (erroLigacao) throw erroLigacao;

      /* A conversão entra na trilha: é uma decisão da apuração, e interna —
         o que a empresa faz a seguir não é retorno a quem denunciou. */
      const { error: erroTrilha } = await supabase.from('denuncias_movimentacoes').insert({
        denuncia_id: denuncia.id,
        acao: `convertida_${alvo.destino}`,
        observacoes: null,
        visibilidade: 'interna',
        usuario_id: user?.id ?? null,
      });
      if (erroTrilha) throw erroTrilha;

      onAtualizado();
      toast.success(t(`denunciasAdmin.converter.criado.${alvo.destino}`));
    } catch {
      toast.error(t('denunciasAdmin.converter.erro'));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
        {t('denunciasAdmin.converter.titulo')}
      </p>
      <p className="mt-1 text-micro text-muted-foreground">
        {t('denunciasAdmin.converter.explicacao')}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {disponiveis.map((alvo) => {
          const jaConvertida = denuncia[alvo.coluna];
          const Icone = alvo.icone;
          return jaConvertida ? (
            <Button
              key={alvo.destino}
              variant="ghost"
              size="sm"
              onClick={() => navigate(alvo.rota, { state: { itemId: jaConvertida } })}
            >
              <Icone className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
              {t(`denunciasAdmin.converter.ver.${alvo.destino}`)}
              <IconArrowUpRight className="ml-1 h-3 w-3" strokeWidth={1.5} />
            </Button>
          ) : (
            <Button
              key={alvo.destino}
              variant="outline"
              size="sm"
              disabled={ocupado !== null}
              onClick={() => converter(alvo)}
            >
              <Icone className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
              {ocupado === alvo.destino
                ? t('denunciasAdmin.converter.criando')
                : t(`denunciasAdmin.converter.criar.${alvo.destino}`)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
