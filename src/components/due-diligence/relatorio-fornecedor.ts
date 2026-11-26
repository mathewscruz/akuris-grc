/**
 * Relatório gerencial da avaliação de um fornecedor.
 *
 * ## O que resolve
 *
 * Terminada a avaliação, ficava um score na tela e mais nada que se pudesse
 * levar a uma reunião. Quem precisasse de apresentar a decisão — ao comité, ao
 * jurídico, ao cliente que exige due diligence dos seus fornecedores — tinha de
 * copiar números à mão para um documento à parte.
 *
 * ## Uma regra que atravessa o ficheiro
 *
 * O relatório distingue, em todo o lado, o que é CÁLCULO do que é LEITURA. O
 * score é média ponderada das notas, reproduzível a partir das respostas; o
 * parecer é interpretação da IA. Num documento que vai ser assinado e
 * arquivado, deixá-los indistintos seria transformar opinião em evidência —
 * por isso o parecer aparece sempre rotulado, e com a confiança que a própria
 * IA declarou.
 *
 * Também não se inventa o que falta: sem parecer, a secção diz que não houve
 * leitura automática, em vez de deixar um espaço em branco que se lê como
 * "nada a apontar".
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AKURIS_COLORS,
  addAkurisCover,
  addAkurisFooter,
  addAkurisHeader,
  addSectionTitle,
  drawProgressBar,
  loadAkurisLogo,
} from '@/lib/pdf-utils';
import { formatDateOnly } from '@/lib/date-utils';
import { getAppLocale } from '@/lib/i18n-locale';
import type { ParecerDaIA } from './parecer-ia-types';
import {
  alertasDeCoerencia,
  classificarRisco,
  coberturaDeEvidencia,
  ehLacuna,
  ehLacunaCritica,
  lacunasPorImpacto,
  maximoDe,
  notaDe,
  type Classificacao,
} from './avaliacao-regras';

export interface DadosDoFornecedor {
  cnpj?: string | null;
  categoria?: string | null;
  contato?: string | null;
  email?: string | null;
  telefone?: string | null;
  situacaoReceita?: string | null;
}

export interface RespostaDoRelatorio {
  pergunta: string;
  secao?: string | null;
  resposta: string | null;
  peso?: number | null;
  pontuacao?: number | null;
  temAnexo?: boolean;
  justificativa?: string | null;
}

export interface DadosDoRelatorio {
  fornecedorNome: string;
  empresaNome?: string;
  templateNome?: string | null;
  scoreFinal?: number | null;
  status?: string | null;
  dataEnvio?: string | null;
  dataConclusao?: string | null;
  dataExpiracao?: string | null;
  avaliacaoId?: string | null;
  fornecedor?: DadosDoFornecedor | null;
  parecer?: ParecerDaIA | null;
  parecerEm?: string | null;
  porSecao?: Array<{ secao: string; score: number; perguntas?: number }>;
  respostas?: RespostaDoRelatorio[];
}

/** Rótulos vindos do dicionário da app (mantidos por compatibilidade). */
export interface RotulosDoRelatorio {
  titulo: string;
  subtitulo: string;
  seccaoResumo: string;
  seccaoParecer: string;
  seccaoRespostas: string;
  score: string;
  semScore: string;
  porSecao: string;
  nivelRisco: string;
  semParecer: string;
  avisoParecer: string;
  confianca: string;
  pontosFortes: string;
  pontosAtencao: string;
  evidenciasEmFalta: string;
  recomendacoes: string;
  colPergunta: string;
  colResposta: string;
  colNota: string;
  semAnexo: string;
  enviadoEm: string;
  concluidoEm: string;
  questionario: string;
}

