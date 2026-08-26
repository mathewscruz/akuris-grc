/**
 * @vitest-environment node
 *
 * Ambiente `node` de propósito: o `Blob` do jsdom é um esqueleto — só tem
 * `size`, `type` e `slice`, sem `arrayBuffer()`, `text()` ou `stream()`.
 * Nesse ambiente o ficheiro produzido não se consegue ABRIR, e um teste que
 * só possa medir o tamanho deixa passar um DOCX que perdeu as tabelas.
 * O `Blob` do Node é real e deixa ler os bytes.
 */
/**
 * Os exportadores do DocGen, contra um documento REAL.
 *
 * Os testes que já existiam (`docgen-export.test.ts`) verificam que a
 * exportação não rebenta e que o ficheiro não sai vazio. É pouco: um DOCX de
 * 3 kB que perdeu as três tabelas passa nesses testes na mesma.
 *
 * Aqui usa-se a «Política de Controle de Acesso» tal como está gravada em
 * `docgen_generated_docs` — 9 secções, ~17 mil caracteres, três tabelas de
 * markdown, glossário, histórico de versões e uma matriz de cobertura com 19
 * entradas — e abre-se o ficheiro produzido para ver o que lá está.
 *
 * A fixture é o conteúdo real, sem o `logo_url` (que faria a exportação ir à
 * rede buscar uma imagem e tornaria o teste dependente dela).
 */
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import documentoReal from './fixtures/docgen-documento-real.json';
import { buildDocGenDocxBlob, type DocGenDocument, type DocxLabels } from '../docgen-docx';
import { buildDocGenPdfBlob } from '../docgen-pdf';

const labels: DocxLabels = {
  summary: 'Sumário',
  section: 'Seção',
  versaoText: 'Versão 1.0',
  emissionDateText: 'Emissão: 2026-08-17',
  classificationText: 'Classificação: Interno',
  footerPage: 'Página',
  of: 'de',
  glossary: 'Glossário',
  glossaryTerm: 'Termo',
  glossaryDefinition: 'Definição',
  versionHistory: 'Histórico de Versões',
  versionCol: 'Versão',
  dateCol: 'Data',
  authorCol: 'Autor',
  descriptionCol: 'Descrição',
  coverage: 'Matriz de Cobertura',
  requirementCol: 'Requisito',
  sectionsCol: 'Seções',
  evidenceCol: 'Evidência',
};

const doc = documentoReal as unknown as DocGenDocument;
const options = { empresaNome: 'Nexure', labels };

/**
 * Bytes do Blob.
 *
 * Só funciona no ambiente `node` — ver o cabeçalho do ficheiro.
 */
async function bytesDoBlob(blob: Blob): Promise<ArrayBuffer> {
  return await blob.arrayBuffer();
}

/** O XML do corpo do DOCX, que é um ZIP. */
async function corpoDoDocx(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await bytesDoBlob(blob));
  const xml = await zip.file('word/document.xml')?.async('string');
  return xml ?? '';
}

/** Texto visível do DOCX: o que está dentro dos `<w:t>`. */
function textoDoXml(xml: string): string {
  return (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
    .map((t) => t.replace(/<[^>]+>/g, ''))
    .join(' ');
}

describe('exportação do DocGen com documento real', () => {
  it('a fixture é mesmo o documento real, com as suas nove secções e três tabelas', () => {
    expect(doc.secoes?.length).toBe(9);
    const comTabela = (doc.secoes ?? []).filter(
      (s) => typeof s.conteudo === 'string' && s.conteudo.includes('|') && s.conteudo.includes('---'),
    );
    expect(comTabela.length, 'o documento real traz três tabelas de markdown').toBe(3);
  });

  describe('DOCX', () => {
    it('leva TODAS as secções, e não só as primeiras', async () => {
      const texto = textoDoXml(await corpoDoDocx(await buildDocGenDocxBlob(doc, options)));
      for (const s of doc.secoes ?? []) {
        expect(texto, `secção ausente: ${s.nome}`).toContain(s.nome);
      }
    });

    it('converte as tabelas de markdown em tabelas de Word, não em texto com barras', async () => {
      const xml = await corpoDoDocx(await buildDocGenDocxBlob(doc, options));
      // Três do documento + histórico de versões + glossário + cobertura.
      const tabelas = (xml.match(/<w:tbl>/g) ?? []).length;
      expect(tabelas, 'as tabelas de markdown têm de virar <w:tbl>').toBeGreaterThanOrEqual(3);
      // E o texto não pode continuar a mostrar a sintaxe de markdown.
      expect(textoDoXml(xml)).not.toMatch(/\|\s*-{3,}\s*\|/);
    });

    it('tem cabeçalho e rodapé', async () => {
      const zip = await JSZip.loadAsync(await bytesDoBlob(await buildDocGenDocxBlob(doc, options)));
      const nomes = Object.keys(zip.files);
      expect(nomes.some((n) => /header\d*\.xml$/.test(n)), 'sem cabeçalho').toBe(true);
      expect(nomes.some((n) => /footer\d*\.xml$/.test(n)), 'sem rodapé').toBe(true);
    });

    it('preserva acentos e cedilha — «Definições», «Disposições»', async () => {
      const texto = textoDoXml(await corpoDoDocx(await buildDocGenDocxBlob(doc, options)));
      expect(texto).toContain('Definições');
      expect(texto).toContain('Disposições Finais');
      expect(texto).not.toContain('Defini??es');
    });

    it('leva o glossário, o histórico de versões e a matriz de cobertura', async () => {
      const texto = textoDoXml(await corpoDoDocx(await buildDocGenDocxBlob(doc, options)));
      expect(texto).toContain(labels.glossary);
      expect(texto).toContain(labels.versionHistory);
      expect(texto).toContain(labels.coverage);
      // Um termo real do glossário e um código real da cobertura.
      expect(texto).toContain(doc.glossario?.[0]?.termo ?? '—');
      expect(texto).toContain(doc.coverage_map?.[0]?.requirement_codigo ?? '—');
    });

    it('não deixa marcas de markdown por converter no texto', async () => {
      const texto = textoDoXml(await corpoDoDocx(await buildDocGenDocxBlob(doc, options)));
      expect(texto, 'negrito de markdown por converter').not.toMatch(/\*\*\S/);
      expect(texto, 'cabeçalho de markdown por converter').not.toMatch(/(^|\s)#{1,6}\s/);
    });
  });

  describe('PDF', () => {
    it('sai com tamanho compatível com um documento de 17 mil caracteres', async () => {
      const blob = await buildDocGenPdfBlob(doc, options);
      expect(blob.type).toContain('pdf');
      // Um PDF que perdesse o corpo teria poucos kB.
      expect(blob.size).toBeGreaterThan(20_000);
    });

    it('pagina: um documento deste tamanho não cabe numa página só', async () => {
      const bytes = new Uint8Array(await bytesDoBlob(await buildDocGenPdfBlob(doc, options)));
      const cru = new TextDecoder('latin1').decode(bytes);
      const paginas = (cru.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      expect(paginas, 'o PDF tem de ter várias páginas').toBeGreaterThan(3);
    });
  });
});
