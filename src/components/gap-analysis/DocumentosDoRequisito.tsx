/**
 * Os documentos que provam este requisito.
 *
 * ## O vínculo que faltava
 *
 * `documentos_vinculacoes` já ligava um documento a contratos, auditorias,
 * riscos, controles e ativos — e não a REQUISITOS de framework, que é o vínculo
 * central de um produto GRC. É por isso que a tabela tinha zero linhas: existia
 * para tudo menos para o que se usa todos os dias.
 *
 * Num Vanta ou Drata, a política aprovada É a evidência: liga-se uma vez e ela
 * responde por A.5.1 da ISO, por CC1.1 do SOC 2 e pelo equivalente do NIST ao
 * mesmo tempo. Aqui era preciso voltar a carregar o mesmo PDF em cada sítio, e
 * quando a política fosse revista, as cópias ficavam para trás.
 *
 * ## Porquê o documento, e não um ficheiro solto
 *
 * O produto já tem `documentos`, com aprovação, versão e validade. Um documento
 * aprovado carrega consigo a prova de que alguém o revisou e quando expira —
 * um ficheiro largado num balde não carrega nada disso. Ligar ao documento é
 * ligar à evidência com a sua história.
 */
import { useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { EntidadeMultiSelect } from '@/components/common/EntidadeMultiSelect';
import { IconFile, IconExternal } from '@/components/icons';
import { formatDateOnly, parseDataLocal } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { resolveItemStatusTone } from '@/lib/status-tone';
import { useNavigate } from 'react-router-dom';

interface Props {
  requisitoId: string;
  frameworkId?: string | null;
  /** Só leitura quando a avaliação está fechada. */
  disabled?: boolean;
  onChanged?: () => void;
}

interface LinhaVinculo {
  id: string;
  evidence_id: string;
  evidence_library: {
    id: string;
    documento_id: string | null;
    documentos: {
      id: string;
      nome: string;
      status: string | null;
      versao: number | null;
      data_vencimento: string | null;
    } | null;
  } | null;
}

export function DocumentosDoRequisito({ requisitoId, frameworkId, disabled, onChanged }: Props) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const chave = ['requisito-documentos', requisitoId, profile?.empresa_id];

  const { data: vinculos = [], isLoading } = useQuery({
    queryKey: chave,
    enabled: !!requisitoId,
    queryFn: async () => {
      /*
        Pela BIBLIOTECA, não por um caminho só nosso.

        `evidence_library_links` já sabe apontar a requisito, framework,
        avaliação e a qualquer módulo, e traz validade, parecer de IA e
        aceitação. Criar aqui uma segunda tabela de ligação daria duas verdades
        sobre a mesma coisa -- que é o defeito que este trabalho existe para
        corrigir.
      */
      const { data, error } = await supabase
        .from('evidence_library_links')
        .select('id, evidence_id, evidence_library:evidence_id(id, documento_id, documentos:documento_id(id, nome, status, versao, data_vencimento))')
        .eq('requirement_id', requisitoId)
        .eq('empresa_id', profile?.empresa_id ?? '');
      if (error) throw error;
      // Só as entradas que SÃO documento: um ficheiro carregado tem o seu
      // próprio sítio no ecrã, logo abaixo.
      return ((data ?? []) as unknown as LinhaVinculo[]).filter(
        (v) => !!v.evidence_library?.documento_id,
      );
    },
  });

  const idsLigados = useMemo(
    () => vinculos.map((v) => v.evidence_library!.documento_id!).filter(Boolean),
    [vinculos],
  );

  const guardar = useMutation({
    mutationFn: async (novosIds: string[]) => {
      const empresaId = profile?.empresa_id;
      if (!empresaId) throw new Error('sem empresa');

      const aAdicionar = novosIds.filter((id) => !idsLigados.includes(id));
      const aRemover = vinculos.filter(
        (v) => !novosIds.includes(v.evidence_library!.documento_id!),
      );

      if (aRemover.length) {
        const { error } = await supabase
          .from('evidence_library_links')
          .delete()
          .in('id', aRemover.map((v) => v.id));
        if (error) throw error;
      }

      for (const documento_id of aAdicionar) {
        /*
          O documento entra na biblioteca uma vez só.

          Se já lá estiver -- porque prova outro requisito -- reaproveita-se a
          mesma entrada. É esse o ponto: uma política, muitas provas. O índice
          único (empresa, documento) garante que não há duas.
        */
        const { data: existente } = await supabase
          .from('evidence_library')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('documento_id', documento_id)
          .maybeSingle();

        let evidenceId = existente?.id;
        if (!evidenceId) {
          const { data: doc } = await supabase
            .from('documentos')
            .select('nome, data_vencimento')
            .eq('id', documento_id)
            .maybeSingle();
          const { data: nova, error: erroNova } = await supabase
            .from('evidence_library')
            .insert({
              empresa_id: empresaId,
              documento_id,
              nome: doc?.nome ?? 'Documento',
              // A validade da evidência é a do documento: uma política vencida
              // deixa de provar seja o que for.
              valido_ate: doc?.data_vencimento ?? null,
            })
            .select('id')
            .single();
          if (erroNova) throw erroNova;
          evidenceId = nova.id;
        }

        const { error: erroLink } = await supabase.from('evidence_library_links').insert({
          empresa_id: empresaId,
          evidence_id: evidenceId,
          /*
            O alvo é `modulo` + `registro_id` -- é o que o CHECK
            `evidence_link_has_target` exige, e é o par genérico que serve
            qualquer módulo. `requirement_id` e `framework_id` vão a par
            porque são as colunas por onde o Gap Analysis consulta; sozinhas
            não constituem alvo válido.
          */
          modulo: 'gap_analysis_requirements',
          registro_id: requisitoId,
          requirement_id: requisitoId,
          framework_id: frameworkId ?? null,
          // `manual` vs `sugestao_ia`: a coluna diz COMO a ligação nasceu,
          // não o que ela é. Aqui foi uma pessoa que a fez.
          vinculo_tipo: 'manual',
        });
        if (erroLink) throw erroLink;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chave });
      onChanged?.();
    },
    onError: (erro) => {
      logger.error('Vínculo documento–requisito não gravado', { data: erro });
      toast.error(t('gapUi.documentosRequisito.erroGravar'));
    },
  });

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{t('gapUi.documentosRequisito.titulo')}</p>
        <p className="text-xs text-muted-foreground">{t('gapUi.documentosRequisito.ajuda')}</p>
      </div>

      {!disabled && (
        <EntidadeMultiSelect
          entidade="documento"
          value={idsLigados}
          onValueChange={(ids) => guardar.mutate(ids)}
          placeholder={t('gapUi.documentosRequisito.escolher')}
          disabled={guardar.isPending || isLoading}
        />
      )}

      {vinculos.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border">
          {vinculos.map((v) => {
            const d = v.evidence_library?.documentos;
            /*
              O estado do documento importa tanto como a sua existência: uma
              política VENCIDA encostada a um requisito não é prova de nada, e
              é precisamente o que um auditor repara primeiro.
            */
            // `parseDataLocal`, não `new Date`: `data_vencimento` é coluna
            // `date`, e `new Date('2026-08-25')` é meia-noite UTC -- o dia
            // ANTERIOR a oeste de Greenwich. Um documento que vence hoje
            // apareceria como já vencido.
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const vencido = !!d?.data_vencimento && parseDataLocal(d.data_vencimento) < hoje;
            return (
              <li key={v.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <IconFile className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span className="min-w-0 flex-1 truncate">{d?.nome ?? '—'}</span>
                {d?.versao != null && (
                  <Badge variant="outline" className="text-micro font-mono shrink-0">
                    v{d.versao}
                  </Badge>
                )}
                {d?.status && (
                  <StatusBadge {...resolveItemStatusTone(vencido ? 'vencido' : d.status)}>
                    {vencido
                      ? t('gapUi.documentosRequisito.vencidoEm', {
                          data: formatDateOnly(d.data_vencimento!),
                        })
                      : formatStatus(d.status)}
                  </StatusBadge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label={t('gapUi.documentosRequisito.abrir')}
                  // Leva ao DOCUMENTO, não à lista de documentos: o `?focus=`
                  // é lido por `/documentos` e abre a ficha certa.
                  onClick={() => navigate(`/documentos?focus=${v.evidence_library!.documento_id}`)}
                >
                  <IconExternal className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {!isLoading && vinculos.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {t('gapUi.documentosRequisito.vazio')}
        </p>
      )}
    </div>
  );
}
