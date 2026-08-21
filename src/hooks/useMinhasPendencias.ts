/**
 * useMinhasPendencias — o que está atribuído a MIM.
 *
 * O painel falava só da empresa. Contava riscos, controlos, documentos e
 * frameworks; nunca dizia o que a pessoa que o está a olhar tem para fazer.
 * Quem quisesse saber tinha de ir a /minhas-tarefas — uma página que já unia
 * as duas fontes de "coisas a fazer" e que ninguém abre a partir do painel.
 *
 * As duas consultas são as mesmas de `MinhasTarefas`: tarefas de projeto
 * (Kanban) e planos de ação (remediação de controlos, auditorias, incidentes),
 * ambas filtradas por `responsavel_id`. O que muda é a saída: aqui só interessa
 * a contagem do que está por fazer e as primeiras linhas, ordenadas pelo que
 * aperta primeiro.
 *
 * A ordenação é por PRAZO, não por prioridade. Uma tarefa "média" que venceu
 * ontem exige decisão antes de uma "crítica" para o mês que vem — e o prazo é
 * o único dos dois campos que não depende de quem preencheu o formulário.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { parseDataLocal } from '@/lib/date-utils';

export type OrigemPendencia = 'projeto' | 'plano';

export interface Pendencia {
  id: string;
  titulo: string;
  origem: OrigemPendencia;
  /** Nome do projeto, ou o módulo que gerou o plano de ação. */
  origemRef: string | null;
  prazo: string | null;
  /** Prazo no passado. É o que decide a cor do ponto e a ordem. */
  atrasada: boolean;
  href: string;
}

/** Estados de plano de ação que significam "já não está na minha mesa". */
const CONCLUIDO = /conclu|resolv|fechad|cancel/;

/**
 * As linhas cruas de cada consulta.
 *
 * `projeto_tarefas` não está nos tipos gerados do Supabase — daí o `as never`
 * no `.from()` e estas formas escritas à mão, que é o que se pode garantir
 * sobre as colunas que a consulta pede.
 */
interface LinhaTarefa {
  id: string;
  titulo: string;
  prazo: string | null;
  concluida_em: string | null;
  projeto_id: string;
  projetos: { nome: string | null } | null;
}

interface LinhaPlano {
  id: string;
  titulo: string;
  status: string | null;
  prazo: string | null;
  data_conclusao: string | null;
  modulo_origem: string | null;
}

export function useMinhasPendencias() {
  const { user, profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const userId = user?.id;
  const ativo = !!userId && !!empresaId;

  const tarefas = useQuery({
    queryKey: ['minhas-pendencias-projeto', userId, empresaId],
    enabled: ativo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      /*
        O inquilino vem pelo PROJETO.

        `projeto_tarefas` não tem `empresa_id` — filtrar por ela devolve 400
        ("column projeto_tarefas.empresa_id does not exist") e a lista fica
        vazia sem dizer porquê. Com `!inner`, o filtro no embed é um INNER JOIN
        e isola o inquilino na mesma. Era este o defeito que deixava a página
        /projetos/minhas-tarefas sem nenhuma tarefa de projeto.
      */
      const { data, error } = await supabase
        .from('projeto_tarefas' as never)
        .select('id, titulo, prazo, concluida_em, projeto_id, projetos!inner(nome, empresa_id)')
        .eq('projetos.empresa_id', empresaId!)
        .eq('responsavel_id', userId!);
      if (error) throw error;
      return ((data ?? []) as unknown as LinhaTarefa[])
        .filter((t) => !t.concluida_em)
        .map((t) => ({
          id: `projeto-${t.id}`,
          titulo: t.titulo,
          origem: 'projeto' as const,
          origemRef: t.projetos?.nome ?? null,
          prazo: t.prazo ?? null,
          href: `/projetos/${t.projeto_id}`,
        }));
    },
  });

  const planos = useQuery({
    queryKey: ['minhas-pendencias-planos', userId, empresaId],
    enabled: ativo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_acao')
        .select('id, titulo, status, prazo, data_conclusao, modulo_origem')
        .eq('empresa_id', empresaId!)
        .eq('responsavel_id', userId!);
      if (error) throw error;
      return ((data ?? []) as LinhaPlano[])
        .filter((p) => !p.data_conclusao && !CONCLUIDO.test((p.status ?? '').toLowerCase()))
        .map((p) => ({
          id: `plano-${p.id}`,
          titulo: p.titulo,
          origem: 'plano' as const,
          origemRef: p.modulo_origem ?? null,
          prazo: p.prazo ?? null,
          href: '/planos-acao',
        }));
    },
  });

  const itens = useMemo<Pendencia[]>(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const juntos = [...(tarefas.data ?? []), ...(planos.data ?? [])].map((p) => {
      let atrasada = false;
      if (p.prazo) {
        const d = parseDataLocal(p.prazo);
        d.setHours(0, 0, 0, 0);
        atrasada = d < hoje;
      }
      return { ...p, atrasada };
    });

    // Atrasadas primeiro; depois por prazo; sem prazo no fim — não é urgente
    // aquilo que ninguém datou.
    return juntos.sort((a, b) => {
      if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
      if (!a.prazo) return b.prazo ? 1 : 0;
      if (!b.prazo) return -1;
      return a.prazo.localeCompare(b.prazo);
    });
  }, [tarefas.data, planos.data]);

  return {
    itens,
    total: itens.length,
    atrasadas: itens.filter((i) => i.atrasada).length,
    isLoading: tarefas.isLoading || planos.isLoading,
  };
}
