/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDocument, type PDFDocumentProxy, type PDFDocumentLoadingTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { buildDocGenPdfBlob } from '../docgen-pdf';
import type { DocGenDocument, DocxLabels } from '../docgen-docx';

const labels: DocxLabels = {
  summary: 'Sumário', section: 'Seção', versaoText: 'Versão 1.0',
  emissionDateText: 'Emissão: 11/09/2026', classificationText: 'Classificação: Interna',
  footerPage: 'Página', of: 'de', glossary: 'Glossário', glossaryTerm: 'Termo',
  glossaryDefinition: 'Definição', versionHistory: 'Histórico de versões', versionCol: 'Versão',
  dateCol: 'Data', authorCol: 'Autor', descriptionCol: 'Descrição', coverage: 'Matriz de cobertura',
  requirementCol: 'Requisito', sectionsCol: 'Seções', evidenceCol: 'Evidência',
};
const opened: PDFDocumentLoadingTask[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(opened.splice(0).map(pdf => pdf.destroy()));
});
async function exportPdf(doc: DocGenDocument, company = 'Empresa de teste') {
  const blob = await buildDocGenPdfBlob(doc, { empresaNome: company, labels });
  const task = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true,
  });
  opened.push(task);
  return task.promise;
}
async function itemsOn(pdf: PDFDocumentProxy, page: number) {
  return (await (await pdf.getPage(page)).getTextContent()).items.filter((item): item is TextItem => 'str' in item);
}
async function allText(pdf: PDFDocumentProxy) {
  return (await Promise.all(Array.from({ length: pdf.numPages }, async (_, i) =>
    (await itemsOn(pdf, i + 1)).map(item => item.str).join(' ')))).join(' ');
}
async function expectWithinPage(pdf: PDFDocumentProxy) {
  for (let page = 1; page <= pdf.numPages; page++) {
    const viewport = (await pdf.getPage(page)).getViewport({ scale: 1 });
    for (const item of await itemsOn(pdf, page)) {
      if (!item.str.trim()) continue;
      expect(item.transform[4], `p${page}: ${item.str}`).toBeGreaterThanOrEqual(50);
      expect(item.transform[4] + item.width, `p${page}: ${item.str}`).toBeLessThanOrEqual(viewport.width - 49);
      expect(item.transform[5]).toBeGreaterThanOrEqual(25);
      expect(item.transform[5] + item.height).toBeLessThanOrEqual(viewport.height - 25);
    }
  }
}

