/**
 * Traduz a base legal escrita à mão para o vocabulário do produto.
 *
 * Os ROPA reais chegam de planilha e trazem a base legal como o jurista a
 * escreveu — com o nome, a citação do artigo e o âmbito, e muitas vezes mais do
 * que uma no mesmo campo:
 *
 *   "Execução de contrato (Art. 7º, V) para comunicações obrigatórias (boleto,
 *    notas, avisos); Legítimo Interesse (Art. 7º, IX) para comunicações de
 *    relacionamento e retenção preventiva."
 *
 * O importador gravava essa frase inteira em `ropa_registros.base_legal`, que é
 * um campo de vocabulário controlado. Consequência medida numa cópia da base de
 * produção: dos 7 registos ROPA reais, **zero** casavam com qualquer chave do
 * vocabulário. O ecrã marcava os sete a vermelho, "Base fora da lei aplicável",
 * e o filtro de base legal não encontrava nenhum. Nenhuma das duas coisas era
 * verdade: as bases estavam certas, só não estavam em forma de dado.
 *
 * Este módulo separa a frase nas suas bases e devolve, para cada uma, a chave
 * do vocabulário, a citação e o âmbito. O texto original nunca se perde — vai
 * para `justificativa`, porque é ele que um auditor lê.
 */

/** Uma base legal reconhecida dentro de um texto escrito à mão. */
export interface BaseLegalExtraida {
  /** Chave do vocabulário (`legitimo_interesse`), ou null se não reconhecida. */
  chave: string | null;
  /** O fragmento original, tal como estava escrito. */
  textoOriginal: string;
  /** A citação legal encontrada — "Art. 7º, IX, LGPD". */
  citacao: string | null;
  /** O que sobra depois do nome e da citação: o âmbito daquela base. */
  abrangencia: string | null;
}

/**
 * Sinais de cada base, por ordem de especificidade.
 *
 * A ordem importa: "cumprimento de obrigação legal" contém "legal", e
 * "consentimento explícito" contém "consentimento". O primeiro que casa ganha,
 * por isso o mais específico vem antes.
 */
const SINAIS: { chave: string; padroes: RegExp[] }[] = [
  { chave: 'consentimento_explicito', padroes: [/consentimento\s+expl[ií]cito/i] },
  { chave: 'cumprimento_obrigacao', padroes: [/cumprimento\s+de\s+obriga[cç][aã]o/i, /obriga[cç][aã]o\s+legal/i, /obriga[cç][aã]o\s+regulat[oó]ria/i] },
  { chave: 'obrigacao_trabalho', padroes: [/direito\s+laboral/i, /seguran[cç]a\s+social/i] },
  { chave: 'execucao_contrato', padroes: [/execu[cç][aã]o\s+d[eo]\s+contrato/i, /procedimentos\s+preliminares/i] },
  { chave: 'exercicio_direitos', padroes: [/exerc[ií]cio\s+regular\s+de\s+direitos/i, /processo\s+judicial/i] },
  { chave: 'protecao_vida', padroes: [/prote[cç][aã]o\s+d[ao]\s+vida/i, /incolumidade\s+f[ií]sica/i] },
  { chave: 'tutela_saude', padroes: [/tutela\s+d[ao]\s+sa[uú]de/i] },
  { chave: 'protecao_credito', padroes: [/prote[cç][aã]o\s+ao\s+cr[eé]dito/i] },
  { chave: 'prevencao_fraude', padroes: [/preven[cç][aã]o\s+[aà]\s+fraude/i] },
  { chave: 'politicas_publicas', padroes: [/pol[ií]ticas\s+p[uú]blicas/i] },
  { chave: 'interesse_publico', padroes: [/interesse\s+p[uú]blico/i] },
  { chave: 'estudo_pesquisa', padroes: [/[oó]rg[aã]o\s+de\s+pesquisa/i, /estudo\s+por\s+[oó]rg[aã]o/i] },
  { chave: 'legitimo_interesse', padroes: [/leg[ií]timo\s+interesse/i, /interesse\s+leg[ií]timo/i] },
  { chave: 'consentimento', padroes: [/consentimento/i] },
];

/** "(Art. 7º, IX, LGPD)" ou "(Art. 6.º, 1, b) do RGPD)". */
const CITACAO = /\(\s*(art\.?\s*[^)]*)\)/i;

/** Separadores entre bases distintas no mesmo campo. */
const SEPARADORES = /\s*(?:;|\s\/\s|\se\s(?=[A-ZÀ-Ú]))\s*/;

const limpar = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s.;/–—-]+|[\s.;/–—-]+$/g, '').trim();

/** A chave do vocabulário para um fragmento, ou null. */
export function chaveDaBaseLegal(texto: string): string | null {
  for (const { chave, padroes } of SINAIS) {
    if (padroes.some((p) => p.test(texto))) return chave;
  }
  return null;
}

/**
 * Separa um campo de base legal nas bases que ele contém.
 *
 * Devolve sempre pelo menos uma entrada: um texto que não reconheça nenhuma
 * base sai com `chave: null` e o texto intacto. É deliberado — num produto de
 * conformidade, engolir uma base que não se percebeu é pior do que mostrá-la
 * por reconhecer. Há um caso assim nos dados reais: "Derivado dos processos de
 * tratamento originários", que não é base nenhuma e precisa de decisão humana.
 */
export function extrairBasesLegais(texto?: string | null): BaseLegalExtraida[] {
  const bruto = (texto ?? '').trim();
  if (!bruto) return [];

  const fragmentos = bruto.split(SEPARADORES).map(limpar).filter(Boolean);
  const partes = fragmentos.length > 0 ? fragmentos : [limpar(bruto)];

  const vistas = new Set<string>();
  const saida: BaseLegalExtraida[] = [];

  for (const fragmento of partes) {
    const chave = chaveDaBaseLegal(fragmento);
    // A mesma base repetida no mesmo campo é redundância de escrita, não duas
    // bases — e a tabela tem índice único por (registo, base).
    if (chave && vistas.has(chave)) continue;
    if (chave) vistas.add(chave);

    const m = CITACAO.exec(fragmento);
    const citacao = m ? limpar(m[1]) : null;

    // O que resta depois de tirar o nome da base e a citação é o âmbito:
    // "para comunicações obrigatórias", "na captação via formulário".
    let resto = fragmento;
    if (m) resto = resto.replace(m[0], ' ');
    if (chave) {
      for (const p of SINAIS.find((s) => s.chave === chave)!.padroes) {
        resto = resto.replace(p, ' ');
      }
    }
    const abrangencia = limpar(resto) || null;

    saida.push({ chave, textoOriginal: fragmento, citacao, abrangencia });
  }

  return saida;
}

/** `true` quando o texto contém mais do que uma base reconhecida. */
export const temVariasBases = (texto?: string | null): boolean =>
  extrairBasesLegais(texto).filter((b) => b.chave).length > 1;
