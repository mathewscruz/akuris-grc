import * as React from 'react';
import { corteAltoValor, criticidadeAtivo, isAtivoAltoValor } from '@/lib/metrics/ativos';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { AtivosIcon, RiscosIcon, IncidentesIcon, DocumentosIcon, DueDiligenceIcon, DenunciasIcon, ControlesIcon, IconView, IconExternal, IconInfo, IconArrowRight, IconScale, IconChecklist, IconKey, IconShieldCheck, IconActivity, IconLock, IconServer, IconChart, IconUserCheck } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/icons/Icon';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { logger } from '@/lib/logger';
import { formatDateShort, formatDateOnly, formatarDiaParaDB } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Limite superior da janela, em `YYYY-MM-DD`, para os recortes de "vencendo".
 * Formatado a partir dos componentes LOCAIS: `toISOString()` converte para UTC
 * primeiro e, a oeste de Greenwich, entrega o dia anterior.
 */
const emJanela = (dias: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return formatarDiaParaDB(d);
};

type TFunc = (key: string, params?: Record<string, string | number>) => string;

export type DrillDownKey =
  | 'ativos'
  | 'riscos'
  | 'incidentes'
  | 'planos'
  | 'contratos'
  | 'contratos_vencidos'
  | 'contratos_vencendo'
  | 'documentos'
  | 'due_diligence'
  | 'denuncias'
  | 'controles'
  | 'ativos_chaves'
  | 'ativos_licencas'
  | 'auditorias'
  | 'continuidade'
  | 'gap_analysis'
  | 'revisao_acessos'
  | 'privacidade'
  | 'privacidade_fora_prazo'
  | 'documentos_vencendo'
  | 'ativos_operacionais'
  | 'incidentes_investigacao'
  | 'privacidade_catalogo'
  | 'privacidade_sensiveis'
  | 'privacidade_mapeamentos'
  | 'documentos_vencidos'
  | 'documentos_pendentes'
  | 'ativos_alto_valor'
  | 'ativos_criticos'
  | 'incidentes_criticos'
  | 'riscos_aceite'
  | 'controles_vencidos'
  | 'controles_vencendo'
  | 'controles_testados'
  | 'controles_preventivos'
  | 'sistemas_ativos'
  | 'sistemas_criticos'
  | 'sistemas_inativos'
  | 'denuncias_novas'
  | 'denuncias_andamento'
  | 'denuncias_resolvidas'
  | 'continuidade_ativos'
  | 'continuidade_revisao'
  | 'continuidade_testes'
  | 'continuidade_tarefas'
  | 'contas_pendentes'
  | 'contas_vencendo'
  | 'contas_expiradas'
  | 'auditorias_andamento'
  | 'auditorias_pendentes'
  | 'auditorias_itens'
  | 'licencas_ativas'
  | 'licencas_a_vencer'
  | 'licencas_vencidas'
  | 'chaves_ativas'
  | 'chaves_rotacao'
  | 'chaves_criticas'
  | 'riscos_aceite_pendentes'
  | 'riscos_aceite_revisoes'
  | 'due_diligence_fornecedores'
  | 'due_diligence_concluidos'
  | 'due_diligence_expirados'
  | 'contratos_vigentes'
  | 'contratos_renovacao'
  | 'revisao_acessos_vencidas'
  | 'sistemas'
  | 'contas_privilegiadas';

interface DrillItem {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  tone?: 'destructive' | 'warning' | 'success' | 'info' | 'neutral' | 'primary';
  date?: string;
}

interface DrillConfig {
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
  fetcher: (empresaId: string) => Promise<DrillItem[]>;
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return undefined;
  try {
    return formatDateShort(iso);
  } catch {
    return undefined;
  }
};

/**
 * O dia de hoje, em `YYYY-MM-DD`, pelos componentes LOCAIS.
 *
 * Estava `new Date().toISOString().slice(0, 10)`, que converte para UTC antes
 * de cortar: em Brasília, a partir das 21:00, "hoje" saltava para amanhã. As
 * gavetas de vencimento passavam a usar um dia diferente do `emJanela()` logo
 * acima — dois fusos dentro da mesma janela de trinta dias — e diferente do
 * dia com que os cartões contam. Uma licença que vencia hoje mudava de gaveta
 * às nove da noite sem que nada tivesse acontecido.
 */
const todayIso = () => formatarDiaParaDB(new Date());


/**
 * Um KPI, uma gaveta — a tabela.
 *
 * O `switch` abaixo tinha uma entrada por MÓDULO, não por cartão: os cinco
 * tiles de Privacidade, os quatro de Documentos, os cinco de Controles e mais
 * nove módulos partilhavam, cada grupo, uma única consulta. Clicar em "Chaves
 * críticas" abria a mesma lista que "Total de chaves".
 *
 * A causa não é descuido de quem escreveu cada tile: escrever um `case` novo
 * custava vinte e cinco linhas de consulta quase idêntica à do vizinho, e o
 * caminho barato era reaproveitar a chave do lado. Isto torna o caminho barato
 * o correcto — um recorte é uma linha declarativa, e a única coisa que muda
 * entre irmãos é o filtro.
 *
 * O que NÃO cabe aqui (junções entre tabelas, quartis calculados em memória)
 * continua a ter o seu `case` explícito mais abaixo. A tabela serve o caso
 * simples; ninguém é obrigado a torcê-la para servir o caso difícil.
 */
type Recorte = {
  tabela: string;
  campos: string;
  rota: string;
  icone: React.ElementType;
  /** Filtros próprios do recorte. `empresa_id` e `limit` são sempre aplicados. */
  onde?: (q: any) => any;
  ordem?: [string, boolean];
  titulo: (r: any) => string;
  sub?: (r: any) => string | undefined;
  estado?: (r: any) => string | undefined;
  tom?: (r: any) => DrillItem['tone'];
  quando?: (r: any) => string | null | undefined;
};

/** Tom por criticidade, com as várias grafias que o produto grava. */
const tomPorNivel = (v?: string | null): DrillItem['tone'] => {
  const n = (v || '').toLowerCase();
  if (n.includes('crit')) return 'destructive';
  if (n.includes('alt')) return 'warning';
  if (n.includes('med') || n.includes('méd')) return 'info';
  return 'neutral';
};