/** Textos novos do relatório, PT/EN (mesmo padrão de pdfTxt). */
function textos(pt: boolean) {
  return pt
    ? {
        idFornecedor: 'Identificação do fornecedor', cnpj: 'CNPJ', categoria: 'Categoria', contato: 'Contato',
        email: 'E-mail', telefone: 'Telefone', situacao: 'Situação na Receita', avaliacao: 'Avaliação',
        validade: 'Válida até', status: 'Estado', sumario: 'Sumário executivo', riscoResultante: 'Risco resultante',
        classes: { baixo: 'Excelente', moderado: 'Bom', elevado: 'Regular', critico: 'Ruim' } as Record<Classificacao, string>,
        kRespostas: 'Respostas', kEvidencia: 'Com comprovativo', kLacunas: 'Lacunas', kCriticas: 'Lacunas críticas', kPrazo: 'Prazo de resposta', dias: 'dias',
        exigemAcao: 'Pontos que exigem ação', semLacunas: 'Nenhuma resposta abaixo do limite (nota 6/10).',
        alertaTitulo: 'Atenção: o score não está sustentado',
        alertaCriticas: 'Há lacunas em perguntas de peso elevado, apesar do score alto.',
        alertaEvidencia: 'Nenhuma resposta tem comprovativo anexado: o score reflete apenas declarações do fornecedor.',
        mapa: 'Mapa por seção', colSecao: 'Seção', colPerguntas: 'Perguntas', colLacunas: 'Lacunas', colScore: 'Score',
        lacunasTitulo: 'Lacunas e o que pedir ao fornecedor', colPeso: 'Peso', colPedir: 'O que pedir',
        pedirPadrao: 'Evidência do controle ou plano de correção com prazo.',
        leituraSecao: 'Leitura por seção', modelo: 'Modelo', analisadas: 'respostas analisadas',
        detalhadas: 'Respostas detalhadas', colEvidencia: 'Comprov.', sim: 'Sim', nao: 'Não', obs: 'Observação',
        semSecao: 'Sem seção', decisao: 'Decisão e aprovação',
        decisaoOpcoes: ['Aprovado', 'Aprovado com ressalvas', 'Reprovado'],
        responsavel: 'Responsável pela decisão', data: 'Data', assinatura: 'Assinatura', justificativa: 'Justificativa / ressalvas',
        metodologia: 'Metodologia',
        metodologiaTxt: 'Cada resposta recebe uma nota de 0 a 10. O score é a média dessas notas ponderada pelo peso de cada pergunta, em percentagem; respostas "Não se aplica", texto livre e perguntas sem resposta ficam fora do cálculo. Uma resposta com nota inferior a 6 é tratada como lacuna; é crítica quando o peso da pergunta é 3 ou mais. Faixas: 80% ou mais Excelente, 60-79% Bom, 40-59% Regular, abaixo de 40% Ruim. A leitura da IA é interpretação e não altera o score.',
      }
    : {
        idFornecedor: 'Supplier identification', cnpj: 'Tax ID', categoria: 'Category', contato: 'Contact',
        email: 'E-mail', telefone: 'Phone', situacao: 'Registry status', avaliacao: 'Assessment',
        validade: 'Valid until', status: 'Status', sumario: 'Executive summary', riscoResultante: 'Resulting risk',
        classes: { baixo: 'Excellent', moderado: 'Good', elevado: 'Regular', critico: 'Poor' } as Record<Classificacao, string>,
        kRespostas: 'Answers', kEvidencia: 'With evidence', kLacunas: 'Gaps', kCriticas: 'Critical gaps', kPrazo: 'Response time', dias: 'days',
        exigemAcao: 'Items requiring action', semLacunas: 'No answer below the threshold (score 6/10).',
        alertaTitulo: 'Warning: the score is not supported',
        alertaCriticas: 'There are gaps in high-weight questions despite the high score.',
        alertaEvidencia: 'No answer has supporting evidence attached: the score reflects supplier statements only.',
        mapa: 'Section map', colSecao: 'Section', colPerguntas: 'Questions', colLacunas: 'Gaps', colScore: 'Score',
        lacunasTitulo: 'Gaps and what to request', colPeso: 'Weight', colPedir: 'What to request',
        pedirPadrao: 'Evidence of the control or a remediation plan with a deadline.',
        leituraSecao: 'Reading by section', modelo: 'Model', analisadas: 'answers analysed',
        detalhadas: 'Detailed answers', colEvidencia: 'Evidence', sim: 'Yes', nao: 'No', obs: 'Note',
        semSecao: 'No section', decisao: 'Decision and approval',
        decisaoOpcoes: ['Approved', 'Approved with conditions', 'Rejected'],
        responsavel: 'Decision owner', data: 'Date', assinatura: 'Signature', justificativa: 'Rationale / conditions',
        metodologia: 'Methodology',
        metodologiaTxt: 'Each answer gets a 0-10 score multiplied by the question weight. The score is points obtained divided by the maximum possible, as a percentage; non-applicable questions are excluded. An answer scoring below 6 is a gap; it is critical when the question weight is 3 or more. Bands: 80% or more low risk, 60-79% moderate, 40-59% high, below 40% critical. The AI reading is interpretation and does not change the score.',
      };
}

