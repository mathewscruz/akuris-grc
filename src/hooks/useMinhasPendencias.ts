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

export type OrigemPendencia =
  | 'projeto'
  | 'plano'
  | 'documento'
  | 'risco'
  | 'aceiteRisco'
  | 'revisaoAcessos'
  | 'denuncia'
  | 'titular';

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

  /*
    As decisoes que esperam por mim.

    O painel dizia «Nada atribuido a voce» enquanto a mesma tela anunciava «1
    avaliacao vencida - 127 evidencias pendentes». Nao era mentira: este hook
    so olhava para tarefas de projeto e planos de accao -- duas de oito fontes.
    Um documento a minha aprovacao ha 375 dias nao aparecia em lado nenhum
    alem de uma notificacao no sino, que passa.

    Duas fontes ficaram DE FORA, e e decisao, nao esquecimento:
    - Due diligence nao tem responsavel interno (nem `responsavel_id`, nem
      revisor). So ha quem enviou. Por aqui «a avaliacao que mandei e nao
      voltou» seria cobranca, nao decisao minha -- e fingir atribuicao onde
      nao ha e o defeito que andamos a corrigir.
    - Teste de controlo por atestar e difusao («qualquer um menos quem o
      executou»), nao atribuicao. Entraria como "teu" algo que nao e.
  */
  const aprovacoesDocumento = useQuery({
    queryKey: ['minhas-pendencias-documentos', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Sem `empresa_id`: a tabela nao a tem. O inquilino vem da RLS
      // (`documento_pertence_empresa`), e filtrar por ela devolveria 400.
      const { data, error } = await supabase
        .from('documentos_aprovacoes')
        .select('id, documento_id, created_at, documentos:documento_id(nome)')
        .eq('aprovador_id', userId!)
        .eq('status', 'pendente')
        .eq('tipo_acao', 'solicitacao');
      if (error) throw error;
      return (data ?? []).map((a: any) => ({
        id: `documento-${a.id}`,
        titulo: a.documentos?.nome ?? '-',
        origem: 'documento' as const,
        origemRef: null,
        // Nao ha prazo de decisao nesta tabela; fica sem prazo, e a ordenacao
        // manda-o para o fim. E deliberado: nao se inventa urgencia.
        prazo: null,
        href: `/documentos?aprovar=${a.documento_id}`,
      }));
    },
  });

  const riscosPendentes = useQuery({
    queryKey: ['minhas-pendencias-riscos', userId, empresaId],
    enabled: ativo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Duas filas na mesma tabela: aprovar o risco, e aprovar o seu aceite.
      const [aprovacao, aceite] = await Promise.all([
        supabase.from('riscos').select('id, nome')
          .eq('empresa_id', empresaId!).eq('aprovador_id', userId!)
          .eq('status_aprovacao', 'pendente_aprovacao'),
        supabase.from('riscos').select('id, nome')
          .eq('empresa_id', empresaId!).eq('aprovador_aceite', userId!)
          .eq('status_aceite', 'pendente'),
      ]);
      if (aprovacao.error) throw aprovacao.error;
      if (aceite.error) throw aceite.error;
      return [
        ...(aprovacao.data ?? []).map((r: any) => ({
          id: `risco-${r.id}`, titulo: r.nome, origem: 'risco' as const,
          origemRef: null, prazo: null, href: `/riscos?risco=${r.id}`,
        })),
        ...(aceite.data ?? []).map((r: any) => ({
          id: `aceite-${r.id}`, titulo: r.nome, origem: 'aceiteRisco' as const,
          origemRef: null, prazo: null, href: `/riscos?risco=${r.id}`,
        })),
      ];
    },
  });

  const revisoes = useQuery({
    queryKey: ['minhas-pendencias-revisoes', userId, empresaId],
    enabled: ativo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_reviews')
        .select('id, nome_revisao, data_limite, total_contas, contas_revisadas')
        .eq('empresa_id', empresaId!)
        .eq('responsavel_revisao', userId!)
        .eq('status', 'em_andamento');
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: `revisao-${r.id}`,
        titulo: r.nome_revisao,
        origem: 'revisaoAcessos' as const,
        origemRef: r.total_contas ? `${r.contas_revisadas ?? 0}/${r.total_contas}` : null,
        prazo: r.data_limite ?? null,
        href: '/revisao-acessos',
      }));
    },
  });

  const denunciasMinhas = useQuery({
    queryKey: ['minhas-pendencias-denuncias', userId, empresaId],
    enabled: ativo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      /*
        So as colunas minimas: a linha carrega nome, e-mail, telefone e IP do
        denunciante. E a RLS (`pode_ver_denuncia`) ja esconde os casos onde
        estou impedido por conflito de interesse -- filtrar por `responsavel_id`
        devolve um subconjunto do que ela permite, nunca mais.
      */
      const { data, error } = await supabase
        .from('denuncias')
        .select('id, titulo, protocolo, prazo_acusacao, prazo_retorno, data_acusacao_recebimento')
        .eq('empresa_id', empresaId!)
        .eq('responsavel_id', userId!)
        .in('status', ['nova', 'em_analise', 'em_investigacao']);
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        id: `denuncia-${d.id}`,
        titulo: d.titulo,
        origem: 'denuncia' as const,
        origemRef: d.protocolo ?? null,
        // Enquanto a acusacao nao foi recebida, o relogio e o dela; depois
        // passa a ser o do retorno. Mesma regua do DenunciaRelogio.
        prazo: d.data_acusacao_recebimento ? (d.prazo_retorno ?? null) : (d.prazo_acusacao ?? null),
        href: '/denuncia',
      }));
    },
  });

  const titulares = useQuery({
    queryKey: ['minhas-pendencias-titulares', userId, empresaId],
    enabled: ativo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dados_solicitacoes_titular')
        .select('id, tipo_solicitacao, prazo_resposta, status')
        .eq('empresa_id', empresaId!)
        .eq('responsavel_analise', userId!)
        .not('status', 'in', '(atendida,rejeitada)');
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        id: `titular-${s.id}`,
        titulo: s.tipo_solicitacao,
        origem: 'titular' as const,
        origemRef: null,
        // Prazo LEGAL (LGPD/RGPD). E o unico desta lista que traz multa.
        prazo: s.prazo_resposta ?? null,
        href: '/privacidade',
      }));
    },
  });

  const itens = useMemo<Pendencia[]>(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const juntos = [
      ...(tarefas.data ?? []),
      ...(planos.data ?? []),
      ...(aprovacoesDocumento.data ?? []),
      ...(riscosPendentes.data ?? []),
      ...(revisoes.data ?? []),
      ...(denunciasMinhas.data ?? []),
      ...(titulares.data ?? []),
    ].map((p) => {
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
  }, [tarefas.data, planos.data, aprovacoesDocumento.data, riscosPendentes.data, revisoes.data, denunciasMinhas.data, titulares.data]);

  return {
    itens,
    total: itens.length,
    atrasadas: itens.filter((i) => i.atrasada).length,
    isLoading:
      tarefas.isLoading ||
      planos.isLoading ||
      aprovacoesDocumento.isLoading ||
      riscosPendentes.isLoading ||
      revisoes.isLoading ||
      denunciasMinhas.isLoading ||
      titulares.isLoading,
  };
}
