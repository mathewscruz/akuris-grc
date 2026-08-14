import { supabase } from '@/integrations/supabase/client';

export interface Plano {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number;
  preco_anual: number;
  moeda: string;
  creditos_franquia: number;
  limite_usuarios: number | null;
  modulos_habilitados: string[];
  recursos_destacados: string[];
  is_destaque: boolean;
  ordem: number;
  ativo: boolean;
  icone: string;
  cor_primaria: string;
  preco_setup?: number | null;
  setup_observacao?: string | null;
  publico_alvo?: string | null;
}

export const MODULOS_DISPONIVEIS = [
  { key: 'riscos', label: 'Riscos' },
  { key: 'controles', label: 'Controles Internos' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'incidentes', label: 'Incidentes' },
  { key: 'planos_acao', label: 'Planos de Ação' },
  { key: 'gap_analysis', label: 'Gap Analysis & Frameworks' },
  { key: 'due_diligence', label: 'Due Diligence' },
  { key: 'contratos', label: 'Contratos' },
  { key: 'denuncia', label: 'Canal de Denúncias' },
  { key: 'revisao_acessos', label: 'Revisão de Acessos' },
  { key: 'integracoes', label: 'Integrações' },
  { key: 'contas_privilegiadas', label: 'Contas Privilegiadas' },
  { key: 'auditorias', label: 'Auditorias' },
  { key: 'continuidade', label: 'Continuidade' },
  { key: 'privacidade', label: 'Privacidade (LGPD)' },
  { key: 'governanca', label: 'Governança' },
  { key: 'ativos', label: 'Ativos' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'api_publica', label: 'API Pública & Webhooks' },
] as const;

export type ModuloKey = typeof MODULOS_DISPONIVEIS[number]['key'];

export function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export async function fetchPlanos(includeInactive = false): Promise<Plano[]> {
  let query = supabase
    .from('planos')
    .select('*')
    .order('ordem', { ascending: true })
    .order('preco_mensal', { ascending: true });

  if (!includeInactive) query = query.eq('ativo', true);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((p: any) => ({
    ...p,
    modulos_habilitados: Array.isArray(p.modulos_habilitados) ? p.modulos_habilitados : [],
    recursos_destacados: Array.isArray(p.recursos_destacados) ? p.recursos_destacados : [],
  })) as Plano[];
}