const MARGEM = 20;
const LARGURA_UTIL = 170;
const LIMITE_Y = 272;

const COR_CLASSE: Record<Classificacao, string> = {
  baixo: AKURIS_COLORS.success,
  moderado: AKURIS_COLORS.warning,
  elevado: '#f97316',
  critico: AKURIS_COLORS.danger,
};

const corDoScore = (s: number) => COR_CLASSE[classificarRisco(s) ?? 'critico'];

function garantir(doc: jsPDF, y: number, altura: number, logo: string | null): number {
  if (y + altura <= LIMITE_Y) return y;
  doc.addPage();
  return addAkurisHeader(doc, logo);
}

function paragrafo(doc: jsPDF, texto: string, y: number, logo: string | null, tamanho = 9.5, cor: [number, number, number] = [60, 60, 60]): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(tamanho);
  doc.setTextColor(...cor);
  for (const linha of doc.splitTextToSize(texto, LARGURA_UTIL)) {
    y = garantir(doc, y, 5, logo);
    doc.text(linha, MARGEM, y);
    y += tamanho * 0.48;
  }
  return y + 2;
}

function lista(doc: jsPDF, titulo: string, itens: string[] | undefined, y: number, logo: string | null): number {
  if (!itens?.length) return y;
  y = garantir(doc, y, 12, logo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(AKURIS_COLORS.text);
  doc.text(titulo, MARGEM, y);
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  for (const item of itens) {
    for (const [i, linha] of doc.splitTextToSize(item, LARGURA_UTIL - 6).entries()) {
      y = garantir(doc, y, 5, logo);
      if (i === 0) { doc.setFillColor(AKURIS_COLORS.primary); doc.circle(MARGEM + 1.2, y - 1.2, 0.7, 'F'); }
      doc.text(linha, MARGEM + 5, y);
      y += 4.4;
    }
    y += 1.2;
  }
  return y + 2;
}

function rotulo(doc: jsPDF, texto: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(AKURIS_COLORS.textLight);
  doc.text(texto.toUpperCase(), x, y);
}

const ESTILO_TABELA = {
  theme: 'plain' as const,
  styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, textColor: [30, 41, 59] as [number, number, number], lineColor: [226, 232, 240] as [number, number, number], lineWidth: { bottom: 0.2 } as any, overflow: 'linebreak' as const },
  headStyles: { fontStyle: 'bold' as const, fontSize: 7, textColor: [100, 116, 139] as [number, number, number], fillColor: [248, 250, 252] as [number, number, number] },
  margin: { left: MARGEM, right: MARGEM, top: 38, bottom: 22 },
};

function diasEntre(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return Number.isFinite(d) && d >= 0 ? d : null;
}

const norm = (s: string) => s.trim().toLowerCase();

