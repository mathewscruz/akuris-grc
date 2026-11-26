/**
 * Relatório executivo da avaliação de um fornecedor.
 *
 * Estrutura fixa, igual para todos os fornecedores, para que quem lê saiba
 * sempre onde está cada coisa:
 *   Capa · Índice · 01 Resumo executivo · 02 Perfil de risco ·
 *   03 Lacunas e plano de ação · 04 Análise do avaliador · 05 Decisão ·
 *   Anexo A Respostas detalhadas · Anexo B Metodologia
 *
 * Tudo o que é número, recomendação e veredito vem de cálculo
 * (avaliacao-regras.ts). A leitura da IA aparece só na secção 04, rotulada,
 * em blocos fixos — nunca como texto corrido no resumo.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadAkurisLogo } from '@/lib/pdf-utils';
import { formatDateOnly } from '@/lib/date-utils';
import { getAppLocale } from '@/lib/i18n-locale';
import type { ParecerDaIA } from './parecer-ia-types';
import {
  celulaDaMatriz,
  classificarRisco,
  coberturaDeEvidencia,
  ehLacuna,
  ehLacunaCritica,
  lacunasPorImpacto,
  maximoDe,
  notaDe,
  recomendacaoDe,
  type Classificacao,
  type FaixaPeso,
  type FaixaResultado,
  type Recomendacao,
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


// ─── Textos ─────────────────────────────────────────────────────────────────
function textos(pt: boolean) {
  return pt
    ? {
        eyebrow: 'Avaliação de Fornecedor', confidencial: 'Confidencial', idFornecedor: 'Identificação do fornecedor',
        cnpj: 'CNPJ', questionario: 'Questionário', concluido: 'Concluído em', enviado: 'Enviado em', codigo: 'Código',
        categoria: 'Categoria', preparadoPara: 'Preparado para', geradoEm: 'Gerado em', semNota: 'Sem nota',
        indice: 'Índice', pagina: (a: number, b: number) => `Página ${a} de ${b}`,
        classes: { baixo: 'Excelente', moderado: 'Bom', elevado: 'Regular', critico: 'Ruim' } as Record<Classificacao, string>,
        s1: 'Resumo executivo', s2: 'Perfil de risco', s3: 'Lacunas e plano de ação', s4: 'Análise do avaliador',
        s5: 'Decisão e aprovação', a1: 'Anexo A · Respostas detalhadas', a2: 'Anexo B · Metodologia',
        veredito: (nome: string, s: string, c: string, n: number, l: number, cr: number, ev: number) =>
          `${nome} obteve ${s}/100 (${c}) em ${n} respostas avaliadas. Foram identificadas ${l} lacunas, ${cr} delas em perguntas de peso elevado, e ${ev}% das respostas têm evidência anexada.`,
        vereditoSem: (nome: string) => `${nome} não tem respostas pontuáveis neste questionário, por isso não há nota calculada.`,
        kRespostas: 'Respostas', kEvidencias: 'Evidências', kLacunas: 'Lacunas', kCriticas: 'Lacunas críticas',
        recomendacao: 'Recomendação',
        rec: { aprovar: 'Aprovar', aprovar_com_condicoes: 'Aprovar com condições', reprovar: 'Reprovar' } as Record<Recomendacao, string>,
        recTxt: {
          aprovar: 'Nota elevada, sem lacunas críticas e com respostas comprovadas. Fornecedor apto para contratação.',
          aprovar_com_condicoes: 'Fornecedor apto mediante correção das lacunas listadas na seção 03 dentro dos prazos sugeridos.',
          reprovar: 'Nota abaixo do mínimo aceitável. Não recomendado sem plano de correção e nova avaliação.',
        } as Record<Recomendacao, string>,
        motivoCriticas: (n: number) => `${n} lacuna(s) em perguntas de peso elevado`,
        motivoEvidencia: 'Respostas sem evidência anexada: a nota reflete apenas declarações',
        principais: 'Principais pontos de atenção', semLacunas: 'Nenhuma resposta abaixo do limite de 6/10.',
        dominios: 'Desempenho por domínio', dominiosSub: 'Nota por seção (0–100)',
        matriz: 'Matriz de risco', matrizSub: 'Nº de perguntas por peso × resultado',
        peso: 'Peso', resultado: 'Resultado',
        pesos: { alto: 'Alto', medio: 'Médio', baixo: 'Baixo' } as Record<FaixaPeso, string>,
        resultados: { nao_atende: 'Não atende', parcial: 'Parcial', atende: 'Atende' } as Record<FaixaResultado, string>,
        colSecao: 'Seção', colPerguntas: 'Perguntas', colLacunas: 'Lacunas', colNota: 'Nota',
        colPrioridade: 'Prioridade', colPergunta: 'Pergunta', colResposta: 'Resposta', colPedir: 'O que pedir', colPrazo: 'Prazo',
        alta: 'Alta', media: 'Média', dias: (n: number) => `${n} dias`,
        pedirPadrao: 'Evidência do controle ou plano de correção com prazo.',
        semPlano: 'Não há lacunas a tratar: todas as respostas pontuadas atingiram 6/10 ou mais.',
        avisoIa: 'Leitura automática das respostas e anexos. É interpretação e não altera a nota.',
        confianca: 'Confiança', modelo: 'Modelo', analisadas: 'respostas analisadas', riscoIa: 'Risco apontado',
        contexto: 'Contexto', fortes: 'Pontos fortes', fragilidades: 'Fragilidades', emFalta: 'Evidências em falta', recomendacoes: 'Recomendações',
        semIa: 'Esta avaliação não tem leitura automática. Use “Reavaliar” para gerar a análise.',
        decisaoOpcoes: ['Aprovado', 'Aprovado com condições', 'Reprovado'],
        justificativa: 'Justificativa / condições', responsavel: 'Responsável pela decisão', data: 'Data', assinatura: 'Assinatura',
        evid: 'Evid.', sim: 'Sim', nao: 'Não', obs: 'Observação', semSecao: 'Sem seção',
        metodo: [
          ['Nota da resposta', 'Cada resposta recebe uma nota de 0 a 10. Respostas “Não se aplica”, texto livre e perguntas em branco ficam fora do cálculo.'],
          ['Nota final', 'Média das notas ponderada pelo peso de cada pergunta, expressa de 0 a 100.'],
          ['Lacunas', 'Resposta com nota inferior a 6. É crítica quando o peso da pergunta é 3 ou mais.'],
          ['Recomendação', 'Reprovar abaixo de 40. Aprovar com 80 ou mais, sem lacunas críticas e com pelo menos metade das respostas comprovadas. Nos restantes casos, aprovar com condições.'],
          ['Prazos sugeridos', 'Lacunas críticas: 30 dias. Restantes: 60 dias.'],
          ['Análise do avaliador', 'Leitura automática das respostas e anexos. Serve de apoio à decisão e não altera a nota.'],
        ] as Array<[string, string]>,
        faixas: 'Faixas de classificação',
      }
    : {
        eyebrow: 'Supplier Assessment', confidencial: 'Confidential', idFornecedor: 'Supplier identification',
        cnpj: 'Tax ID', questionario: 'Questionnaire', concluido: 'Completed on', enviado: 'Sent on', codigo: 'Code',
        categoria: 'Category', preparadoPara: 'Prepared for', geradoEm: 'Generated on', semNota: 'No score',
        indice: 'Contents', pagina: (a: number, b: number) => `Page ${a} of ${b}`,
        classes: { baixo: 'Excellent', moderado: 'Good', elevado: 'Fair', critico: 'Poor' } as Record<Classificacao, string>,
        s1: 'Executive summary', s2: 'Risk profile', s3: 'Gaps and action plan', s4: 'Assessor analysis',
        s5: 'Decision and approval', a1: 'Appendix A · Detailed answers', a2: 'Appendix B · Methodology',
        veredito: (nome: string, s: string, c: string, n: number, l: number, cr: number, ev: number) =>
          `${nome} scored ${s}/100 (${c}) across ${n} assessed answers. ${l} gaps were found, ${cr} of them on high-weight questions, and ${ev}% of answers have attached evidence.`,
        vereditoSem: (nome: string) => `${nome} has no scorable answers in this questionnaire, so no score was calculated.`,
        kRespostas: 'Answers', kEvidencias: 'Evidence', kLacunas: 'Gaps', kCriticas: 'Critical gaps',
        recomendacao: 'Recommendation',
        rec: { aprovar: 'Approve', aprovar_com_condicoes: 'Approve with conditions', reprovar: 'Reject' } as Record<Recomendacao, string>,
        recTxt: {
          aprovar: 'High score, no critical gaps and evidenced answers. Supplier fit for engagement.',
          aprovar_com_condicoes: 'Supplier fit provided the gaps listed in section 03 are fixed within the suggested deadlines.',
          reprovar: 'Score below the acceptable minimum. Not recommended without a remediation plan and reassessment.',
        } as Record<Recomendacao, string>,
        motivoCriticas: (n: number) => `${n} gap(s) on high-weight questions`,
        motivoEvidencia: 'Answers without attached evidence: the score reflects statements only',
        principais: 'Key points of attention', semLacunas: 'No answer below the 6/10 threshold.',
        dominios: 'Performance by domain', dominiosSub: 'Score per section (0–100)',
        matriz: 'Risk matrix', matrizSub: 'Questions by weight × result',
        peso: 'Weight', resultado: 'Result',
        pesos: { alto: 'High', medio: 'Medium', baixo: 'Low' } as Record<FaixaPeso, string>,
        resultados: { nao_atende: 'Not met', parcial: 'Partial', atende: 'Met' } as Record<FaixaResultado, string>,
        colSecao: 'Section', colPerguntas: 'Questions', colLacunas: 'Gaps', colNota: 'Score',
        colPrioridade: 'Priority', colPergunta: 'Question', colResposta: 'Answer', colPedir: 'What to request', colPrazo: 'Deadline',
        alta: 'High', media: 'Medium', dias: (n: number) => `${n} days`,
        pedirPadrao: 'Evidence of the control or a dated remediation plan.',
        semPlano: 'No gaps to address: every scored answer reached 6/10 or more.',
        avisoIa: 'Automated reading of answers and attachments. It is interpretation and does not change the score.',
        confianca: 'Confidence', modelo: 'Model', analisadas: 'answers analysed', riscoIa: 'Stated risk',
        contexto: 'Context', fortes: 'Strengths', fragilidades: 'Weaknesses', emFalta: 'Missing evidence', recomendacoes: 'Recommendations',
        semIa: 'This assessment has no automated reading. Use “Reassess” to generate it.',
        decisaoOpcoes: ['Approved', 'Approved with conditions', 'Rejected'],
        justificativa: 'Rationale / conditions', responsavel: 'Decision owner', data: 'Date', assinatura: 'Signature',
        evid: 'Evid.', sim: 'Yes', nao: 'No', obs: 'Note', semSecao: 'No section',
        metodo: [
          ['Answer score', 'Each answer gets a 0–10 score. “Not applicable”, free text and blank questions are excluded.'],
          ['Final score', 'Weighted mean of answer scores by question weight, from 0 to 100.'],
          ['Gaps', 'An answer scoring below 6. Critical when the question weight is 3 or more.'],
          ['Recommendation', 'Reject below 40. Approve at 80 or more with no critical gaps and at least half of answers evidenced. Otherwise approve with conditions.'],
          ['Suggested deadlines', 'Critical gaps: 30 days. Others: 60 days.'],
          ['Assessor analysis', 'Automated reading of answers and attachments. Supports the decision and does not change the score.'],
        ] as Array<[string, string]>,
        faixas: 'Rating bands',
      };
}

// ─── Identidade ─────────────────────────────────────────────────────────────
type RGB = [number, number, number];
const C = {
  navy: [10, 22, 40] as RGB,
  navy2: [27, 42, 69] as RGB,
  roxo: [117, 82, 255] as RGB,
  roxoClaro: [241, 238, 255] as RGB,
  texto: [15, 23, 42] as RGB,
  suave: [100, 116, 139] as RGB,
  linha: [226, 232, 240] as RGB,
  fundo: [246, 248, 251] as RGB,
  verde: [22, 163, 74] as RGB,
  ambar: [217, 119, 6] as RGB,
  laranja: [234, 88, 12] as RGB,
  vermelho: [220, 38, 38] as RGB,
  branco: [255, 255, 255] as RGB,
};
const COR_CLASSE: Record<Classificacao, RGB> = { baixo: C.verde, moderado: C.ambar, elevado: C.laranja, critico: C.vermelho };
const corDaNota = (s: number) => COR_CLASSE[classificarRisco(s) ?? 'critico'];

const W = 210, H = 297, M = 20, UTIL = W - 2 * M, TOPO = 34, BASE = H - 22;

const fill = (d: jsPDF, c: RGB) => d.setFillColor(c[0], c[1], c[2]);
const draw = (d: jsPDF, c: RGB) => d.setDrawColor(c[0], c[1], c[2]);
const ink = (d: jsPDF, c: RGB) => d.setTextColor(c[0], c[1], c[2]);
function font(d: jsPDF, size: number, bold = false, c: RGB = C.texto) {
  d.setFont('helvetica', bold ? 'bold' : 'normal');
  d.setFontSize(size);
  ink(d, c);
}
function opacidade(d: jsPDF, a: number) {
  const G = (d as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
  (d as unknown as { setGState: (g: unknown) => void }).setGState(new G({ opacity: a }));
}

/** Marca Akuris desenhada em vetor: hexágono + wordmark. */
function marca(d: jsPDF, x: number, y: number, escala = 1, cor: RGB = C.navy) {
  const r = 2.6 * escala;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return [x + r + r * Math.cos(a), y + r * Math.sin(a)] as [number, number];
  });
  fill(d, cor);
  d.lines(pts.slice(1).map((q, i) => [q[0] - pts[i][0], q[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], 'F', true);
  fill(d, C.roxo);
  d.triangle(pts[0][0], pts[0][1], x + r + r * 0.55, y + r * 0.32, x + r - r * 0.55, y + r * 0.32, 'F');
  font(d, 11 * escala, true, cor);
  d.text('Akuris', x + 2 * r + 1.6 * escala, y + 1.4 * escala);
}

function hexagono(d: jsPDF, cx: number, cy: number, r: number) {
  const p = Array.from({ length: 7 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  for (let i = 0; i < 6; i++) d.line(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
}

function cabecalho(d: jsPDF, fornecedor: string, T: ReturnType<typeof textos>) {
  marca(d, M, 15, 0.9);
  font(d, 7.5, false, C.suave);
  d.text(`${fornecedor}  ·  ${T.confidencial}`, W - M, 16, { align: 'right' });
  draw(d, C.linha);
  d.setLineWidth(0.2);
  d.line(M, 22, W - M, 22);
}

/** Abre uma secção numerada ("01 ——  Título") numa página nova. */
function abrirSecao(d: jsPDF, num: string, titulo: string, fornecedor: string, T: ReturnType<typeof textos>, indice: Array<[string, string, number]>): number {
  d.addPage();
  cabecalho(d, fornecedor, T);
  indice.push([num, titulo, d.getNumberOfPages()]);
  font(d, 11, true, C.roxo);
  d.text(num, M, 40);
  draw(d, C.roxo);
  d.setLineWidth(0.5);
  d.line(M + 9, 38.6, M + 22, 38.6);
  font(d, 20, true, C.texto);
  d.text(titulo, M, 50);
  return 60;
}

function subtitulo(d: jsPDF, texto: string, x: number, y: number) {
  font(d, 7.5, true, C.suave);
  d.setCharSpace(0.4);
  d.text(texto.toUpperCase(), x, y);
  d.setCharSpace(0);
}

function medidor(d: jsPDF, cx: number, cy: number, r: number, score: number | null, rotulo: string) {
  const arco = (de: number, ate: number, cor: RGB) => {
    draw(d, cor);
    d.setLineWidth(4.2);
    d.setLineCap('round');
    const passos = 60;
    for (let i = 0; i < passos; i++) {
      const a1 = Math.PI + (de + ((ate - de) * i) / passos) * Math.PI;
      const a2 = Math.PI + (de + ((ate - de) * (i + 1)) / passos) * Math.PI;
      d.line(cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2));
    }
  };
  arco(0, 1, C.linha);
  if (score !== null && score > 0) {
    const f = Math.min(1, score / 100);
    arco(0, f * 0.85, C.navy);
    if (f > 0.85) arco(f * 0.85, f, C.roxo);
    else arco(Math.max(0, f - 0.08), f, C.roxo);
  }
  d.setLineCap('butt');
  d.setLineWidth(0.2);
  font(d, 26, true, C.texto);
  d.text(score === null ? '—' : score.toFixed(0), cx, cy - 3, { align: 'center' });
  font(d, 8, false, C.suave);
  d.text('/100', cx, cy + 2.5, { align: 'center' });
  font(d, 9.5, true, score === null ? C.suave : corDaNota(score));
  d.text(rotulo, cx, cy + 10, { align: 'center' });
}

function escudo(d: jsPDF, x: number, y: number, s: number, cor: RGB) {
  const p: Array<[number, number]> = [[0, 0.1], [0.5, -0.05], [1, 0.1], [1, 0.5], [0.5, 1], [0, 0.5]];
  const abs = p.map(([a, b]) => [x + a * s, y + b * s * 1.15] as [number, number]);
  fill(d, C.roxoClaro);
  draw(d, cor);
  d.setLineWidth(0.7);
  d.lines(abs.slice(1).map((q, i) => [q[0] - abs[i][0], q[1] - abs[i][1]]), abs[0][0], abs[0][1], [1, 1], 'FD', true);
  d.setLineWidth(1);
  d.line(x + s * 0.28, y + s * 0.5, x + s * 0.45, y + s * 0.66);
  d.line(x + s * 0.45, y + s * 0.66, x + s * 0.74, y + s * 0.34);
  d.setLineWidth(0.2);
}

function radar(d: jsPDF, cx: number, cy: number, r: number, itens: Array<{ rotulo: string; v: number }>) {
  const n = itens.length;
  const ang = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pt = (i: number, f: number) => [cx + r * f * Math.cos(ang(i)), cy + r * f * Math.sin(ang(i))] as [number, number];
  draw(d, C.linha);
  d.setLineWidth(0.2);
  for (const f of [0.25, 0.5, 0.75, 1]) for (let i = 0; i < n; i++) { const a = pt(i, f), b = pt((i + 1) % n, f); d.line(a[0], a[1], b[0], b[1]); }
  for (let i = 0; i < n; i++) { const a = pt(i, 1); d.line(cx, cy, a[0], a[1]); }
  const poly = itens.map((it, i) => pt(i, Math.max(0.02, it.v / 100)));
  const seg = poly.map((q, i) => { const nx = poly[(i + 1) % n]; return [nx[0] - q[0], nx[1] - q[1]]; }).slice(0, -1);
  opacidade(d, 0.18);
  fill(d, C.roxo);
  d.lines(seg, poly[0][0], poly[0][1], [1, 1], 'F', true);
  opacidade(d, 1);
  draw(d, C.roxo);
  d.setLineWidth(0.6);
  d.lines(seg, poly[0][0], poly[0][1], [1, 1], 'S', true);
  poly.forEach((q) => { fill(d, C.roxo); d.circle(q[0], q[1], 0.7, 'F'); });
  d.setLineWidth(0.2);
  itens.forEach((it, i) => {
    const [x, y] = pt(i, 1.2);
    const c = Math.cos(ang(i));
    const al = Math.abs(c) < 0.2 ? 'center' : c > 0 ? 'left' : 'right';
    font(d, 6.2, false, C.suave);
    const linhas = d.splitTextToSize(it.rotulo, 26).slice(0, 2);
    d.text(linhas, x, y - (linhas.length - 1) * 1.2, { align: al as 'left' });
    font(d, 7, true, C.texto);
    d.text(String(Math.round(it.v)), x, y + linhas.length * 2.6, { align: al as 'left' });
  });
}

const COR_MATRIZ: Record<FaixaPeso, Record<FaixaResultado, RGB>> = {
  alto: { nao_atende: [248, 180, 180], parcial: [253, 214, 160], atende: [187, 232, 200] },
  medio: { nao_atende: [253, 214, 160], parcial: [253, 230, 180], atende: [187, 232, 200] },
  baixo: { nao_atende: [253, 230, 180], parcial: [210, 238, 216], atende: [187, 232, 200] },
};

const norm = (s: string) => s.trim().toLowerCase();

export async function gerarRelatorioFornecedor(dados: DadosDoRelatorio, r: RotulosDoRelatorio): Promise<void> {
  const pt = getAppLocale().startsWith('pt');
  const T = textos(pt);
  const d = new jsPDF({ format: 'a4', unit: 'mm' });
  const logo = await loadAkurisLogo();
  const nome = dados.fornecedorNome;
  const respostas = dados.respostas ?? [];
  const rr = (x: RespostaDoRelatorio) => ({ pontuacao: x.pontuacao ?? null, peso: x.peso ?? null, temAnexo: x.temAnexo });
  const score = dados.scoreFinal === null || dados.scoreFinal === undefined ? null : Number(dados.scoreFinal);
  const classe = classificarRisco(score);
  const rotuloClasse = classe ? T.classes[classe] : T.semNota;
  const lacunas = lacunasPorImpacto(respostas.map((x) => ({ ...x, ...rr(x) })));
  const criticas = lacunas.filter(ehLacunaCritica).length;
  const cobertura = coberturaDeEvidencia(respostas.map(rr));
  const pontuadas = respostas.filter((x) => notaDe(rr(x)) !== null).length;
  const rec = recomendacaoDe(score, criticas, cobertura);
  const secaoDe = (x: RespostaDoRelatorio) => x.secao?.trim() || T.semSecao;
  const indice: Array<[string, string, number]> = [];

  const pedidos = new Map<string, string>();
  for (const s of dados.parecer?.secoes ?? []) for (const p of s.oQuePedir ?? []) if (p.pergunta && p.pedir) pedidos.set(norm(p.pergunta), p.pedir);

  const secoes = (dados.porSecao?.length
    ? dados.porSecao
    : [...new Set(respostas.map(secaoDe))].map((s) => ({ secao: s, score: NaN, perguntas: undefined as number | undefined }))
  ).map((s) => {
    const daSecao = respostas.filter((x) => secaoDe(x) === s.secao);
    return { ...s, n: s.perguntas ?? daSecao.length, lac: daSecao.filter((x) => ehLacuna(rr(x))).length };
  });

  const tabela = {
    theme: 'plain' as const,
    styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, textColor: C.texto, lineColor: C.linha, lineWidth: { bottom: 0.2 } as any, overflow: 'linebreak' as const, valign: 'middle' as const },
    headStyles: { fontStyle: 'bold' as const, fontSize: 7, textColor: C.branco, fillColor: C.navy },
    margin: { left: M, right: M, top: TOPO, bottom: 24 },
    rowPageBreak: 'avoid' as const,
    didDrawPage: () => cabecalho(d, nome, T),
  };

  // ── Capa ────────────────────────────────────────────────────────────────
  {
    const faixa = 128;
    fill(d, C.navy);
    d.rect(0, 0, W, faixa, 'F');
    draw(d, C.navy2);
    d.setLineWidth(0.3);
    const hr = 14;
    for (let col = 0; col < 7; col++) for (let lin = 0; lin < 7; lin++) {
      const cx = 108 + col * hr * 1.5;
      const cy = lin * hr * Math.sqrt(3) + (col % 2 ? (hr * Math.sqrt(3)) / 2 : 0) - 6;
      if (cy - hr < faixa) hexagono(d, cx, cy, hr);
    }
    fill(d, C.branco);
    d.rect(0, faixa, W, H - faixa, 'F');
    if (logo) { try { d.addImage(logo, 'PNG', M, 20, 36, 10.8); } catch { marca(d, M, 26, 1.3, C.branco); } } else marca(d, M, 26, 1.3, C.branco);
    font(d, 14, false, [190, 198, 220]);
    d.text(T.eyebrow, M, 66);
    font(d, 28, true, C.branco);
    const linhasNome = d.splitTextToSize(nome, UTIL - 10).slice(0, 2);
    d.text(linhasNome, M, 80);
    const yb = 80 + linhasNome.length * 11 + 2;
    const selo = score === null ? T.semNota : `${score.toFixed(0)}  ·  ${rotuloClasse}`;
    font(d, 12, true, C.branco);
    const ws = d.getTextWidth(selo) + 16;
    draw(d, C.roxo);
    d.setLineWidth(0.8);
    d.roundedRect(M, yb, ws, 11, 5.5, 5.5, 'S');
    d.text(selo, M + 8, yb + 7.4);
    fill(d, C.roxo);
    d.rect(M, yb + 19, 22, 0.8, 'F');

    let y = faixa + 22;
    subtitulo(d, T.idFornecedor, M, y);
    y += 12;
    const campos: Array<[string, string]> = ([
      [T.cnpj, dados.fornecedor?.cnpj],
      [T.questionario, dados.templateNome],
      [T.concluido, dados.dataConclusao ? formatDateOnly(dados.dataConclusao) : null],
      [T.codigo, dados.avaliacaoId ? dados.avaliacaoId.slice(0, 8).toUpperCase() : null],
      [T.categoria, dados.fornecedor?.categoria],
      [T.enviado, dados.dataEnvio ? formatDateOnly(dados.dataEnvio) : null],
    ] as Array<[string, string | null | undefined]>).filter(([, v]) => v) as Array<[string, string]>;
    campos.forEach(([k, v], i) => {
      const x = M + (i % 2) * (UTIL / 2);
      const yy = y + Math.floor(i / 2) * 24;
      font(d, 8.5, false, C.suave);
      d.text(k, x, yy);
      font(d, 11, true, C.texto);
      d.text(d.splitTextToSize(v, UTIL / 2 - 8).slice(0, 2), x, yy + 6);
      if (i % 2 === 1 && i < campos.length - 1) { draw(d, C.linha); d.setLineWidth(0.2); d.line(M, yy + 15, W - M, yy + 15); }
    });
    draw(d, C.linha);
    d.line(M, H - 26, W - M, H - 26);
    font(d, 8, false, C.suave);
    const rodape = [dados.empresaNome ? `${T.preparadoPara} ${dados.empresaNome}` : null, `${T.geradoEm} ${formatDateOnly(new Date().toISOString())}`, T.confidencial].filter(Boolean).join('   ·   ');
    d.text(rodape, M, H - 18);
    marca(d, W - M - 24, H - 19, 0.9);
  }

  // ── Índice (preenchido no fim) ──────────────────────────────────────────
  d.addPage();
  cabecalho(d, nome, T);
  const paginaIndice = d.getNumberOfPages();

  // ── 01 Resumo executivo ─────────────────────────────────────────────────
  let y = abrirSecao(d, '01', T.s1, nome, T, indice);
  font(d, 10, false, [51, 65, 85]);
  const veredito = score === null ? T.vereditoSem(nome) : T.veredito(nome, score.toFixed(0), rotuloClasse, pontuadas, lacunas.length, criticas, cobertura);
  const lv = d.splitTextToSize(veredito, 108);
  d.text(lv, M, y, { lineHeightFactor: 1.5 });
  medidor(d, W - M - 28, y + 22, 22, score, rotuloClasse);
  y = Math.max(y + lv.length * 5.3, y + 36) + 8;

  const kpis: Array<[string, string, RGB?]> = [
    [T.kRespostas, `${pontuadas}/${respostas.length}`],
    [T.kEvidencias, `${cobertura}%`, cobertura === 0 && pontuadas ? C.vermelho : undefined],
    [T.kLacunas, String(lacunas.length), lacunas.length ? C.ambar : undefined],
    [T.kCriticas, String(criticas), criticas ? C.vermelho : undefined],
  ];
  const kw = (UTIL - 9) / 4;
  kpis.forEach(([k, v, cor], i) => {
    const x = M + i * (kw + 3);
    fill(d, C.fundo);
    d.roundedRect(x, y, kw, 26, 2, 2, 'F');
    fill(d, cor ?? C.navy);
    d.rect(x, y + 5, 0.9, 16, 'F');
    font(d, 8, false, C.suave);
    d.text(k, x + 5, y + 9);
    font(d, 18, true, cor ?? C.texto);
    d.text(v, x + 5, y + 20);
  });
  y += 34;

  if (rec) {
    const motivos = [criticas ? T.motivoCriticas(criticas) : null, cobertura < 50 && pontuadas ? T.motivoEvidencia : null].filter(Boolean) as string[];
    font(d, 9, false);
    const lt = d.splitTextToSize(T.recTxt[rec], UTIL - 40);
    const lm = motivos.flatMap((m) => d.splitTextToSize(`•  ${m}`, UTIL - 40));
    const h = 22 + lt.length * 4.4 + (lm.length ? lm.length * 4.4 + 2 : 0);
    const cor = rec === 'reprovar' ? C.vermelho : rec === 'aprovar' ? C.verde : C.roxo;
    fill(d, [250, 249, 255]);
    draw(d, [214, 205, 255]);
    d.setLineWidth(0.3);
    d.roundedRect(M, y, UTIL, h, 2.5, 2.5, 'FD');
    escudo(d, M + 8, y + 7, 16, cor);
    subtitulo(d, T.recomendacao, M + 32, y + 9);
    font(d, 14, true, C.texto);
    d.text(T.rec[rec], M + 32, y + 16.5);
    font(d, 9, false, [71, 85, 105]);
    d.text(lt, M + 32, y + 23);
    if (lm.length) { font(d, 8.5, false, C.suave); d.text(lm, M + 32, y + 25 + lt.length * 4.4); }
    y += h + 12;
  }

  subtitulo(d, T.principais, M, y);
  y += 7;
  if (!lacunas.length) {
    font(d, 9.5, false, C.suave);
    d.text(T.semLacunas, M, y + 2);
  } else {
    lacunas.slice(0, 3).forEach((l, i) => {
      const critica = ehLacunaCritica(l);
      fill(d, critica ? [254, 226, 226] : [254, 243, 199]);
      d.circle(M + 3.5, y + 2.5, 3.5, 'F');
      font(d, 8.5, true, critica ? C.vermelho : C.ambar);
      d.text(String(i + 1), M + 3.5, y + 3.6, { align: 'center' });
      font(d, 9.5, true, C.texto);
      d.text(d.splitTextToSize(l.pergunta, UTIL - 14)[0], M + 11, y + 2);
      font(d, 8.5, false, C.suave);
      d.text(`${secaoDe(l)}  ·  ${T.colResposta}: ${l.resposta ?? '—'}  ·  ${T.peso} ${l.peso ?? 1}`, M + 11, y + 6.8);
      y += 13;
    });
  }

  // ── 02 Perfil de risco ──────────────────────────────────────────────────
  y = abrirSecao(d, '02', T.s2, nome, T, indice);
  const comNota = secoes.filter((s) => Number.isFinite(s.score));
  subtitulo(d, T.dominios, M, y);
  font(d, 7.5, false, C.suave);
  d.text(T.dominiosSub, M, y + 4.5);
  subtitulo(d, T.matriz, M + 104, y);
  font(d, 7.5, false, C.suave);
  d.text(T.matrizSub, M + 104, y + 4.5);
  if (comNota.length >= 3) {
    radar(d, M + 46, y + 50, 28, comNota.map((s) => ({ rotulo: s.secao, v: s.score })));
  } else {
    font(d, 8.5, false, C.suave);
    d.text('—', M, y + 20);
  }
  {
    const contagem: Record<string, number> = {};
    for (const x of respostas) { const c = celulaDaMatriz(rr(x)); if (c) contagem[`${c.peso}|${c.resultado}`] = (contagem[`${c.peso}|${c.resultado}`] ?? 0) + 1; }
    const pesos: FaixaPeso[] = ['alto', 'medio', 'baixo'];
    const res: FaixaResultado[] = ['nao_atende', 'parcial', 'atende'];
    const x0 = M + 120, y0 = y + 14, cel = 16;
    pesos.forEach((p, i) => {
      font(d, 7, false, C.suave);
      d.text(T.pesos[p], x0 - 3, y0 + i * (cel + 1.5) + cel / 2 + 1, { align: 'right' });
      res.forEach((rz, j) => {
        const n = contagem[`${p}|${rz}`] ?? 0;
        fill(d, n ? COR_MATRIZ[p][rz] : C.fundo);
        d.roundedRect(x0 + j * (cel + 1.5), y0 + i * (cel + 1.5), cel, cel, 1.5, 1.5, 'F');
        font(d, 11, true, n ? C.texto : [180, 190, 205]);
        d.text(String(n), x0 + j * (cel + 1.5) + cel / 2, y0 + i * (cel + 1.5) + cel / 2 + 1.8, { align: 'center' });
      });
    });
    res.forEach((rz, j) => {
      font(d, 6.5, false, C.suave);
      d.text(T.resultados[rz], x0 + j * (cel + 1.5) + cel / 2, y0 + 3 * (cel + 1.5) + 3, { align: 'center' });
    });
    font(d, 7, true, C.suave);
    d.text(T.resultado, x0 + (3 * cel + 3) / 2, y0 + 3 * (cel + 1.5) + 9, { align: 'center' });
    d.text(T.peso, x0 - 3, y0 - 3, { align: 'right' });
  }
  y += 98;
  autoTable(d, {
    ...tabela,
    startY: y,
    head: [[T.colSecao, T.colPerguntas, T.colLacunas, '', T.colNota]],
    body: [...secoes].sort((a, b) => (a.score || 0) - (b.score || 0)).map((s) => [s.secao, String(s.n), String(s.lac), '', Number.isFinite(s.score) ? `${s.score.toFixed(0)}` : '—']),
    columnStyles: { 0: { cellWidth: 62, fontStyle: 'bold' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 18, halign: 'center' }, 3: { cellWidth: 54 }, 4: { cellWidth: 16, halign: 'right', fontStyle: 'bold' } },
    didParseCell: (c) => {
      if (c.section === 'body' && c.column.index === 2 && Number(c.cell.raw) > 0) c.cell.styles.textColor = C.ambar;
    },
    didDrawCell: (c) => {
      if (c.section !== 'body' || c.column.index !== 3) return;
      const s = Number(String((c.row.raw as string[])[4]));
      if (!Number.isFinite(s)) return;
      const bx = c.cell.x + 2, by = c.cell.y + c.cell.height / 2 - 1.2, bw = c.cell.width - 4;
      fill(d, C.linha); d.roundedRect(bx, by, bw, 2.4, 1.2, 1.2, 'F');
      if (s > 0) { fill(d, corDaNota(s)); d.roundedRect(bx, by, Math.max(2.4, (bw * s) / 100), 2.4, 1.2, 1.2, 'F'); }
    },
  });

  // ── 03 Lacunas e plano de ação ──────────────────────────────────────────
  y = abrirSecao(d, '03', T.s3, nome, T, indice);
  if (!lacunas.length) {
    font(d, 10, false, C.suave);
    d.text(T.semPlano, M, y);
  } else {
    autoTable(d, {
      ...tabela,
      startY: y,
      head: [[T.colPrioridade, T.colPergunta, T.colResposta, T.colPedir, T.colPrazo]],
      body: lacunas.map((l) => {
        const critica = ehLacunaCritica(l);
        return [critica ? T.alta : T.media, `${l.pergunta}\n${secaoDe(l)} · ${T.peso} ${l.peso ?? 1}`, l.resposta ?? '—', pedidos.get(norm(l.pergunta)) ?? T.pedirPadrao, T.dias(critica ? 30 : 60)];
      }),
      columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' }, 1: { cellWidth: 56 }, 2: { cellWidth: 22 }, 3: { cellWidth: 54 }, 4: { cellWidth: 18, halign: 'right' } },
      didParseCell: (c) => {
        if (c.section === 'body' && c.column.index === 0) c.cell.styles.textColor = c.cell.raw === T.alta ? C.vermelho : C.ambar;
      },
    });
  }

  // ── 04 Análise do avaliador ─────────────────────────────────────────────
  y = abrirSecao(d, '04', T.s4, nome, T, indice);
  const p: ParecerDaIA | null | undefined = dados.parecer;
  if (!p) {
    font(d, 10, false, C.suave);
    d.text(d.splitTextToSize(T.semIa, UTIL), M, y);
  } else {
    const meta = [
      p.nivelRisco ? `${T.riscoIa}: ${p.nivelRisco}` : null,
      p.confianca ? `${T.confianca}: ${p.confianca}` : null,
      p.respostasAnalisadas ? `${p.respostasAnalisadas} ${T.analisadas}` : null,
      dados.parecerEm ? formatDateOnly(dados.parecerEm) : null,
    ].filter(Boolean).join('   ·   ');
    font(d, 8, false, C.roxo);
    d.text(d.splitTextToSize(T.avisoIa, UTIL), M, y);
    y += 5;
    if (meta) { font(d, 8, false, C.suave); d.text(meta, M, y); y += 4; }
    y += 5;
    const garantir = (h: number) => { if (y + h > BASE) { d.addPage(); cabecalho(d, nome, T); y = TOPO + 4; } };
    const bloco = (titulo: string, itens: string[] | undefined, texto?: string, cor: RGB = C.navy) => {
      if (!texto && !itens?.length) return;
      font(d, 9, false, [51, 65, 85]);
      const linhas = texto ? d.splitTextToSize(texto, UTIL - 12) : (itens ?? []).flatMap((it) => d.splitTextToSize(`•  ${it}`, UTIL - 12));
      let i = 0;
      while (i < linhas.length) {
        garantir(24);
        const cabe = Math.max(1, Math.floor((BASE - y - 14) / 4.6));
        const parte = linhas.slice(i, i + cabe);
        const h = 13 + parte.length * 4.6;
        fill(d, C.fundo);
        d.roundedRect(M, y, UTIL, h, 2, 2, 'F');
        fill(d, cor);
        d.rect(M, y, 1.1, h, 'F');
        subtitulo(d, titulo, M + 6, y + 7);
        font(d, 9, false, [51, 65, 85]);
        d.text(parte, M + 6, y + 13);
        y += h + 5;
        i += parte.length;
      }
    };
    bloco(T.contexto, undefined, p.resumo, C.roxo);
    bloco(T.fortes, p.pontosFortes, undefined, C.verde);
    bloco(T.fragilidades, p.pontosAtencao, undefined, C.vermelho);
    bloco(T.emFalta, p.evidenciasEmFalta, undefined, C.ambar);
    bloco(T.recomendacoes, p.recomendacoes, undefined, C.navy);
  }

  // ── 05 Decisão ──────────────────────────────────────────────────────────
  y = abrirSecao(d, '05', T.s5, nome, T, indice) + 4;
  T.decisaoOpcoes.forEach((o, i) => {
    draw(d, C.suave);
    d.setLineWidth(0.3);
    d.roundedRect(M, y + i * 10 - 4, 5, 5, 1, 1, 'S');
    font(d, 10.5, false, C.texto);
    d.text(o, M + 9, y + i * 10);
  });
  y += 36;
  subtitulo(d, T.justificativa, M, y);
  draw(d, C.linha);
  d.roundedRect(M, y + 3, UTIL, 50, 2, 2, 'S');
  y += 76;
  ([[T.responsavel, M, 70], [T.data, M + 78, 30], [T.assinatura, M + 116, 54]] as Array<[string, number, number]>).forEach(([t, x, w]) => {
    draw(d, C.suave);
    d.line(x, y, x + w, y);
    subtitulo(d, t, x, y + 5);
  });

  // ── Anexo A ─────────────────────────────────────────────────────────────
  if (respostas.length) {
    y = abrirSecao(d, 'A', T.a1, nome, T, indice);
    const grupos = new Map<string, RespostaDoRelatorio[]>();
    for (const x of respostas) grupos.set(secaoDe(x), [...(grupos.get(secaoDe(x)) ?? []), x]);
    const body: any[] = [];
    for (const [secao, itens] of grupos) {
      body.push([{ content: secao.toUpperCase(), colSpan: 4, styles: { fontStyle: 'bold', fontSize: 7, textColor: C.roxo, fillColor: C.roxoClaro } }]);
      for (const x of itens) {
        const nota = notaDe(rr(x));
        body.push([
          x.justificativa ? `${x.pergunta}\n${T.obs}: ${x.justificativa}` : x.pergunta,
          x.resposta ?? '—',
          nota === null ? '—' : `${nota.toFixed(nota % 1 ? 1 : 0)}/${maximoDe(rr(x))}`,
          x.temAnexo ? T.sim : T.nao,
        ]);
      }
    }
    autoTable(d, {
      ...tabela,
      startY: y,
      head: [[r.colPergunta, r.colResposta, r.colNota, T.evid]],
      body,
      columnStyles: { 0: { cellWidth: 108 }, 1: { cellWidth: 30 }, 2: { cellWidth: 18, halign: 'right' }, 3: { cellWidth: 14, halign: 'center' } },
      didParseCell: (c) => {
        if (c.section !== 'body' || (c.row.raw as unknown[])?.length !== 4) return;
        if (c.column.index === 2) {
          const [a, b] = String(c.cell.raw).split('/').map(Number);
          if (b) c.cell.styles.textColor = a / b < 0.6 ? C.vermelho : C.verde;
          c.cell.styles.fontStyle = 'bold';
        }
        if (c.column.index === 3) c.cell.styles.textColor = c.cell.raw === T.sim ? C.verde : [148, 163, 184];
      },
    });
  }

  // ── Anexo B ─────────────────────────────────────────────────────────────
  y = abrirSecao(d, 'B', T.a2, nome, T, indice);
  subtitulo(d, T.faixas, M, y);
  y += 6;
  const faixas: Array<[Classificacao, string, number]> = [['critico', '0–39', 40], ['elevado', '40–59', 20], ['moderado', '60–79', 20], ['baixo', '80–100', 20]];
  let fx = M;
  faixas.forEach(([c, rng, w], i) => {
    const bw = (UTIL * w) / 100;
    fill(d, COR_CLASSE[c]);
    if (i === 0) d.roundedRect(fx, y, bw, 5, 2.5, 2.5, 'F');
    else if (i === faixas.length - 1) d.roundedRect(fx, y, bw, 5, 2.5, 2.5, 'F');
    d.rect(fx + (i === 0 ? 3 : 0), y, bw - (i === 0 || i === faixas.length - 1 ? 3 : 0), 5, 'F');
    font(d, 8.5, true, C.texto);
    d.text(T.classes[c], fx, y + 11);
    font(d, 7.5, false, C.suave);
    d.text(rng, fx, y + 15.5);
    fx += bw;
  });
  y += 28;
  for (const [k, v] of T.metodo) {
    font(d, 9.5, true, C.texto);
    d.text(k, M, y);
    font(d, 9, false, [71, 85, 105]);
    const l = d.splitTextToSize(v, UTIL - 50);
    d.text(l, M + 45, y, { lineHeightFactor: 1.45 });
    y += Math.max(8, l.length * 4.7) + 4;
    draw(d, C.linha);
    d.line(M, y - 4, W - M, y - 4);
  }

  // ── Índice ──────────────────────────────────────────────────────────────
  d.setPage(paginaIndice);
  font(d, 20, true, C.texto);
  d.text(T.indice, M, 50);
  let yi = 68;
  for (const [num, titulo, pg] of indice) {
    font(d, 11, true, C.roxo);
    d.text(num, M, yi);
    font(d, 11.5, false, C.texto);
    d.text(titulo, M + 14, yi);
    font(d, 11, true, C.texto);
    d.text(String(pg - 1), W - M, yi, { align: 'right' });
    draw(d, C.linha);
    d.setLineWidth(0.2);
    d.line(M, yi + 5, W - M, yi + 5);
    yi += 14;
  }

  // ── Rodapé (sem capa) ───────────────────────────────────────────────────
  const total = d.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    d.setPage(i);
    draw(d, C.linha);
    d.setLineWidth(0.2);
    d.line(M, H - 15, W - M, H - 15);
    font(d, 7.5, false, C.suave);
    d.text(dados.empresaNome ? `${T.preparadoPara} ${dados.empresaNome}` : 'Akuris', M, H - 10);
    d.text(T.pagina(i - 1, total - 1), W - M, H - 10, { align: 'right' });
  }

  const nomeSeguro = nome.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
  d.save(`avaliacao-${nomeSeguro || 'fornecedor'}.pdf`);
}
