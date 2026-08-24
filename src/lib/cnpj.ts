/**
 * CNPJ: validar, formatar e ler o que a Receita responde.
 *
 * Tudo aqui é puro. A função de borda `consultar-cnpj` existe só para esconder
 * a chave do Portal da Transparência e falar com as duas APIs; a interpretação
 * do que volta é isto, para poder ser testada sem rede.
 */

/** Só dígitos. O que chega da tela vem com pontos, barra e traço. */
export function limparCnpj(bruto: string): string {
  return (bruto || '').replace(/\D/g, '');
}

/**
 * Dígitos verificadores.
 *
 * Vale a pena conferir antes de sair à rede: um CNPJ mal digitado devolve 404
 * da BrasilAPI, e «não encontrado» leva a pessoa a concluir que a empresa não
 * existe quando o que existe é um dígito trocado.
 */
export function cnpjValido(bruto: string): boolean {
  const c = limparCnpj(bruto);
  if (c.length !== 14) return false;
  /* 00.000.000/0000-00 e afins passam na conta e não são CNPJ de ninguém. */
  if (/^(\d)\1{13}$/.test(c)) return false;

  const digito = (base: string): number => {
    let peso = base.length - 7;
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * peso;
      peso = peso - 1 < 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return digito(c.slice(0, 12)) === Number(c[12]) && digito(c.slice(0, 13)) === Number(c[13]);
}

export function formatarCnpj(bruto: string): string {
  const c = limparCnpj(bruto);
  if (c.length !== 14) return bruto ?? '';
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

/* ────────────────────────────── Cadastro ────────────────────────────── */

export interface CadastroReceita {
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao_cadastral: string | null;
  situacao_desde: string | null;
  motivo_situacao: string | null;
  situacao_especial: string | null;
  abertura: string | null;
  porte: string | null;
  natureza_juridica: string | null;
  capital_social: number | null;
  cnae_principal: { codigo: string; descricao: string | null } | null;
  matriz_filial: string | null;
  optante_simples: boolean | null;
  optante_mei: boolean | null;
  email: string | null;
  telefone: string | null;
  endereco: string;
  municipio: string | null;
  uf: string | null;
}

export interface SocioReceita {
  nome: string | null;
  qualificacao: string | null;
  desde: string | null;
  faixa_etaria: string | null;
  documento_mascarado: string | null;
}

/** Junta o endereço numa linha só, sem vírgulas soltas quando falta pedaço. */
export function montarEndereco(d: Record<string, unknown>): string {
  const texto = (v: unknown) => String(v ?? '').trim();
  const rua = [texto(d.descricao_tipo_de_logradouro), texto(d.logradouro)].filter(Boolean).join(' ');
  const linha1 = [rua, texto(d.numero), texto(d.complemento)].filter(Boolean).join(', ');
  const linha2 = [texto(d.bairro), texto(d.municipio), texto(d.uf)].filter(Boolean).join(' - ');
  const cep = texto(d.cep);
  return [linha1, linha2, cep ? `CEP ${cep}` : ''].filter(Boolean).join(' — ');
}

/** Telefone com DDD, quando existe. */
function telefoneDe(d: Record<string, unknown>): string | null {
  const bruto = String(d.ddd_telefone_1 ?? '').replace(/\D/g, '');
  if (bruto.length < 10) return null;
  return `(${bruto.slice(0, 2)}) ${bruto.slice(2)}`;
}

export function normalizarReceita(d: Record<string, any>): CadastroReceita {
  const texto = (v: unknown) => String(v ?? '').trim() || null;
  return {
    razao_social: texto(d.razao_social),
    nome_fantasia: texto(d.nome_fantasia),
    situacao_cadastral: texto(d.descricao_situacao_cadastral),
    situacao_desde: texto(d.data_situacao_cadastral),
    /*
      «SEM MOTIVO» é o que a Receita devolve quando não há motivo nenhum —
      mostrar isso ao lado da situação faz parecer que há alguma coisa a dizer.
    */
    motivo_situacao:
      texto(d.descricao_motivo_situacao_cadastral) === 'SEM MOTIVO'
        ? null
        : texto(d.descricao_motivo_situacao_cadastral),
    situacao_especial: texto(d.situacao_especial),
    abertura: texto(d.data_inicio_atividade),
    porte: texto(d.porte),
    natureza_juridica: texto(d.natureza_juridica),
    capital_social: typeof d.capital_social === 'number' ? d.capital_social : null,
    cnae_principal: d.cnae_fiscal
      ? { codigo: String(d.cnae_fiscal), descricao: texto(d.cnae_fiscal_descricao) }
      : null,
    matriz_filial: texto(d.descricao_identificador_matriz_filial),
    optante_simples: typeof d.opcao_pelo_simples === 'boolean' ? d.opcao_pelo_simples : null,
    optante_mei: typeof d.opcao_pelo_mei === 'boolean' ? d.opcao_pelo_mei : null,
    email: texto(d.email),
    telefone: telefoneDe(d),
    endereco: montarEndereco(d),
    municipio: texto(d.municipio),
    uf: texto(d.uf),
  };
}

export function normalizarSocios(qsa: unknown): SocioReceita[] {
  if (!Array.isArray(qsa)) return [];
  return qsa.slice(0, 50).map((s: Record<string, any>) => ({
    nome: String(s?.nome_socio ?? '').trim() || null,
    qualificacao: String(s?.qualificacao_socio ?? '').trim() || null,
    desde: String(s?.data_entrada_sociedade ?? '').trim() || null,
    faixa_etaria: String(s?.faixa_etaria ?? '').trim() || null,
    /*
      O documento vem mascarado da própria Receita («***550179**») e é assim que
      fica. Não é dado que precisemos de ter inteiro, e guardar CPF de terceiro
      sem necessidade é risco que não se justifica.
    */
    documento_mascarado: String(s?.cnpj_cpf_do_socio ?? '').trim() || null,
  }));
}

/* ────────────────────────────── Alertas ────────────────────────────── */

export type GravidadeAlerta = 'critica' | 'atencao' | 'informativa';

export interface AlertaCnpj {
  chave: string;
  gravidade: GravidadeAlerta;
}

export interface SancoesConsulta {
  verificado: boolean;
  motivo?: 'sem_chave' | 'falha_consulta';
  ceis?: unknown[];
  cnep?: unknown[];
  leniencia?: unknown[];
}

/** Quantas sanções foram encontradas, ou null quando não se chegou a procurar. */
export function totalDeSancoes(s: SancoesConsulta | null | undefined): number | null {
  if (!s?.verificado) return null;
  return (s.ceis?.length ?? 0) + (s.cnep?.length ?? 0) + (s.leniencia?.length ?? 0);
}

/**
 * O que no registo merece um olhar.
 *
 * Deliberadamente curto. Cada sinal é verificável no próprio cadastro — não há
 * heurística de «capital social baixo» nem juízo sobre o CNAE, porque o que é
 * baixo depende do contrato e isso o Akuris não sabe. Um alerta que a pessoa
 * aprende a ignorar estraga os outros quatro.
 */
export function alertasDoCadastro(
  cadastro: Pick<
    CadastroReceita,
    'situacao_cadastral' | 'situacao_especial' | 'abertura' | 'matriz_filial'
  >,
  sancoes?: SancoesConsulta | null,
  hoje: Date = new Date(),
): AlertaCnpj[] {
  const alertas: AlertaCnpj[] = [];

  /* Sanção encontrada vem primeiro: é o único que sozinho reprova o fornecedor. */
  if ((totalDeSancoes(sancoes) ?? 0) > 0) {
    alertas.push({ chave: 'consta_em_lista_restritiva', gravidade: 'critica' });
  }

  const situacao = (cadastro.situacao_cadastral || '').toUpperCase();
  if (situacao && situacao !== 'ATIVA') {
    alertas.push({ chave: 'situacao_nao_ativa', gravidade: 'critica' });
  }

  /* «EM RECUPERACAO JUDICIAL», «FALIDA». Campo raro e, quando vem preenchido,
     nunca é detalhe. */
  if ((cadastro.situacao_especial || '').trim()) {
    alertas.push({ chave: 'situacao_especial', gravidade: 'critica' });
  }

  if (cadastro.abertura) {
    /*
      Meio-dia UTC de propósito: `abertura` é uma data sem hora, e construir à
      meia-noite fá-la recuar um dia em qualquer fuso a oeste de Greenwich.
    */
    const abertura = new Date(`${cadastro.abertura}T12:00:00Z`);
    if (!Number.isNaN(abertura.getTime())) {
      const meses =
        (hoje.getUTCFullYear() - abertura.getUTCFullYear()) * 12 +
        (hoje.getUTCMonth() - abertura.getUTCMonth());
      if (meses < 12) alertas.push({ chave: 'atividade_recente', gravidade: 'atencao' });
    }
  }

  /* Contratar a filial quando a matriz é que responde é erro comum, e caro. */
  if ((cadastro.matriz_filial || '').toUpperCase() === 'FILIAL') {
    alertas.push({ chave: 'e_filial', gravidade: 'informativa' });
  }

  return alertas;
}

/* ────────────────────────── A fotografia guardada ────────────────────────── */

export interface ConsultaCnpj {
  cnpj: string;
  consultado_em: string;
  fonte: string;
  cadastro: CadastroReceita;
  socios: SocioReceita[];
  sancoes: SancoesConsulta;
  alertas: AlertaCnpj[];
}

/**
 * O que a função de borda devolve, virado no que se guarda em
 * `fornecedores.dados_receita`.
 *
 * É uma FOTOGRAFIA datada, e é para ser lida como tal: a prova de diligência
 * não é «a empresa está ativa» — é «nesta data estava ativa, e aqui está o que
 * se viu nesse dia».
 */
export function montarConsulta(resposta: {
  cnpj: string;
  consultado_em: string;
  fonte?: string;
  receita: Record<string, any>;
  sancoes: SancoesConsulta;
}): ConsultaCnpj {
  const cadastro = normalizarReceita(resposta.receita ?? {});
  return {
    cnpj: resposta.cnpj,
    consultado_em: resposta.consultado_em,
    fonte: resposta.fonte ?? 'Receita Federal',
    cadastro,
    socios: normalizarSocios(resposta.receita?.qsa),
    sancoes: resposta.sancoes,
    alertas: alertasDoCadastro(cadastro, resposta.sancoes, new Date(resposta.consultado_em)),
  };
}
