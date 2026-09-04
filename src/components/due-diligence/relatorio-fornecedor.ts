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
import type { ParecerDaIA } from './parecer-ia-types';

export interface DadosDoRelatorio {
  fornecedorNome: string;
  empresaNome?: string;
  templateNome?: string | null;
  scoreFinal?: number | null;
  status?: string | null;
  dataEnvio?: string | null;
  dataConclusao?: string | null;
  parecer?: ParecerDaIA | null;
  parecerEm?: string | null;
  /**
   * A nota de cada secção, como o cálculo a devolve.
   *
   * O ecrã mostra-a desde que o cálculo passou a produzi-la; o PDF -- que é o
   * que vai anexo ao processo e é assinado -- levava só o número global. Quem
   * o lê fica a saber QUANTO e não ONDE, e é o ONDE que se cobra ao
   * fornecedor.
   */
  porSecao?: Array<{ secao: string; score: number; perguntas?: number }>;
  /** Respostas, para o anexo. Sem elas o relatório é só a capa. */
  respostas?: Array<{
    pergunta: string;
    resposta: string | null;
    peso?: number | null;
    pontuacao?: number | null;
    temAnexo?: boolean;
  }>;
}

/** Rótulos vindos de fora: o PDF não conhece o dicionário. */
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

const MARGEM = 20;
const LARGURA_UTIL = 170;

/** Quebra o texto e devolve o novo `y`, criando página quando falta espaço. */
function escreverParagrafo(doc: jsPDF, texto: string, y: number, tamanho = 10): number {
  doc.setFontSize(tamanho);
  doc.setTextColor(60, 60, 60);
  const linhas = doc.splitTextToSize(texto, LARGURA_UTIL);
  for (const linha of linhas) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(linha, MARGEM, y);
    y += tamanho * 0.5;
  }
  return y + 2;
}

function escreverLista(doc: jsPDF, titulo: string, itens: string[] | undefined, y: number): number {
  if (!itens?.length) return y;
  if (y > 255) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(titulo, MARGEM, y);
  doc.setFont('helvetica', 'normal');
  y += 6;
  for (const item of itens) {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(9.5);
    doc.setTextColor(70, 70, 70);
    const linhas = doc.splitTextToSize(`•  ${item}`, LARGURA_UTIL - 4);
    for (const linha of linhas) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(linha, MARGEM + 2, y);
      y += 4.6;
    }
    y += 1.4;
  }
  return y + 3;
}

export async function gerarRelatorioFornecedor(
  dados: DadosDoRelatorio,
  r: RotulosDoRelatorio,
): Promise<void> {
  const doc = new jsPDF();
  const logo = await loadAkurisLogo();

  addAkurisCover(doc, logo, r.titulo, dados.fornecedorNome, {
    empresa: dados.empresaNome,
    data: formatDateOnly(new Date().toISOString()),
  });

  doc.addPage();
  let y = addAkurisHeader(doc, logo);
  y = addSectionTitle(doc, r.seccaoResumo, y + 4, MARGEM);

  // ── Score: número, e identificado como cálculo ──────────────────────────
  const score = dados.scoreFinal;
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  if (score !== null && score !== undefined) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(`${Number(score).toFixed(0)}%`, MARGEM, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(r.score, MARGEM + 26, y + 6);
    drawProgressBar(doc, MARGEM, y + 10, LARGURA_UTIL, 4, Number(score), AKURIS_COLORS.primary);
    y += 20;
  } else {
    y = escreverParagrafo(doc, r.semScore, y + 4);
  }

  // ── Por secção: onde dói, não só quanto ────────────────────────────────
  if (dados.porSecao && dados.porSecao.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(r.porSecao, MARGEM, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    // Da pior para a melhor: num relatório de risco, o que dói vem primeiro.
    for (const s of [...dados.porSecao].sort((a, b) => a.score - b.score)) {
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      doc.text(s.secao, MARGEM, y);
      doc.setTextColor(110, 110, 110);
      doc.text(`${Number(s.score).toFixed(0)}%`, MARGEM + LARGURA_UTIL - 12, y);
      drawProgressBar(doc, MARGEM, y + 1.5, LARGURA_UTIL - 16, 2.5, Number(s.score), AKURIS_COLORS.primary);
      y += 8;
    }
    y += 2;
  }

  const meta: string[] = [];
  if (dados.templateNome) meta.push(`${r.questionario}: ${dados.templateNome}`);
  if (dados.dataEnvio) meta.push(`${r.enviadoEm}: ${formatDateOnly(dados.dataEnvio)}`);
  if (dados.dataConclusao) meta.push(`${r.concluidoEm}: ${formatDateOnly(dados.dataConclusao)}`);
  if (meta.length) y = escreverParagrafo(doc, meta.join('   ·   '), y + 2, 9);

  // ── Parecer da IA, sempre rotulado como leitura ─────────────────────────
  y = addSectionTitle(doc, r.seccaoParecer, y + 6, MARGEM);

  if (!dados.parecer) {
    y = escreverParagrafo(doc, r.semParecer, y + 2);
  } else {
    const p = dados.parecer;
    const cabecalho = [
      p.nivelRisco ? `${r.nivelRisco}: ${p.nivelRisco}` : null,
      p.confianca ? `${r.confianca}: ${p.confianca}` : null,
      dados.parecerEm ? formatDateOnly(dados.parecerEm) : null,
    ].filter(Boolean).join('   ·   ');
    if (cabecalho) y = escreverParagrafo(doc, cabecalho, y + 2, 9);

    /*
      O aviso de que isto é leitura automática vai no CORPO, não em rodapé:
      um relatório é lido em diagonal, e a ressalva tem de estar onde a
      afirmação está.
    */
    y = escreverParagrafo(doc, r.avisoParecer, y, 8.5);
    if (p.resumo) y = escreverParagrafo(doc, p.resumo, y + 2);

    y = escreverLista(doc, r.pontosFortes, p.pontosFortes, y + 2);
    y = escreverLista(doc, r.pontosAtencao, p.pontosAtencao, y);
    y = escreverLista(doc, r.evidenciasEmFalta, p.evidenciasEmFalta, y);
    y = escreverLista(doc, r.recomendacoes, p.recomendacoes, y);
  }

  // ── Anexo: as respostas, para quem quiser conferir o número ─────────────
  if (dados.respostas?.length) {
    doc.addPage();
    y = addAkurisHeader(doc, logo);
    y = addSectionTitle(doc, r.seccaoRespostas, y + 4, MARGEM);

    for (const item of dados.respostas) {
      if (y > 255) { doc.addPage(); y = 20; }
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      for (const linha of doc.splitTextToSize(item.pergunta, LARGURA_UTIL)) {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(linha, MARGEM, y);
        y += 4.6;
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const detalhe = [
        item.resposta || '—',
        item.pontuacao !== null && item.pontuacao !== undefined ? `(${r.colNota}: ${item.pontuacao})` : null,
        item.temAnexo === false ? `— ${r.semAnexo}` : null,
      ].filter(Boolean).join('  ');
      for (const linha of doc.splitTextToSize(detalhe, LARGURA_UTIL - 4)) {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(linha, MARGEM + 2, y);
        y += 4.4;
      }
      y += 3;
    }
  }

  addAkurisFooter(doc);

  const nomeSeguro = dados.fornecedorNome.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
  doc.save(`avaliacao-${nomeSeguro || 'fornecedor'}.pdf`);
}