const RECORTES: Record<string, Recorte> = {
  // ---- Controles ---------------------------------------------------------
  controles_vencidos: {
    tabela: 'controles', campos: 'id, nome, codigo, criticidade, proxima_avaliacao',
    rota: '/governanca/controles', icone: ControlesIcon,
    onde: (q) => q.lt('proxima_avaliacao', todayIso()),
    ordem: ['proxima_avaliacao', true],
    titulo: (c) => c.nome, sub: (c) => c.codigo,
    estado: (c) => formatStatus(c.criticidade || ''), tom: () => 'destructive',
    quando: (c) => c.proxima_avaliacao,
  },
  controles_vencendo: {
    tabela: 'controles', campos: 'id, nome, codigo, criticidade, proxima_avaliacao',
    rota: '/governanca/controles', icone: ControlesIcon,
    onde: (q) => q.gte('proxima_avaliacao', todayIso()).lte('proxima_avaliacao', emJanela(30)),
    ordem: ['proxima_avaliacao', true],
    titulo: (c) => c.nome, sub: (c) => c.codigo,
    estado: (c) => formatStatus(c.criticidade || ''), tom: () => 'warning',
    quando: (c) => c.proxima_avaliacao,
  },
  controles_preventivos: {
    tabela: 'controles', campos: 'id, nome, codigo, tipo, criticidade',
    rota: '/governanca/controles', icone: ControlesIcon,
    onde: (q) => q.eq('tipo', 'preventivo'),
    titulo: (c) => c.nome, sub: (c) => c.codigo,
    estado: (c) => formatStatus(c.tipo || ''), tom: () => 'success',
  },
  // ---- Sistemas privilegiados -------------------------------------------
  sistemas_ativos: {
    tabela: 'sistemas_privilegiados', campos: 'id, nome_sistema, tipo_sistema, criticidade, updated_at',
    rota: '/sistemas', icone: IconServer,
    onde: (q) => q.eq('ativo', true), ordem: ['updated_at', false],
    titulo: (x) => x.nome_sistema, sub: (x) => formatStatus(x.tipo_sistema || ''),
    estado: (x) => formatStatus(x.criticidade || ''), tom: (x) => tomPorNivel(x.criticidade),
    quando: (x) => x.updated_at,
  },
  sistemas_criticos: {
    tabela: 'sistemas_privilegiados', campos: 'id, nome_sistema, tipo_sistema, criticidade, updated_at',
    rota: '/sistemas', icone: IconServer,
    // As três grafias que a página conta como criticidade alta.
    onde: (q) => q.in('criticidade', ['critica', 'critico', 'alta']),
    titulo: (x) => x.nome_sistema, sub: (x) => formatStatus(x.tipo_sistema || ''),
    estado: (x) => formatStatus(x.criticidade || ''), tom: (x) => tomPorNivel(x.criticidade),
    quando: (x) => x.updated_at,
  },
  sistemas_inativos: {
    tabela: 'sistemas_privilegiados', campos: 'id, nome_sistema, tipo_sistema, criticidade, updated_at',
    rota: '/sistemas', icone: IconServer,
    onde: (q) => q.eq('ativo', false), ordem: ['updated_at', false],
    titulo: (x) => x.nome_sistema, sub: (x) => formatStatus(x.tipo_sistema || ''),
    tom: () => 'neutral', quando: (x) => x.updated_at,
  },
  // ---- Denúncias ---------------------------------------------------------
  denuncias_novas: {
    tabela: 'denuncias', campos: 'id, protocolo, titulo, gravidade, created_at',
    rota: '/denuncia', icone: DenunciasIcon,
    onde: (q) => q.eq('status', 'nova'), ordem: ['created_at', false],
    titulo: (x) => x.titulo || x.protocolo, sub: (x) => x.protocolo,
    estado: (x) => formatStatus(x.gravidade || ''), tom: (x) => tomPorNivel(x.gravidade),
    quando: (x) => x.created_at,
  },
  denuncias_andamento: {
    tabela: 'denuncias', campos: 'id, protocolo, titulo, gravidade, status, created_at',
    rota: '/denuncia', icone: DenunciasIcon,
    onde: (q) => q.in('status', ['em_analise', 'em_investigacao']), ordem: ['created_at', false],
    titulo: (x) => x.titulo || x.protocolo, sub: (x) => formatStatus(x.status || ''),
    estado: (x) => formatStatus(x.gravidade || ''), tom: (x) => tomPorNivel(x.gravidade),
    quando: (x) => x.created_at,
  },
  denuncias_resolvidas: {
    tabela: 'denuncias', campos: 'id, protocolo, titulo, status, created_at',
    rota: '/denuncia', icone: DenunciasIcon,
    onde: (q) => q.in('status', ['resolvida', 'arquivada']), ordem: ['created_at', false],
    titulo: (x) => x.titulo || x.protocolo, sub: (x) => x.protocolo,
    estado: (x) => formatStatus(x.status || ''), tom: () => 'success',
    quando: (x) => x.created_at,
  },
  // ---- Continuidade ------------------------------------------------------
  continuidade_ativos: {
    tabela: 'continuidade_planos', campos: 'id, nome, tipo, proxima_revisao',
    rota: '/continuidade', icone: IconShieldCheck,
    onde: (q) => q.eq('status', 'ativo'), ordem: ['proxima_revisao', true],
    titulo: (x) => x.nome, sub: (x) => formatStatus(x.tipo || ''),
    tom: () => 'success', quando: (x) => x.proxima_revisao,
  },
  continuidade_revisao: {
    tabela: 'continuidade_planos', campos: 'id, nome, tipo, proxima_revisao',
    rota: '/continuidade', icone: IconShieldCheck,
    onde: (q) => q.eq('status', 'em_revisao'), ordem: ['proxima_revisao', true],
    titulo: (x) => x.nome, sub: (x) => formatStatus(x.tipo || ''),
    tom: () => 'warning', quando: (x) => x.proxima_revisao,
  },
  continuidade_testes: {
    tabela: 'continuidade_testes', campos: 'id, tipo_teste, resultado, data_teste',
    rota: '/continuidade', icone: IconChecklist,
    ordem: ['data_teste', false],
    titulo: (x) => formatStatus(x.tipo_teste || ''), sub: (x) => formatStatus(x.resultado || ''),
    tom: (x) => ((x.resultado || '').toLowerCase().includes('sucesso') ? 'success' : 'info'),
    quando: (x) => x.data_teste,
  },
  continuidade_tarefas: {
    // O tile contava `continuidade_tarefas` e abria a gaveta de `planos_acao`:
    // o número vinha de uma tabela e a lista de outra, com o "ver todos" a
    // atirar o utilizador para fora do módulo.
    tabela: 'continuidade_tarefas', campos: 'id, titulo, prioridade, status, prazo',
    rota: '/continuidade', icone: IconChecklist,
    onde: (q) => q.eq('status', 'pendente'), ordem: ['prazo', true],
    titulo: (x) => x.titulo, sub: (x) => formatStatus(x.prioridade || ''),
    estado: (x) => formatStatus(x.status || ''), tom: (x) => tomPorNivel(x.prioridade),
    quando: (x) => x.prazo,
  },
  // ---- Contas privilegiadas ---------------------------------------------
  contas_pendentes: {
    tabela: 'contas_privilegiadas', campos: 'id, usuario_beneficiario, nivel_privilegio, data_expiracao',
    rota: '/contas-privilegiadas', icone: IconLock,
    onde: (q) => q.eq('status', 'pendente_aprovacao'), ordem: ['data_expiracao', true],
    titulo: (x) => x.usuario_beneficiario, sub: (x) => formatStatus(x.nivel_privilegio || ''),
    tom: () => 'warning', quando: (x) => x.data_expiracao,
  },
  contas_vencendo: {
    tabela: 'contas_privilegiadas', campos: 'id, usuario_beneficiario, nivel_privilegio, data_expiracao',
    rota: '/contas-privilegiadas', icone: IconLock,
    onde: (q) => q.eq('status', 'ativo').gte('data_expiracao', todayIso()).lte('data_expiracao', emJanela(30)),
    ordem: ['data_expiracao', true],
    titulo: (x) => x.usuario_beneficiario, sub: (x) => formatStatus(x.nivel_privilegio || ''),
    tom: () => 'warning', quando: (x) => x.data_expiracao,
  },
  contas_expiradas: {
    tabela: 'contas_privilegiadas', campos: 'id, usuario_beneficiario, nivel_privilegio, status, data_expiracao',
    rota: '/contas-privilegiadas', icone: IconLock,
    // Como na página: `expirado` gravado OU activa com a data já no passado —
    // o estado não é actualizado sozinho quando a data vence.
    onde: (q) => q.or(`status.eq.expirado,and(status.eq.ativo,data_expiracao.lt.${todayIso()})`),
    ordem: ['data_expiracao', true],
    titulo: (x) => x.usuario_beneficiario, sub: (x) => formatStatus(x.nivel_privilegio || ''),
    tom: () => 'destructive', quando: (x) => x.data_expiracao,
  },
  // ---- Auditorias --------------------------------------------------------
  auditorias_andamento: {
    tabela: 'auditorias', campos: 'id, nome, tipo, data_inicio',
    rota: '/governanca/auditorias', icone: IconChecklist,
    onde: (q) => q.eq('status', 'em_andamento'), ordem: ['data_inicio', true],
    titulo: (x) => x.nome, sub: (x) => formatStatus(x.tipo || ''),
    tom: () => 'info', quando: (x) => x.data_inicio,
  },
  auditorias_pendentes: {
    tabela: 'auditorias', campos: 'id, nome, tipo, data_inicio',
    rota: '/governanca/auditorias', icone: IconChecklist,
    onde: (q) => q.eq('status', 'planejamento'), ordem: ['data_inicio', true],
    titulo: (x) => x.nome, sub: (x) => formatStatus(x.tipo || ''),
    tom: () => 'warning', quando: (x) => x.data_inicio,
  },
  // ---- Licenças ----------------------------------------------------------
  licencas_ativas: {
    tabela: 'ativos_licencas', campos: 'id, nome, tipo_licenca, criticidade, data_vencimento',
    rota: '/ativos/licencas', icone: IconKey,
    onde: (q) => q.eq('status', 'ativa'), ordem: ['data_vencimento', true],
    titulo: (x) => x.nome, sub: (x) => formatStatus(x.tipo_licenca || ''),
    estado: (x) => formatStatus(x.criticidade || ''), tom: () => 'success',
    quando: (x) => x.data_vencimento,
  },
  licencas_a_vencer: {
    tabela: 'ativos_licencas', campos: 'id, nome, tipo_licenca, criticidade, data_vencimento',
    rota: '/ativos/licencas', icone: IconKey,
    onde: (q) => q.gte('data_vencimento', todayIso()).lte('data_vencimento', emJanela(30)),
    ordem: ['data_vencimento', true],
    titulo: (x) => x.nome, sub: (x) => formatStatus(x.tipo_licenca || ''),
    estado: (x) => formatStatus(x.criticidade || ''), tom: () => 'warning',
    quando: (x) => x.data_vencimento,
  },
  licencas_vencidas: {
    tabela: 'ativos_licencas', campos: 'id, nome, tipo_licenca, criticidade, data_vencimento',
    rota: '/ativos/licencas', icone: IconKey,
    onde: (q) => q.lt('data_vencimento', todayIso()), ordem: ['data_vencimento', true],
    titulo: (x) => x.nome, sub: (x) => formatStatus(x.tipo_licenca || ''),
    estado: (x) => formatStatus(x.criticidade || ''), tom: () => 'destructive',
    quando: (x) => x.data_vencimento,
  },
  // ---- Chaves criptográficas --------------------------------------------
  chaves_ativas: {
    tabela: 'ativos_chaves_criptograficas', campos: 'id, nome, tipo_chave, criticidade, data_proxima_rotacao',
    rota: '/ativos/chaves', icone: IconKey,
    onde: (q) => q.eq('status', 'ativa'), ordem: ['data_proxima_rotacao', true],
    titulo: (x) => x.nome, sub: (x) => formatStatus(x.tipo_chave || ''),
    estado: (x) => formatStatus(x.criticidade || ''), tom: () => 'success',
    quando: (x) => x.data_proxima_rotacao,
  },
  chaves_rotacao: {
    tabela: 'ativos_chaves_criptograficas', campos: 'id, nome, tipo_chave, criticidade, data_proxima_rotacao',
    rota: '/ativos/chaves', icone: IconKey,
    // Sem piso inferior: uma chave que devia ter rodado no mês passado é a
    // mais pendente de todas. É o mesmo critério do KPI.
    onde: (q) => q.lte('data_proxima_rotacao', emJanela(30)),
    ordem: ['data_proxima_rotacao', true],
    titulo: (x) => x.nome, sub: (x) => formatStatus(x.tipo_chave || ''),
    estado: (x) => formatStatus(x.criticidade || ''), tom: () => 'warning',
    quando: (x) => x.data_proxima_rotacao,
  },
  chaves_criticas: {
    tabela: 'ativos_chaves_criptograficas', campos: 'id, nome, tipo_chave, criticidade, data_proxima_rotacao',
    rota: '/ativos/chaves', icone: IconKey,
    onde: (q) => q.eq('criticidade', 'critica').eq('status', 'ativa'),
    ordem: ['data_proxima_rotacao', true],
    titulo: (x) => x.nome, sub: (x) => formatStatus(x.tipo_chave || ''),
    estado: (x) => formatStatus(x.criticidade || ''), tom: () => 'destructive',
    quando: (x) => x.data_proxima_rotacao,
  },
  // ---- Aceite de risco ---------------------------------------------------
  riscos_aceite_pendentes: {
    tabela: 'riscos', campos: 'id, nome, nivel_risco_residual, nivel_risco_inicial, created_at',
    rota: '/riscos/aceite', icone: RiscosIcon,
    onde: (q) => q.eq('status_aceite', 'pendente'), ordem: ['created_at', false],
    titulo: (r) => r.nome,
    estado: (r) => formatStatus(r.nivel_risco_residual || r.nivel_risco_inicial || ''),
    tom: (r) => tomPorNivel(r.nivel_risco_residual || r.nivel_risco_inicial),
    quando: (r) => r.created_at,
  },
  riscos_aceite_revisoes: {
    tabela: 'riscos', campos: 'id, nome, nivel_risco_residual, nivel_risco_inicial, data_proxima_revisao',
    rota: '/riscos/aceite', icone: RiscosIcon,
    onde: (q) => q.eq('aceito', true).lt('data_proxima_revisao', todayIso()),
    ordem: ['data_proxima_revisao', true],
    titulo: (r) => r.nome,
    estado: (r) => formatStatus(r.nivel_risco_residual || r.nivel_risco_inicial || ''),
    tom: () => 'destructive', quando: (r) => r.data_proxima_revisao,
  },
  // ---- Due diligence -----------------------------------------------------
  due_diligence_fornecedores: {
    tabela: 'fornecedores', campos: 'id, nome, categoria, avaliacao_risco, updated_at',
    rota: '/due-diligence', icone: DueDiligenceIcon,
    onde: (q) => q.eq('status', 'ativo'), ordem: ['nome', true],
    titulo: (f) => f.nome, sub: (f) => formatStatus(f.categoria || ''),
    estado: (f) => formatStatus(f.avaliacao_risco || ''), tom: (f) => tomPorNivel(f.avaliacao_risco),
  },
  due_diligence_concluidos: {
    tabela: 'due_diligence_assessments', campos: 'id, fornecedor_nome, score_final, updated_at',
    rota: '/due-diligence', icone: DueDiligenceIcon,
    onde: (q) => q.eq('status', 'concluido'), ordem: ['updated_at', false],
    titulo: (a) => a.fornecedor_nome,
    estado: (a) => (typeof a.score_final === 'number' ? `${a.score_final}%` : undefined),
    tom: (a) => (typeof a.score_final !== 'number' ? 'neutral' : a.score_final < 50 ? 'destructive' : a.score_final < 70 ? 'warning' : 'success'),
    quando: (a) => a.updated_at,
  },
  due_diligence_expirados: {
    tabela: 'due_diligence_assessments', campos: 'id, fornecedor_nome, status, data_expiracao',
    rota: '/due-diligence', icone: DueDiligenceIcon,
    onde: (q) => q.neq('status', 'concluido').lt('data_expiracao', todayIso()),
    ordem: ['data_expiracao', true],
    titulo: (a) => a.fornecedor_nome, sub: (a) => formatStatus(a.status || ''),
    tom: () => 'destructive', quando: (a) => a.data_expiracao,
  },
  // ---- Contratos ---------------------------------------------------------
  contratos_vigentes: {
    tabela: 'contratos', campos: 'id, nome, numero_contrato, status, data_fim',
    rota: '/contratos', icone: IconScale,
    // Mesmo critério de `isContratoVigente`: sem data de fim é contrato por
    // prazo indeterminado, e conta como vigente. O `.gte` sozinho excluía-o —
    // o KPI somava-lhe o valor e a gaveta não o mostrava.
    onde: (q) => q.in('status', ['ativo', 'vigente']).or(`data_fim.is.null,data_fim.gte.${todayIso()}`),
    ordem: ['data_fim', true],
    titulo: (c) => c.nome || c.numero_contrato || '',
    sub: (c) => c.numero_contrato, estado: (c) => formatStatus(c.status || ''),
    tom: () => 'success', quando: (c) => c.data_fim,
  },
  contratos_renovacao: {
    tabela: 'contratos', campos: 'id, nome, numero_contrato, status, data_fim',
    rota: '/contratos', icone: IconScale,
    onde: (q) => q.eq('renovacao_automatica', true), ordem: ['data_fim', true],
    titulo: (c) => c.nome || c.numero_contrato || '',
    sub: (c) => c.numero_contrato, estado: (c) => formatStatus(c.status || ''),
    tom: () => 'info', quando: (c) => c.data_fim,
  },
  // ---- Revisão de acessos ------------------------------------------------
  revisao_acessos_vencidas: {
    tabela: 'access_reviews', campos: 'id, nome_revisao, data_limite, total_contas',
    rota: '/revisao-acessos', icone: IconUserCheck,
    onde: (q) => q.eq('status', 'em_andamento').lt('data_limite', todayIso()),
    ordem: ['data_limite', true],
    titulo: (r) => r.nome_revisao,
    tom: () => 'destructive', quando: (r) => r.data_limite,
  },
};