export async function gerarRelatorioFornecedor(dados: DadosDoRelatorio, r: RotulosDoRelatorio): Promise<void> {
  const pt = getAppLocale().startsWith('pt');
  const T = textos(pt);
  const doc = new jsPDF();
  const logo = await loadAkurisLogo();
  const respostas = dados.respostas ?? [];
  const score = dados.scoreFinal === null || dados.scoreFinal === undefined ? null : Number(dados.scoreFinal);
  const classe = classificarRisco(score);
  const lacunas = lacunasPorImpacto(respostas);
  const criticas = respostas.filter(ehLacunaCritica).length;
  const cobertura = coberturaDeEvidencia(respostas);
  const alertas = alertasDeCoerencia(score, respostas);
  const pontuadas = respostas.filter((x) => notaDe({ pontuacao: x.pontuacao ?? null, peso: x.peso ?? null }) !== null).length;
  const prazo = diasEntre(dados.dataEnvio, dados.dataConclusao);
  const secaoDe = (x: RespostaDoRelatorio) => x.secao?.trim() || T.semSecao;

  // O que pedir, vindo da leitura da IA, indexado pela pergunta.
  const pedidos = new Map<string, string>();
  for (const s of dados.parecer?.secoes ?? []) for (const p of s.oQuePedir ?? []) if (p.pergunta && p.pedir) pedidos.set(norm(p.pergunta), p.pedir);

  // ── 1. Capa ────────────────────────────────────────────────────────────
  addAkurisCover(doc, logo, r.titulo, dados.fornecedorNome, {
    empresa: dados.empresaNome,
    data: formatDateOnly(new Date().toISOString()),
  });
  {
    const linhas = [
      dados.fornecedor?.cnpj ? `${T.cnpj}: ${dados.fornecedor.cnpj}` : null,
      dados.templateNome ? `${r.questionario}: ${dados.templateNome}` : null,
      dados.dataConclusao ? `${r.concluidoEm}: ${formatDateOnly(dados.dataConclusao)}` : null,
      dados.avaliacaoId ? `${T.avaliacao}: ${dados.avaliacaoId.slice(0, 8).toUpperCase()}` : null,
    ].filter(Boolean) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(180, 180, 220);
    linhas.forEach((l, i) => doc.text(l, 30, 170 + i * 7));
    if (score !== null && classe) {
      doc.setFillColor(COR_CLASSE[classe]);
      doc.roundedRect(30, 205, 62, 22, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text(`${score.toFixed(0)}%`, 35, 218.5);
      doc.setFontSize(8.5);
      doc.text(T.classes[classe].toUpperCase(), 58, 218);
    }
  }

  // ── 2. Sumário executivo ───────────────────────────────────────────────
  doc.addPage();
  let y = addAkurisHeader(doc, logo);
  y = addSectionTitle(doc, T.sumario, y, MARGEM);

  // Faixa do score
  doc.setFillColor(AKURIS_COLORS.background);
  doc.setDrawColor(AKURIS_COLORS.border);
  doc.roundedRect(MARGEM, y, LARGURA_UTIL, 30, 2, 2, 'FD');
  if (score !== null && classe) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(corDoScore(score));
    doc.text(`${score.toFixed(0)}%`, MARGEM + 6, y + 15);
    doc.setFontSize(10);
    doc.setTextColor(AKURIS_COLORS.text);
    doc.text(`${T.riscoResultante}: ${T.classes[classe]}`, MARGEM + 46, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(AKURIS_COLORS.textLight);
    doc.text(r.score, MARGEM + 46, y + 15.5);
    drawProgressBar(doc, MARGEM + 6, y + 21, LARGURA_UTIL - 12, 3, score, corDoScore(score));
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(AKURIS_COLORS.textLight);
    doc.text(doc.splitTextToSize(r.semScore, LARGURA_UTIL - 12), MARGEM + 6, y + 14);
  }
  y += 36;

  // KPIs
  const kpis: Array<[string, string, string?]> = [
    [T.kRespostas, `${pontuadas}/${respostas.length}`],
    [T.kEvidencia, `${cobertura}%`, cobertura === 0 && pontuadas ? AKURIS_COLORS.danger : undefined],
    [T.kLacunas, String(lacunas.length), lacunas.length ? AKURIS_COLORS.warning : undefined],
    [T.kCriticas, String(criticas), criticas ? AKURIS_COLORS.danger : undefined],
    [T.kPrazo, prazo === null ? '—' : `${prazo} ${T.dias}`],
  ];
  const w = LARGURA_UTIL / kpis.length;
  kpis.forEach(([k, v, cor], i) => {
    const x = MARGEM + i * w;
    doc.setDrawColor(AKURIS_COLORS.border);
    doc.roundedRect(x + 0.8, y, w - 1.6, 18, 1.5, 1.5, 'S');
    rotulo(doc, k, x + 4, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(cor ?? AKURIS_COLORS.text);
    doc.text(v, x + 4, y + 14);
  });
  y += 24;

  // Alerta de coerência
  if (alertas.length) {
    const msgs = alertas.map((a) => (a === 'lacunas_criticas' ? T.alertaCriticas : T.alertaEvidencia));
    doc.setFontSize(8.5);
    const linhas = msgs.flatMap((m) => doc.splitTextToSize(`• ${m}`, LARGURA_UTIL - 12));
    const h = 10 + linhas.length * 4.2;
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(MARGEM, y, LARGURA_UTIL, h, 1.5, 1.5, 'F');
    doc.setFillColor(AKURIS_COLORS.danger);
    doc.rect(MARGEM, y, 1.5, h, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(153, 27, 27);
    doc.text(T.alertaTitulo, MARGEM + 6, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(127, 29, 29);
    linhas.forEach((l, i) => doc.text(l, MARGEM + 6, y + 11 + i * 4.2));
    y += h + 6;
  }

  // Pontos que exigem ação
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(AKURIS_COLORS.text);
  doc.text(T.exigemAcao, MARGEM, y);
  y += 5;
  if (!lacunas.length) {
    y = paragrafo(doc, T.semLacunas, y + 1, logo, 9);
  } else {
    for (const l of lacunas.slice(0, 5)) {
      y = garantir(doc, y, 8, logo);
      const critica = ehLacunaCritica({ pontuacao: l.pontuacao ?? null, peso: l.peso ?? null });
      doc.setFillColor(critica ? AKURIS_COLORS.danger : AKURIS_COLORS.warning);
      doc.circle(MARGEM + 1.5, y + 1.6, 1.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(AKURIS_COLORS.text);
      doc.text(doc.splitTextToSize(l.pergunta, 110)[0], MARGEM + 5, y + 2.6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(AKURIS_COLORS.textLight);
      doc.text(`${secaoDe(l)} · ${l.resposta ?? '—'}`, MARGEM + LARGURA_UTIL, y + 2.6, { align: 'right' });
      y += 7;
    }
    y += 2;
  }

  // Identificação + datas
  y = garantir(doc, y + 4, 40, logo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(AKURIS_COLORS.text);
  doc.text(T.idFornecedor, MARGEM, y);
  y += 3;
  const f = dados.fornecedor ?? {};
  const campos: Array<[string, string | null | undefined]> = [
    [T.cnpj, f.cnpj], [T.categoria, f.categoria], [T.situacao, f.situacaoReceita],
    [T.contato, f.contato], [T.email, f.email], [T.telefone, f.telefone],
    [r.questionario, dados.templateNome], [r.enviadoEm, dados.dataEnvio ? formatDateOnly(dados.dataEnvio) : null],
    [r.concluidoEm, dados.dataConclusao ? formatDateOnly(dados.dataConclusao) : null],
    [T.validade, dados.dataExpiracao ? formatDateOnly(dados.dataExpiracao) : null],
  ];
  const preenchidos = campos.filter(([, v]) => v);
  autoTable(doc, {
    ...ESTILO_TABELA,
    didDrawPage: () => { addAkurisHeader(doc, logo); },
    startY: y + 1,
    body: Array.from({ length: Math.ceil(preenchidos.length / 2) }, (_, i) => {
      const a = preenchidos[i * 2], b = preenchidos[i * 2 + 1];
      return [a[0], a[1] ?? '', b?.[0] ?? '', b?.[1] ?? ''];
    }),
    columnStyles: { 0: { textColor: [100, 116, 139], cellWidth: 32 }, 2: { textColor: [100, 116, 139], cellWidth: 32 } },
  });

  // ── 3. Mapa por seção ──────────────────────────────────────────────────
  doc.addPage();
  y = addAkurisHeader(doc, logo);
  y = addSectionTitle(doc, T.mapa, y, MARGEM);
  const secoes = (dados.porSecao?.length
    ? dados.porSecao
    : [...new Set(respostas.map(secaoDe))].map((s) => ({ secao: s, score: NaN, perguntas: undefined as number | undefined }))
  ).map((s: { secao: string; score: number; perguntas?: number }) => {
    const daSecao = respostas.filter((x) => secaoDe(x) === s.secao);
    return {
      ...s,
      n: s.perguntas ?? daSecao.length,
      lac: daSecao.filter((x) => ehLacuna({ pontuacao: x.pontuacao ?? null, peso: x.peso ?? null })).length,
    };
  }).sort((a, b) => (a.score || 0) - (b.score || 0));
  for (const s of secoes) {
    y = garantir(doc, y, 11, logo);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(AKURIS_COLORS.text);
    doc.text(s.secao, MARGEM, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(AKURIS_COLORS.textLight);
    const meta = `${s.n} ${T.colPerguntas.toLowerCase()}${s.lac ? ` · ${s.lac} ${T.colLacunas.toLowerCase()}` : ''}`;
    doc.text(meta, MARGEM + 128, y, { align: 'right' });
    if (Number.isFinite(s.score)) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(corDoScore(s.score));
      doc.text(`${s.score.toFixed(0)}%`, MARGEM + LARGURA_UTIL, y, { align: 'right' });
      drawProgressBar(doc, MARGEM, y + 2, LARGURA_UTIL, 2.2, s.score, corDoScore(s.score));
    }
    y += 10;
  }

  // ── 4. Lacunas e o que pedir ───────────────────────────────────────────
  if (lacunas.length) {
    y = garantir(doc, y + 6, 30, logo);
    y = addSectionTitle(doc, T.lacunasTitulo, y, MARGEM);
    autoTable(doc, {
      ...ESTILO_TABELA,
      didDrawPage: () => { addAkurisHeader(doc, logo); },
      startY: y,
      head: [[r.colPergunta, T.colSecao, r.colResposta, T.colPeso, T.colPedir]],
      body: lacunas.map((l) => [
        l.pergunta, secaoDe(l), l.resposta ?? '—', String(l.peso ?? 1),
        pedidos.get(norm(l.pergunta)) ?? T.pedirPadrao,
      ]),
      columnStyles: { 0: { cellWidth: 44, fontStyle: 'bold' }, 1: { cellWidth: 30 }, 2: { cellWidth: 20 }, 3: { cellWidth: 12, halign: 'center' }, 4: { cellWidth: 64 } },
      didParseCell: (c) => {
        if (c.section === 'body' && c.column.index === 3 && Number(c.cell.raw) >= 3) c.cell.styles.textColor = [239, 68, 68];
      },
    });
  }

  // ── 5. Leitura da IA ───────────────────────────────────────────────────
  doc.addPage();
  y = addAkurisHeader(doc, logo);
  y = addSectionTitle(doc, r.seccaoParecer, y, MARGEM);
  if (!dados.parecer) {
    y = paragrafo(doc, r.semParecer, y, logo);
  } else {
    const p = dados.parecer;
    const cab = [
      p.nivelRisco ? `${r.nivelRisco}: ${p.nivelRisco}` : null,
      p.confianca ? `${r.confianca}: ${p.confianca}` : null,
      p.respostasAnalisadas ? `${p.respostasAnalisadas} ${T.analisadas}` : null,
      dados.parecerEm ? formatDateOnly(dados.parecerEm) : null,
    ].filter(Boolean).join('   ·   ');
    if (cab) y = paragrafo(doc, cab, y, logo, 9, [30, 41, 59]);
    // Ressalva no corpo: interpretação, não cálculo.
    doc.setFillColor(245, 243, 255);
    doc.setFontSize(8);
    const av = doc.splitTextToSize(r.avisoParecer, LARGURA_UTIL - 8);
    doc.roundedRect(MARGEM, y - 1, LARGURA_UTIL, av.length * 3.8 + 5, 1.5, 1.5, 'F');
    doc.setTextColor(90, 63, 214);
    doc.setFont('helvetica', 'normal');
    av.forEach((l: string, i: number) => doc.text(l, MARGEM + 4, y + 3.2 + i * 3.8));
    y += av.length * 3.8 + 9;
    if (p.resumo) y = paragrafo(doc, p.resumo, y, logo, 10, [30, 41, 59]);
    y = lista(doc, r.pontosFortes, p.pontosFortes, y + 2, logo);
    y = lista(doc, r.pontosAtencao, p.pontosAtencao, y, logo);
    y = lista(doc, r.evidenciasEmFalta, p.evidenciasEmFalta, y, logo);
    y = lista(doc, r.recomendacoes, p.recomendacoes, y, logo);
    if (p.secoes?.length) {
      y = garantir(doc, y + 2, 20, logo);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(AKURIS_COLORS.text);
      doc.text(T.leituraSecao, MARGEM, y);
      y += 7;
      for (const s of p.secoes) {
        y = garantir(doc, y, 14, logo);
        doc.setFillColor(AKURIS_COLORS.primary);
        doc.rect(MARGEM, y - 3.5, 1.2, 5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(AKURIS_COLORS.text);
        doc.text(s.secao, MARGEM + 4, y);
        y += 6;
        y = lista(doc, r.pontosFortes, s.pontosFortes, y, logo);
        y = lista(doc, r.pontosAtencao, s.pontosAtencao, y, logo);
      }
    }
  }

  // ── 6. Respostas detalhadas, por seção ─────────────────────────────────
  if (respostas.length) {
    doc.addPage();
    y = addAkurisHeader(doc, logo);
    y = addSectionTitle(doc, T.detalhadas, y, MARGEM);
    const grupos = new Map<string, RespostaDoRelatorio[]>();
    for (const x of respostas) grupos.set(secaoDe(x), [...(grupos.get(secaoDe(x)) ?? []), x]);
    const body: any[] = [];
    for (const [secao, itens] of grupos) {
      body.push([{ content: secao.toUpperCase(), colSpan: 4, styles: { fontStyle: 'bold', fontSize: 7, textColor: [117, 82, 255], fillColor: [245, 243, 255] } }]);
      for (const x of itens) {
        const rr = { pontuacao: x.pontuacao ?? null, peso: x.peso ?? null };
        const nota = notaDe(rr);
        const pergunta = x.justificativa ? `${x.pergunta}\n${T.obs}: ${x.justificativa}` : x.pergunta;
        body.push([
          pergunta,
          x.resposta ?? '—',
          nota === null ? '—' : `${nota.toFixed(nota % 1 ? 1 : 0)}/${maximoDe(rr)}`,
          x.temAnexo ? T.sim : T.nao,
        ]);
      }
    }
    autoTable(doc, {
      ...ESTILO_TABELA,
      didDrawPage: () => { addAkurisHeader(doc, logo); },
      startY: y,
      head: [[r.colPergunta, r.colResposta, r.colNota, T.colEvidencia]],
      body,
      columnStyles: { 0: { cellWidth: 106 }, 1: { cellWidth: 30 }, 2: { cellWidth: 18, halign: 'right' }, 3: { cellWidth: 16, halign: 'center' } },
      didParseCell: (c) => {
        if (c.section !== 'body' || (c.row.raw as unknown[])?.length !== 4) return;
        if (c.column.index === 2) {
          const [a, b] = String(c.cell.raw).split('/').map(Number);
          if (b) c.cell.styles.textColor = a / b < 0.6 ? [239, 68, 68] : [34, 197, 94];
          c.cell.styles.fontStyle = 'bold';
        }
        if (c.column.index === 3) c.cell.styles.textColor = c.cell.raw === T.sim ? [34, 197, 94] : [148, 163, 184];
      },
    });
  }

  // ── 7. Decisão e aprovação ─────────────────────────────────────────────
  doc.addPage();
  y = addAkurisHeader(doc, logo);
  y = addSectionTitle(doc, T.decisao, y, MARGEM);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(AKURIS_COLORS.text);
  T.decisaoOpcoes.forEach((o, i) => {
    doc.setDrawColor(AKURIS_COLORS.textLight);
    doc.rect(MARGEM, y + i * 8 - 3.5, 4, 4, 'S');
    doc.text(o, MARGEM + 7, y + i * 8);
  });
  y += 30;
  rotulo(doc, T.justificativa, MARGEM, y);
  doc.setDrawColor(AKURIS_COLORS.border);
  doc.roundedRect(MARGEM, y + 2, LARGURA_UTIL, 32, 1.5, 1.5, 'S');
  y += 48;
  [[T.responsavel, MARGEM], [T.data, MARGEM + 72], [T.assinatura, MARGEM + 112]].forEach(([t, x]) => {
    doc.setDrawColor(AKURIS_COLORS.textLight);
    doc.line(x as number, y, (x as number) + (t === T.data ? 32 : t === T.assinatura ? 58 : 64), y);
    rotulo(doc, t as string, x as number, y + 5);
  });

  // ── 8. Metodologia ─────────────────────────────────────────────────────
  y += 22;
  y = addSectionTitle(doc, T.metodologia, y, MARGEM);
  paragrafo(doc, T.metodologiaTxt, y, logo, 8.5, [100, 116, 139]);

  addAkurisFooter(doc, dados.empresaNome);

  const nomeSeguro = dados.fornecedorNome.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
  doc.save(`avaliacao-${nomeSeguro || 'fornecedor'}.pdf`);
}
