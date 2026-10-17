/** Itens de configuração mensuráveis. `null` = não medido, nunca conta como feito. */
export interface StatusConfiguracao {
  usuarios: number | null;
  logo: boolean | null;
  slug: boolean | null;
  integracoes: number | null;
  denunciaAtiva: boolean | null;
  trustPublicado: boolean | null;
}

export type ItemProgresso = 'usuarios' | 'logo' | 'slug' | 'integracao' | 'denuncia' | 'trust';

export const SECAO_DO_ITEM: Record<ItemProgresso, string> = {
  usuarios: 'usuarios', logo: 'organizacao', slug: 'organizacao',
  integracao: 'integracoes', denuncia: 'denuncia', trust: 'trust-center',
};

export function calcularProgressoConfiguracao(s: StatusConfiguracao) {
  const itens: [ItemProgresso, boolean | null][] = [
    ['usuarios', s.usuarios == null ? null : s.usuarios > 1],
    ['logo', s.logo],
    ['slug', s.slug],
    ['integracao', s.integracoes == null ? null : s.integracoes > 0],
    ['denuncia', s.denunciaAtiva],
    ['trust', s.trustPublicado],
  ];
  const feitos = itens.filter(([, v]) => v === true).map(([k]) => k);
  const pendentes = itens.filter(([, v]) => v !== true).map(([k]) => k);
  return { feitos: feitos.length, total: itens.length, pendentes };
}

/** Busca sem acento e sem maiúsculas. */
export const normalizarBusca = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