const buildConfig = (key: DrillDownKey, t: TFunc): DrillConfig => {
  const d = (k: string) => t(`dashWidgets.drill.${k}`);
  const recorte = RECORTES[key];
  if (recorte) {
    return {
      title: d(`${key}.title`),
      description: d(`${key}.description`),
      icon: recorte.icone,
      route: recorte.rota,
      fetcher: async (empresaId) => {
        let q: any = (supabase.from(recorte.tabela as any).select(recorte.campos) as any)
          .eq('empresa_id', empresaId);
        if (recorte.onde) q = recorte.onde(q);
        if (recorte.ordem) q = q.order(recorte.ordem[0], { ascending: recorte.ordem[1], nullsFirst: false });
        const { data, error } = await q.limit(5);
        if (error) throw error;
        return (data || []).map((r: any) => ({
          id: r.id,
          title: recorte.titulo(r),
          subtitle: recorte.sub?.(r),
          status: recorte.estado?.(r),
          tone: recorte.tom?.(r) ?? 'neutral',
          date: fmtDate(recorte.quando?.(r)),
        }));
      },
    };
  }
  switch (key) {
    case 'riscos':
      return {
        title: d('riscos.title'),
        description: d('riscos.description'),
        icon: RiscosIcon,
        route: '/riscos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('riscos')
            .select('id, nome, nivel_risco_residual, nivel_risco_inicial, status, updated_at')
            .eq('empresa_id', empresaId)
            .eq('aceito', false)
            .order('updated_at', { ascending: false })
            .limit(20);
          if (error) throw error;
          const rank = (n?: string) => {
            const v = (n || '').toLowerCase();
            if (v.includes('crit')) return 4;
            if (v.includes('alt')) return 3;
            if (v.includes('med') || v.includes('méd')) return 2;
            if (v.includes('baix')) return 1;
            return 0;
          };
          return (data || [])
            .map((r: any) => ({ ...r, _nivel: r.nivel_risco_residual || r.nivel_risco_inicial }))
            .sort((a: any, b: any) => rank(b._nivel) - rank(a._nivel))
            .slice(0, 5)
            .map((r: any) => {
              const nivel = (r._nivel || '').toLowerCase();
              return {
                id: r.id,
                title: r.nome,
                subtitle: r.status,
                status: r._nivel || d('noLevel'),
                tone: (nivel.includes('crit') ? 'destructive' : nivel.includes('alt') ? 'warning' : nivel.includes('med') ? 'info' : 'neutral') as DrillItem['tone'],
                date: fmtDate(r.updated_at),
              };
            });
        },
      };
    case 'incidentes':
      return {
        title: d('incidentes.title'),
        description: d('incidentes.description'),
        icon: IncidentesIcon,
        route: '/incidentes',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('incidentes')
            .select('id, titulo, status, criticidade, created_at')
            .eq('empresa_id', empresaId)
            // O produto grava `aberto`, `em_investigacao`, `contido` e
            // `resolvido`. Desta lista, só `aberto` existe: a gaveta abria
            // vazia com dois incidentes em curso no banco.
            .in('status', ['aberto', 'em_investigacao', 'contido'])
            .order('created_at', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((i: any) => {
            const c = (i.criticidade || '').toLowerCase();
            return {
              id: i.id,
              title: i.titulo,
              subtitle: formatStatus(i.status || ''),
              status: formatStatus(i.criticidade || ''),
              tone: (c.includes('crit') ? 'destructive' : c.includes('alt') ? 'warning' : 'info') as DrillItem['tone'],
              date: fmtDate(i.created_at),
            };
          });
        },
      };
    case 'planos':
      return {
        title: d('planos.title'),
        description: d('planos.description'),
        icon: IconChecklist,
        route: '/planos-acao',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('planos_acao')
            .select('id, titulo, status, prazo, created_at')
            .eq('empresa_id', empresaId)
            .neq('status', 'concluido')
            .order('prazo', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((p: any) => {
            const overdue = p.prazo && p.prazo < today;
            return {
              id: p.id,
              title: p.titulo,
              subtitle: p.status,
              status: overdue ? d('overdue') : p.status,
              tone: (overdue ? 'destructive' : 'info') as DrillItem['tone'],
              date: fmtDate(p.prazo),
            };
          });
        },
      };
    case 'ativos':
      return {
        title: d('ativos.title'),
        description: d('ativos.description'),
        icon: AtivosIcon,
        route: '/ativos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('ativos')
            .select('id, nome, tipo, criticidade, updated_at')
            .eq('empresa_id', empresaId)
            .order('updated_at', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((a: any) => ({
            id: a.id,
            title: a.nome,
            subtitle: formatStatus(a.tipo || ''),
            status: formatStatus(a.criticidade || ''),
            tone: a.criticidade === 'alta' ? 'warning' : 'neutral',
            date: fmtDate(a.updated_at),
          }));
        },
      };
    // As quatro KPIs de contratos abriam TODAS esta mesma lista: clicar em
    // "Valor vencido" (1 contrato) mostrava os cinco, incluindo rascunhos e
    // contratos que vencem no ano seguinte. Cada tile passa a abrir a lista
    // que o rótulo promete. E a data leva o ano — "03 de jul" não distingue
    // 2026 de 2027, que é a única pergunta num vencimento.
    case 'contratos':
    case 'contratos_vencidos':
    case 'contratos_vencendo': {
      const escopo = key;
      return {
        title: d(`${escopo}.title`),
        description: d(`${escopo}.description`),
        icon: IconScale,
        route: '/contratos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('contratos')
            .select('id, nome, numero_contrato, status, data_fim')
            .eq('empresa_id', empresaId)
            .order('data_fim', { ascending: true, nullsFirst: false });
          if (error) throw error;
          const today = todayIso();
          const em30 = formatarDiaParaDB(new Date(Date.now() + 30 * 86400000));
          // Estados administrativos (rascunho, negociação, encerrado...) não
          // vencem: nunca entram nas listas de vencimento.
          const administra = (st: string) =>
            !['ativo', 'vigente'].includes((st || '').toLowerCase());
          const filtrado = (data || []).filter((c: any) => {
            if (escopo === 'contratos_vencidos') {
              return !administra(c.status) && c.data_fim && c.data_fim < today;
            }
            if (escopo === 'contratos_vencendo') {
              return !administra(c.status) && c.data_fim && c.data_fim >= today && c.data_fim <= em30;
            }
            return true;
          });
          return filtrado.slice(0, 5).map((c: any) => {
            const expired = c.data_fim && c.data_fim < today;
            return {
              id: c.id,
              title: c.nome || c.numero_contrato || d('fallbackContract'),
              subtitle: c.numero_contrato || formatStatus(c.status || ''),
              status: expired ? d('expired') : formatStatus(c.status || ''),
              tone: (expired ? 'destructive' : 'info') as DrillItem['tone'],
              date: formatDateOnly(c.data_fim),
            };
          });
        },
      };
    }
    case 'documentos':
      return {
        title: d('documentos.title'),
        description: d('documentos.description'),
        icon: DocumentosIcon,
        route: '/documentos',
        fetcher: async (empresaId) => {
          /*
            O painel promete um recorte no seu próprio subtítulo; a consulta
            trazia as primeiras N linhas da tabela. Um arquivado ou um rascunho
            aparecia em "vencendo", uma chave saudável em "próxima da rotação".
            Num painel de GRC isso enterra o que é problema no meio do que não é.
          */
          const { data, error } = await supabase
            .from('documentos')
            .select('id, nome, status, data_vencimento')
            .eq('empresa_id', empresaId)
            // O estado gravado é `pendente`; `pendente_aprovacao` não existe
            // numa única linha — três linhas abaixo o mesmo bloco já o tratava.
            .order('updated_at', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((d: any) => ({
            id: d.id,
            title: d.nome,
            subtitle: formatStatus(d.status || ''),
            status: formatStatus(d.status || ''),
            tone: (d.status === 'pendente' || d.status === 'pendente_aprovacao' ? 'warning' : 'info') as DrillItem['tone'],
            date: fmtDate(d.data_vencimento),
          }));
        },
      };
    case 'due_diligence':
      return {
        title: d('due_diligence.title'),
        description: d('due_diligence.description'),
        icon: DueDiligenceIcon,
        route: '/due-diligence',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('due_diligence_assessments')
            .select('id, fornecedor_nome, status, score_final, updated_at')
            .eq('empresa_id', empresaId)
            .neq('status', 'concluido')
            .order('updated_at', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((d: any) => {
            const score = d.score_final;
            return {
              id: d.id,
              title: d.fornecedor_nome,
              subtitle: d.status,
              status: typeof score === 'number' ? t('dashWidgets.drill.score', { value: score }) : undefined,
              tone: (typeof score !== 'number' ? 'neutral' : score < 50 ? 'destructive' : score < 70 ? 'warning' : 'success') as DrillItem['tone'],
              date: fmtDate(d.updated_at),
            };
          });
        },
      };
    case 'denuncias':
      return {
        title: d('denuncias.title'),
        description: d('denuncias.description'),
        icon: DenunciasIcon,
        route: '/denuncia',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('denuncias')
            .select('id, protocolo, titulo, gravidade, status, created_at')
            .eq('empresa_id', empresaId)
            .order('created_at', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((d: any) => {
            const g = (d.gravidade || '').toLowerCase();
            return {
              id: d.id,
              title: d.titulo || d.protocolo || t('dashWidgets.drill.fallbackComplaint'),
              subtitle: d.protocolo,
              status: d.gravidade || d.status,
              tone: (g.includes('crit') || g.includes('alt') ? 'destructive' : 'warning') as DrillItem['tone'],
              date: fmtDate(d.created_at),
            };
          });
        },
      };
    case 'controles':
      return {
        title: d('controles.title'),
        description: d('controles.description'),
        icon: ControlesIcon,
        route: '/governanca/controles',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('controles')
            .select('id, nome, codigo, status, criticidade, proxima_avaliacao')
            .eq('empresa_id', empresaId)
            .order('criticidade', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((c: any) => {
            const cr = (c.criticidade || '').toLowerCase();
            return {
              id: c.id,
              title: c.nome,
              subtitle: c.codigo || c.status,
              status: c.criticidade || c.status,
              tone: (cr.includes('alt') || cr.includes('crit') ? 'warning' : 'info') as DrillItem['tone'],
              date: fmtDate(c.proxima_avaliacao),
            };
          });
        },
      };

    // ── Novos módulos ──────────────────────────────────────────────────────
    case 'ativos_chaves':
      return {
        title: d('ativos_chaves.title'),
        description: d('ativos_chaves.description'),
        icon: IconKey,
        route: '/ativos/chaves',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('ativos_chaves_criptograficas')
            .select('id, nome, tipo_chave, criticidade, data_proxima_rotacao')
            .eq('empresa_id', empresaId)
            .order('data_proxima_rotacao', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((c: any) => {
            const overdue = c.data_proxima_rotacao && c.data_proxima_rotacao < today;
            return {
              id: c.id,
              title: c.nome,
              subtitle: c.tipo_chave,
              status: overdue ? d('rotationOverdue') : c.criticidade,
              tone: (overdue ? 'destructive' : c.criticidade === 'alta' ? 'warning' : 'neutral') as DrillItem['tone'],
              date: fmtDate(c.data_proxima_rotacao),
            };
          });
        },
      };
    case 'ativos_licencas':
      return {
        title: d('ativos_licencas.title'),
        description: d('ativos_licencas.description'),
        icon: IconKey,
        route: '/ativos/licencas',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('ativos_licencas')
            .select('id, nome, tipo_licenca, criticidade, data_vencimento')
            .eq('empresa_id', empresaId)
            .order('data_vencimento', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((l: any) => {
            const expired = l.data_vencimento && l.data_vencimento < today;
            return {
              id: l.id,
              title: l.nome,
              subtitle: l.tipo_licenca,
              status: expired ? d('expiredFem') : l.criticidade,
              tone: (expired ? 'destructive' : l.criticidade === 'alta' ? 'warning' : 'info') as DrillItem['tone'],
              date: fmtDate(l.data_vencimento),
            };
          });
        },
      };
    case 'auditorias':
      return {
        title: d('auditorias.title'),
        description: d('auditorias.description'),
        icon: IconChecklist,
        route: '/governanca/auditorias',
        fetcher: async (empresaId) => {
          // `auditoria_trabalhos` tem ZERO linhas em todo o produto — a gaveta
          // dos quatro KPIs de Auditorias abria sempre vazia. O que os KPIs
          // contam são as auditorias em si.
          const { data, error } = await supabase
            .from('auditorias')
            .select('id, nome, tipo, status, data_inicio')
            .eq('empresa_id', empresaId)
            .order('data_inicio', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((a: any) => ({
            id: a.id,
            title: a.nome,
            subtitle: a.tipo,
            status: a.status,
            tone: (a.status === 'em_andamento' ? 'info' : 'warning') as DrillItem['tone'],
            date: fmtDate(a.data_inicio),
          }));
        },
      };
    case 'continuidade':
      return {
        title: d('continuidade.title'),
        description: d('continuidade.description'),
        icon: IconShieldCheck,
        route: '/continuidade',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('continuidade_planos')
            .select('id, nome, tipo, status, proxima_revisao')
            .eq('empresa_id', empresaId)
            .order('proxima_revisao', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((p: any) => {
            const overdue = p.proxima_revisao && p.proxima_revisao < today;
            return {
              id: p.id,
              title: p.nome,
              subtitle: p.tipo,
              status: overdue ? d('reviewOverdue') : p.status,
              tone: (overdue ? 'destructive' : 'info') as DrillItem['tone'],
              date: fmtDate(p.proxima_revisao),
            };
          });
        },
      };
    case 'gap_analysis':
      return {
        title: d('gap_analysis.title'),
        description: d('gap_analysis.description'),
        icon: IconChart,
        route: '/gap-analysis/frameworks',
        fetcher: async (empresaId) => {
          // Lista os 5 frameworks com mais avaliações da empresa
          const { data, error } = await supabase
            .from('gap_analysis_evaluations')
            .select('framework_id, gap_analysis_frameworks!inner(id, nome, versao, tipo_framework)')
            .eq('empresa_id', empresaId)
            .limit(50);
          if (error) throw error;
          const counts = new Map<string, { fw: any; n: number }>();
          (data || []).forEach((row: any) => {
            const fw = row.gap_analysis_frameworks;
            if (!fw) return;
            const cur = counts.get(fw.id) || { fw, n: 0 };
            cur.n += 1;
            counts.set(fw.id, cur);
          });
          return Array.from(counts.values())
            .sort((a, b) => b.n - a.n)
            .slice(0, 5)
            .map(({ fw, n }) => ({
              id: fw.id,
              title: `${fw.nome} ${fw.versao || ''}`.trim(),
              subtitle: fw.tipo_framework,
              status: t('dashWidgets.drill.evaluationsCount', { count: n }),
              tone: 'info' as DrillItem['tone'],
            }));
        },
      };
    case 'revisao_acessos':
      return {
        title: d('revisao_acessos.title'),
        description: d('revisao_acessos.description'),
        icon: IconUserCheck,
        route: '/revisao-acessos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('access_reviews')
            .select('id, nome_revisao, status, data_limite, total_contas')
            .eq('empresa_id', empresaId)
            .eq('status', 'em_andamento')
            .order('data_limite', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((r: any) => {
            const overdue = r.data_limite && r.data_limite < today;
            return {
              id: r.id,
              title: r.nome_revisao,
              subtitle: t('dashWidgets.drill.accountsCount', { count: r.total_contas || 0 }),
              status: overdue ? d('overdueFem') : r.status,
              tone: (overdue ? 'destructive' : 'warning') as DrillItem['tone'],
              date: fmtDate(r.data_limite),
            };
          });
        },
      };
    case 'privacidade':
      return {
        title: d('privacidade.title'),
        description: d('privacidade.description'),
        icon: IconView,
        route: '/privacidade',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('dados_solicitacoes_titular')
            .select('id, tipo_solicitacao, status, prazo_resposta')
            .eq('empresa_id', empresaId)
            // O tile é "Solicitações pendentes" e a página conta
            // `status === 'pendente'`. O `.neq('concluida')` não excluía nada:
            // esta tabela não tem esse estado.
            .eq('status', 'pendente')
            .order('prazo_resposta', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((s: any) => {
            const overdue = s.prazo_resposta && s.prazo_resposta < today;
            return {
              id: s.id,
              title: formatStatus(s.tipo_solicitacao || ''),
              subtitle: formatStatus(s.status || ''),
              status: overdue ? d('deadlineExpired') : formatStatus(s.status || ''),
              tone: (overdue ? 'destructive' : 'warning') as DrillItem['tone'],
              date: fmtDate(s.prazo_resposta),
            };
          });
        },
      };
    /*
      Um KPI, uma gaveta.
      ---------------------------------------------------------------------
      Cinco cartoes de Privacidade, quatro de Documentos, quatro de Ativos e
      seis de Incidentes partilhavam a MESMA chave: clicar em "Total de Dados"
      abria a lista de solicitacoes de titular. Vinte e quatro cartoes a
      prometer recortes diferentes e a entregar sete gavetas.
    */
    case 'privacidade_fora_prazo':
      return {
        title: d('privacidade_fora_prazo.title'),
        description: d('privacidade_fora_prazo.description'),
        icon: IconView,
        route: '/privacidade',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('dados_solicitacoes_titular')
            .select('id, tipo_solicitacao, status, prazo_resposta')
            .eq('empresa_id', empresaId)
            // Encerradas não estão fora do prazo. É o mesmo corte da página.
            .not('status', 'in', '(atendida,rejeitada)')
            .lt('prazo_resposta', todayIso())
            .order('prazo_resposta', { ascending: true })
            .limit(5);
          if (error) throw error;
          return (data || []).map((s: any) => ({
            id: s.id,
            title: formatStatus(s.tipo_solicitacao || ''),
            subtitle: formatStatus(s.status || ''),
            status: d('deadlineExpired'),
            tone: 'destructive' as DrillItem['tone'],
            date: fmtDate(s.prazo_resposta),
          }));
        },
      };
    case 'documentos_vencendo':
      return {
        title: d('documentos_vencendo.title'),
        description: d('documentos_vencendo.description'),
        icon: DocumentosIcon,
        route: '/documentos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('documentos')
            .select('id, nome, status, data_vencimento')
            .eq('empresa_id', empresaId)
            .eq('status', 'ativo')
            .gte('data_vencimento', todayIso())
            .lte('data_vencimento', emJanela(30))
            .order('data_vencimento', { ascending: true })
            .limit(5);
          if (error) throw error;
          return (data || []).map((x: any) => ({
            id: x.id,
            title: x.nome,
            subtitle: formatStatus(x.status || ''),
            tone: 'warning' as DrillItem['tone'],
            date: fmtDate(x.data_vencimento),
          }));
        },
      };
    case 'ativos_operacionais':
      return {
        title: d('ativos_operacionais.title'),
        description: d('ativos_operacionais.description'),
        icon: AtivosIcon,
        route: '/ativos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('ativos')
            .select('id, nome, tipo, criticidade, status, updated_at')
            .eq('empresa_id', empresaId)
            .eq('status', 'ativo')
            .order('updated_at', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((a: any) => ({
            id: a.id,
            title: a.nome,
            subtitle: formatStatus(a.tipo || ''),
            status: formatStatus(a.criticidade || ''),
            tone: 'info' as DrillItem['tone'],
            date: fmtDate(a.updated_at),
          }));
        },
      };
    case 'incidentes_investigacao':
      return {
        title: d('incidentes_investigacao.title'),
        description: d('incidentes_investigacao.description'),
        icon: IncidentesIcon,
        route: '/incidentes',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('incidentes')
            .select('id, titulo, status, criticidade, created_at')
            .eq('empresa_id', empresaId)
            // O importador de CSV grava `investigacao` e o produto grava
            // `em_investigacao`: o cartão conta as duas e a gaveta só via uma.
            .in('status', ['em_investigacao', 'investigacao', 'em_analise', 'analise'])
            .order('created_at', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((i: any) => ({
            id: i.id,
            title: i.titulo,
            subtitle: formatStatus(i.status),
            status: formatStatus(i.criticidade || ''),
            tone: 'warning' as DrillItem['tone'],
            date: fmtDate(i.created_at),
          }));
        },
      };
    case 'privacidade_catalogo':
      return {
        title: d('privacidade_catalogo.title'),
        description: d('privacidade_catalogo.description'),
        icon: IconView,
        route: '/privacidade',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('dados_pessoais')
            .select('id, nome, categoria_dados, sensibilidade')
            .eq('empresa_id', empresaId)
            .order('nome')
            .limit(5);
          if (error) throw error;
          return (data || []).map((x: any) => ({
            id: x.id,
            title: x.nome,
            subtitle: formatStatus(x.categoria_dados || ''),
            status: formatStatus(x.sensibilidade || ''),
            tone: 'info' as DrillItem['tone'],
          }));
        },
      };
    case 'privacidade_sensiveis':
      return {
        title: d('privacidade_sensiveis.title'),
        description: d('privacidade_sensiveis.description'),
        icon: IconView,
        route: '/privacidade',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('dados_pessoais')
            .select('id, nome, categoria_dados, tipo_dados, sensibilidade')
            .eq('empresa_id', empresaId)
            // A página classifica por DUAS colunas: `tipo_dados = 'sensivel'`
            // com sensibilidade comum também conta. A gaveta olhava só para
            // uma e perdia esses registos.
            .or('tipo_dados.eq.sensivel,sensibilidade.in.(sensivel,muito_sensivel)')
            .order('sensibilidade', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((x: any) => {
            // O nível efectivo, como em Privacidade.tsx: `tipo_dados` sensível
            // ganha à sensibilidade comum, senão a gaveta "Dados sensíveis"
            // mostrava o crachá "Comum" ao lado do registo.
            const nivel = x.tipo_dados === 'sensivel' && (x.sensibilidade || 'comum') === 'comum'
              ? 'sensivel'
              : (x.sensibilidade || 'comum');
            return {
              id: x.id,
              title: x.nome,
              subtitle: formatStatus(x.categoria_dados || ''),
              status: formatStatus(nivel),
              tone: (nivel === 'muito_sensivel' ? 'destructive' : 'warning') as DrillItem['tone'],
            };
          });
        },
      };
    case 'privacidade_mapeamentos':
      return {
        title: d('privacidade_mapeamentos.title'),
        description: d('privacidade_mapeamentos.description'),
        icon: IconView,
        route: '/privacidade',
        fetcher: async (empresaId) => {
          // `dados_mapeamento` nao tem `empresa_id`: o recorte por empresa vem
          // pelos dados pessoais, como no resto do modulo.
          const { data: dados, error: e1 } = await supabase
            .from('dados_pessoais').select('id, nome').eq('empresa_id', empresaId);
          if (e1) throw e1;
          const ids = (dados || []).map((x: any) => x.id);
          if (ids.length === 0) return [];
          const nomePorDado = new Map((dados || []).map((x: any) => [x.id, x.nome]));
          const { data, error } = await supabase
            .from('dados_mapeamento')
            .select('id, dados_pessoais_id')
            .in('dados_pessoais_id', ids)
            .limit(5);
          if (error) throw error;
          return (data || []).map((m: any) => ({
            id: m.id,
            title: String(nomePorDado.get(m.dados_pessoais_id) || ''),
            subtitle: d('privacidade_mapeamentos.subtitle'),
            tone: 'info' as DrillItem['tone'],
          }));
        },
      };
    case 'documentos_vencidos':
      return {
        title: d('documentos_vencidos.title'),
        description: d('documentos_vencidos.description'),
        icon: DocumentosIcon,
        route: '/documentos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('documentos')
            .select('id, nome, status, data_vencimento')
            .eq('empresa_id', empresaId)
            .eq('status', 'ativo')
            .lt('data_vencimento', todayIso())
            .order('data_vencimento', { ascending: true })
            .limit(5);
          if (error) throw error;
          return (data || []).map((x: any) => ({
            id: x.id,
            title: x.nome,
            subtitle: formatStatus(x.status),
            tone: 'destructive' as DrillItem['tone'],
            date: fmtDate(x.data_vencimento),
          }));
        },
      };
    case 'documentos_pendentes':
      return {
        title: d('documentos_pendentes.title'),
        description: d('documentos_pendentes.description'),
        icon: DocumentosIcon,
        route: '/documentos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('documentos')
            .select('id, nome, status, updated_at')
            .eq('empresa_id', empresaId)
            .eq('status', 'pendente')
            .order('updated_at', { ascending: true })
            .limit(5);
          if (error) throw error;
          return (data || []).map((x: any) => ({
            id: x.id,
            title: x.nome,
            subtitle: formatStatus(x.status),
            tone: 'warning' as DrillItem['tone'],
            date: fmtDate(x.updated_at),
          }));
        },
      };
    case 'ativos_alto_valor':
      return {
        title: d('ativos_alto_valor.title'),
        description: d('ativos_alto_valor.description'),
        icon: AtivosIcon,
        route: '/ativos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('ativos')
            .select('id, nome, tipo, valor_negocio')
            .eq('empresa_id', empresaId)
            .not('valor_negocio', 'is', null);
          if (error) throw error;
          const corte = corteAltoValor(data || []);
          return (data || [])
            .filter((a: any) => isAtivoAltoValor(a, corte))
            .slice(0, 5)
            .map((a: any) => ({
              id: a.id,
              title: a.nome,
              subtitle: formatStatus(a.tipo || ''),
              status: String(a.valor_negocio ?? ''),
              tone: 'info' as DrillItem['tone'],
            }));
        },
      };
    case 'ativos_criticos':
      return {
        title: d('ativos_criticos.title'),
        description: d('ativos_criticos.description'),
        icon: AtivosIcon,
        route: '/ativos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('ativos')
            .select('id, nome, tipo, criticidade')
            .eq('empresa_id', empresaId);
          if (error) throw error;
          return (data || [])
            .filter((a: any) => ['critico', 'alto'].includes(criticidadeAtivo(a)))
            .slice(0, 5)
            .map((a: any) => ({
              id: a.id,
              title: a.nome,
              subtitle: formatStatus(a.tipo || ''),
              status: formatStatus(a.criticidade || ''),
              tone: (criticidadeAtivo(a) === 'critico' ? 'destructive' : 'warning') as DrillItem['tone'],
            }));
        },
      };
    case 'incidentes_criticos':
      return {
        title: d('incidentes_criticos.title'),
        description: d('incidentes_criticos.description'),
        icon: IncidentesIcon,
        route: '/incidentes',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('incidentes')
            .select('id, titulo, status, criticidade, created_at')
            .eq('empresa_id', empresaId)
            .in('criticidade', ['critica', 'alta'])
            .in('status', ['aberto', 'em_investigacao', 'contido'])
            .order('created_at', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((i: any) => ({
            id: i.id,
            title: i.titulo,
            subtitle: formatStatus(i.status),
            status: formatStatus(i.criticidade),
            tone: (i.criticidade === 'critica' ? 'destructive' : 'warning') as DrillItem['tone'],
            date: fmtDate(i.created_at),
          }));
        },
      };
    case 'riscos_aceite':
      return {
        title: d('riscos_aceite.title'),
        description: d('riscos_aceite.description'),
        icon: IconActivity,
        route: '/riscos/aceite',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('riscos')
            .select('id, nome, nivel_risco_residual, nivel_risco_inicial, data_proxima_revisao')
            .eq('empresa_id', empresaId)
            .eq('aceito', true)
            .order('data_proxima_revisao', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((r: any) => {
            const overdue = r.data_proxima_revisao && r.data_proxima_revisao < today;
            return {
              id: r.id,
              title: r.nome,
              subtitle: r.nivel_risco_residual || r.nivel_risco_inicial,
              status: overdue ? d('reviewExpired') : d('activeAcceptance'),
              tone: (overdue ? 'destructive' : 'info') as DrillItem['tone'],
              date: fmtDate(r.data_proxima_revisao),
            };
          });
        },
      };
    case 'controles_testados':
      return {
        title: d('controles_testados.title'),
        description: d('controles_testados.description'),
        icon: ControlesIcon,
        route: '/governanca/controles',
        fetcher: async (empresaId) => {
          // `controles_testes` não tem `empresa_id`; o recorte vem pelos
          // controles, como no cálculo da efectividade.
          const { data: ctrl, error: e1 } = await supabase
            .from('controles').select('id, nome, codigo').eq('empresa_id', empresaId);
          if (e1) throw e1;
          const ids = (ctrl || []).map((c: any) => c.id);
          if (ids.length === 0) return [];
          const porId = new Map((ctrl || []).map((c: any) => [c.id, c]));
          const { data, error } = await supabase
            .from('controles_testes')
            .select('id, controle_id, resultado, data_teste')
            .in('controle_id', ids)
            .order('data_teste', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((tst: any) => {
            const c: any = porId.get(tst.controle_id) || {};
            const ok = (tst.resultado || '').toLowerCase();
            return {
              // O id que a linha carrega é o do CONTROLO: é ele que a página
              // sabe abrir. `tst.id` é a linha de teste, que lá não existe.
              id: tst.controle_id,
              title: c.nome || '',
              subtitle: c.codigo,
              status: formatStatus(tst.resultado || ''),
              tone: (ok.includes('efic') || ok.includes('conform') ? 'success' : ok.includes('inef') || ok.includes('nao') ? 'destructive' : 'info') as DrillItem['tone'],
              date: fmtDate(tst.data_teste),
            };
          });
        },
      };
    case 'auditorias_itens':
      return {
        title: d('auditorias_itens.title'),
        description: d('auditorias_itens.description'),
        icon: IconChecklist,
        route: '/governanca/auditorias',
        fetcher: async (empresaId) => {
          // `auditoria_itens` também não tem `empresa_id`.
          const { data: auds, error: e1 } = await supabase
            .from('auditorias').select('id, nome').eq('empresa_id', empresaId);
          if (e1) throw e1;
          const ids = (auds || []).map((a: any) => a.id);
          if (ids.length === 0) return [];
          const nome = new Map((auds || []).map((a: any) => [a.id, a.nome]));
          const { data, error } = await supabase
            .from('auditoria_itens')
            .select('id, titulo, codigo, status, auditoria_id, prazo')
            .in('auditoria_id', ids)
            .neq('status', 'concluido')
            .order('prazo', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((i: any) => ({
            id: i.id,
            title: i.titulo || i.codigo || '',
            subtitle: String(nome.get(i.auditoria_id) || ''),
            status: formatStatus(i.status || ''),
            tone: 'warning' as DrillItem['tone'],
            date: fmtDate(i.prazo),
          }));
        },
      };
    case 'sistemas':
      return {
        title: d('sistemas.title'),
        description: d('sistemas.description'),
        icon: IconServer,
        route: '/sistemas',
        fetcher: async (empresaId) => {
          const { data, error } = await (supabase
            .from('sistemas_privilegiados' as any)
            .select('id, nome_sistema, tipo_sistema, criticidade, ativo, updated_at') as any)
            .eq('empresa_id', empresaId)
            .order('criticidade', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((s: any) => ({
            id: s.id,
            title: s.nome_sistema,
            subtitle: formatStatus(s.tipo_sistema || ''),
            status: formatStatus(s.criticidade || ''),
            tone: (s.criticidade === 'alta' ? 'warning' : 'info') as DrillItem['tone'],
            date: fmtDate(s.updated_at),
          }));
        },
      };
    case 'contas_privilegiadas':
      return {
        title: d('contas_privilegiadas.title'),
        description: d('contas_privilegiadas.description'),
        icon: IconLock,
        route: '/contas-privilegiadas',
        fetcher: async (empresaId) => {
          const { data, error } = await (supabase
            .from('contas_privilegiadas' as any)
            .select('id, usuario_beneficiario, nivel_privilegio, status, data_expiracao') as any)
            .eq('empresa_id', empresaId)
            .eq('status', 'ativo')
            // Sem data de expiração é conta permanente, e a página conta-a como
            // activa. O `.gte` sozinho excluía o NULL e a gaveta ficava a menos
            // do que o cartão ao lado.
            .or(`data_expiracao.is.null,data_expiracao.gte.${todayIso()}`)
            .order('data_expiracao', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((c: any) => {
            const expired = c.data_expiracao && c.data_expiracao < today;
            return {
              id: c.id,
              title: c.usuario_beneficiario,
              subtitle: formatStatus(c.nivel_privilegio || ''),
              status: expired ? d('expired') : formatStatus(c.status || ''),
              tone: (expired ? 'destructive' : 'warning') as DrillItem['tone'],
              date: fmtDate(c.data_expiracao),
            };
          });
        },
      };
    default:
      return {
        title: d('fallback.title'),
        description: d('fallback.description'),
        icon: IconInfo,
        route: '/dashboard',
        fetcher: async () => [],
      };
  }
};

interface KpiDrillDownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiKey: DrillDownKey | null;
}

export const KpiDrillDownDrawer: React.FC<KpiDrillDownDrawerProps> = ({ open, onOpenChange, kpiKey }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const empresaId = profile?.empresa_id;

  const config = React.useMemo(() => (kpiKey ? buildConfig(kpiKey, t) : null), [kpiKey, t]);

  const { data: items, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['drill-down', kpiKey, empresaId],
    queryFn: async () => {
      if (!config || !empresaId) return [];
      try {
        return await config.fetcher(empresaId);
      } catch (e) {
        logger.error('drill-down fetch failed', e);
        throw e;
      }
    },
    enabled: open && !!config && !!empresaId,
    staleTime: 30_000,
  });

  if (!config) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Icon as={config.icon as any} size="md" className="shrink-0 text-primary" />
            <div className="min-w-0">
              <SheetTitle className="truncate">{config.title}</SheetTitle>
              <SheetDescription className="text-xs">{config.description}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 py-4 space-y-2">
          {isLoading && (
            <div className="min-h-[200px] flex flex-col items-center justify-center gap-2">
              <AkurisPulse size={48} />
              <p className="text-xs text-muted-foreground">{t('dashWidgets.drill.loading')}</p>
            </div>
          )}
          {isError && (
            <div className="flex flex-col items-center gap-3 py-8">
              <EmptyState
                title={t('dashWidgets.drill.errorTitle')}
                description={t('dashWidgets.drill.errorDescription')}
                icon={<Icon as={IconInfo} size="lg" />}
              />
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? t('dashWidgets.drill.retrying') : t('dashWidgets.drill.retry')}
              </Button>
            </div>
          )}
          {!isLoading && !isError && (items?.length ?? 0) === 0 && (
            <EmptyState
              title={t('dashWidgets.drill.emptyTitle')}
              description={t('dashWidgets.drill.emptyDescription')}
              icon={<Icon as={config.icon as any} size="lg" />}
              variant="illustrated"
            />
          )}
          {!isLoading &&
            !isError &&
            items?.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onOpenChange(false);
                  navigate(`${config.route}?focus=${item.id}`);
                }}
                className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-ui flex items-start justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {item.status && (
                      <StatusBadge tone={item.tone ?? 'neutral'} variant="soft">
                        {formatStatus(item.status)}
                      </StatusBadge>
                    )}
                    {item.date && (
                      <span className="text-micro text-muted-foreground tabular-nums">{item.date}</span>
                    )}
                  </div>
                </div>
                <Icon
                  as={IconExternal}
                  size="sm"
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
                />
              </button>
            ))}
        </div>

        <SheetFooter>
          <Button
            variant="default"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate(config.route);
            }}
          >
            {t('dashWidgets.drill.viewAll')}
            <Icon as={IconArrowRight} size="sm" className="ml-2" />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