describe('DocGen PDF: layout e navegação do arquivo real', () => {
  it('aproveita a página e elimina somente o subtítulo inicial redundante', async () => {
    const pdf = await exportPdf({ titulo: 'Política', secoes: Array.from({ length: 12 }, (_, i) => ({
      nome: `Tema ${i + 1}`, conteudo: `## ${i + 1}. Tema ${i + 1}\n\nConteúdo completo da seção ${i + 1}.`,
    })) });
    expect(pdf.numPages).toBeLessThanOrEqual(5); // Antigo: pelo menos 14 páginas.
    expect(await allText(pdf)).not.toMatch(/1\.1 1\. Tema/);
    expect((await pdf.getOutline())?.length).toBe(12);
    await expectWithinPage(pdf);
  });

  it('preserva título extenso e tokens longos sem ultrapassar as margens', async () => {
    const title = 'Quero uma Política de Privacidade pública em conformidade com a LGPD, descrevendo dados coletados, finalidades, bases legais (art. 7º), compartilhamento, retenção, direitos do titular (art. 18) e canais de atendimento ao DPO.';
    const token = 'https://empresa.example/' + 'identificador'.repeat(25);
    const pdf = await exportPdf({ titulo: title, metadados: { classificacao: 'Informações internas '.repeat(15) },
      secoes: [{ nome: 'Referências', conteudo: `${token}\n\nÊnfase em **proteção** e *privacidade*. Ação, órgão, retenção.` }],
    }, 'Empresa com uma razão social extensa '.repeat(6));
    expect((await pdf.getMetadata()).info).toMatchObject({ Title: title, Creator: 'Akuris DocGen' });
    const text = await allText(pdf);
    expect(text.replace(/\s/g, '')).toContain(token);
    expect(text).toContain('Ação, órgão, retenção.');
    await expectWithinPage(pdf);
  });

  it('mantém os números e destinos corretos em todas as páginas do sumário', async () => {
    const sections = Array.from({ length: 48 }, (_, i) => ({
      nome: `Tema de verificação ${i + 1} com um título extenso para validar o sumário navegável`,
      conteudo: `Registro de teste ${i + 1}.`,
    }));
    const pdf = await exportPdf({ titulo: 'Sumário multipágina', secoes: sections });
    let links = 0;
    let tocPages = 0;
    for (let p = 2; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const annotations = (await page.getAnnotations()).filter(annotation => annotation.subtype === 'Link');
      if (!annotations.length) continue;
      tocPages += 1;
      const items = await itemsOn(pdf, p);
      for (const annotation of annotations) {
        const destinationPage = await pdf.getPageIndex(annotation.dest[0]) + 1;
        const targetText = (await itemsOn(pdf, destinationPage)).map(item => item.str).join(' ');
        expect(targetText).toContain(`${links + 1}. Tema de verificação`);
        const pageLabel = items.find(item => item.str === String(destinationPage)
          && item.transform[4] > 520 && item.transform[5] >= annotation.rect[1] && item.transform[5] <= annotation.rect[3]);
        expect(pageLabel, `sumário p${p}, entrada ${links + 1}`).toBeDefined();
        links += 1;
      }
    }
    expect(links).toBe(48);
    expect(tocPages).toBeGreaterThan(1);
    await expectWithinPage(pdf);
  });

  it('repete o cabeçalho da tabela, preserva linhas e não corta evidências longas', async () => {
    const evidence = 'Esta evidência deve ser preservada na íntegra. '.repeat(15) + 'FINAL-DA-EVIDENCIA';
    const rows = Array.from({ length: 90 }, (_, i) => `| REG-${i} | Conteúdo da linha ${i} e sua descrição. |`).join('\n');
    const pdf = await exportPdf({ titulo: 'Tabelas extensas', secoes: [{ nome: 'Registros',
      conteudo: '| Identificador | Descrição |\n| --- | --- |\n' + rows }],
      coverage_map: [{ requirement_codigo: 'A.5.1', section_indexes: [0], evidencia: evidence }],
    });
    expect(await allText(pdf)).toContain('FINAL-DA-EVIDENCIA');
    for (let p = 3; p <= pdf.numPages; p++) {
      const items = await itemsOn(pdf, p);
      if (items.some(item => item.str.includes('REG-'))) {
        expect(items.some(item => item.str === 'Identificador')).toBe(true);
      }
      // Table text stays inside reserved body margins on every continuation page.
      for (const item of items.filter(item => item.str.includes('REG-') || item.str.includes('Conteúdo da linha'))) {
        expect(item.transform[5]).toBeGreaterThan(64);
        expect(item.transform[5] + item.height).toBeLessThan(841.9 - 65);
      }
    }
    const text = await allText(pdf);
    for (let i = 0; i < 90; i++) expect(text).toContain(`REG-${i}`);
    await expectWithinPage(pdf);
  });

  it('usa recuo suspenso em listas e preserva a numeração já escrita nos títulos', async () => {
    const pdf = await exportPdf({ titulo: 'Listas', secoes: [{ nome: '1. Procedimentos', conteudo:
      '## 1. Procedimentos\n\n### 1.1 Revisão\n\n- ' + 'Uma orientação longa para revisão de documentos. '.repeat(8),
    }] });
    const items = await itemsOn(pdf, 3);
    expect(items.some(item => item.str === '1. Procedimentos')).toBe(true);
    expect(items.some(item => item.str === '1.1 Revisão')).toBe(true);
    const textLines = items.filter(item => item.str.includes('orientação') || item.str.includes('documentos.'));
    expect(textLines.length).toBeGreaterThan(2);
    for (const item of textLines) expect(item.transform[4]).toBeCloseTo(70, 1);
    await expectWithinPage(pdf);
  });

  it('não perde colunas extras em tabelas com cabeçalho incompleto', async () => {
    const pdf = await exportPdf({ titulo: 'Colunas', secoes: [{ nome: 'Dados', conteudo:
      '| A | B |\n| --- | --- |\n| Um | Dois | TERCEIRA-COLUNA |' }] });
    expect(await allText(pdf)).toContain('TERCEIRA-COLUNA');
  });

  it('tolera resposta de logo corrompida e dimensões inválidas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not an image')));
    const pdf = await exportPdf({ titulo: 'Sem logo válido', metadados: { logo_url: 'https://empresa.example/logo.png', logo_altura: 'NaN' },
      secoes: [{ nome: 'Escopo', conteudo: 'Conteúdo preservado.' }],
    });
    expect(await allText(pdf)).toContain('Conteúdo preservado.');
  });

  it('preserva uma evidência maior que uma página, inclusive a última linha', async () => {
    const pdf = await exportPdf({ titulo: 'Evidência extensa', coverage_map: [{
      requirement_codigo: 'REQ-EXTENSO',
      evidencia: 'Registro de validação e informação preservada. '.repeat(260) + 'ULTIMA-LINHA-INTEGRA',
    }] });
    expect(pdf.numPages).toBeGreaterThan(4);
    expect(await allText(pdf)).toContain('ULTIMA-LINHA-INTEGRA');
    await expectWithinPage(pdf);
  });
});
