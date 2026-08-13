import { describe, it, expect } from 'vitest';
import { buildDocGenDocxBlob, type DocGenDocument, type DocxLabels } from '../docgen-docx';
import { buildDocGenPdfBlob } from '../docgen-pdf';

const labels: DocxLabels = {
  summary: 'Sumário',
  section: 'Seção',
  versaoText: 'Versão 1.0',
  emissionDateText: 'Emissão: 2026-08-13',
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

const options = { empresaNome: 'Akuris Consultoria', labels };

const fullDoc: DocGenDocument = {
  titulo: 'Política de Segurança da Informação',
  versao: '1.0',
  data_criacao: '2026-08-13',
  metadados: { classificacao: 'Interno', responsavel_elaboracao: 'CISO' },
  secoes: [
    {
      nome: 'Objetivo',
      conteudo: '## Finalidade\nEstabelecer **diretrizes** de segurança.\n\n- Proteger dados\n- Garantir continuidade',
    },
    {
      nome: 'Papéis e Responsabilidades',
      conteudo: [
        'A matriz abaixo define as responsabilidades. [A.5.2]',
        '',
        '| Atividade | CISO | DPO | Gestor de TI |',
        '| --- | --- | --- | --- |',
        '| Aprovar a política | A | C | I |',
        '| Revisar anualmente | R | C | C |',
      ].join('\n'),
    },
    { nome: 'Vigência', conteudo: 'Vigente a partir de 2026-08-13, com revisão anual.' },
  ],
  glossario: [{ termo: 'RTO', definicao: 'Recovery Time Objective' }],
  historico_versoes: [{ versao: '1.0', data: '2026-08-13', autor: 'CISO', descricao: 'Emissão inicial' }],
  coverage_map: [
    { requirement_codigo: 'A.5.2', requirement_titulo: 'Papéis', section_indexes: [1], evidencia: 'Matriz RACI' },
  ],
};

const minimalDoc: DocGenDocument = {
  titulo: 'Documento Mínimo',
  secoes: [{ nome: 'Única', conteudo: '' }],
};

describe('docgen exportadores', () => {
  it('gera DOCX não vazio com o documento completo', async () => {
    const blob = await buildDocGenDocxBlob(fullDoc, options);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(2000);
  });

  it('gera PDF não vazio com o documento completo', async () => {
    const blob = await buildDocGenPdfBlob(fullDoc, options);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('não lança sem glossário, histórico, cobertura ou logo', async () => {
    await expect(buildDocGenDocxBlob(minimalDoc, options)).resolves.toBeInstanceOf(Blob);
    await expect(buildDocGenPdfBlob(minimalDoc, options)).resolves.toBeInstanceOf(Blob);
  });

  it('não lança com seções ausentes', async () => {
    const doc = { titulo: 'Sem seções' } as DocGenDocument;
    await expect(buildDocGenDocxBlob(doc, options)).resolves.toBeInstanceOf(Blob);
    await expect(buildDocGenPdfBlob(doc, options)).resolves.toBeInstanceOf(Blob);
  });

  it('ignora logo inválido em vez de falhar a exportação', async () => {
    const doc: DocGenDocument = {
      ...fullDoc,
      metadados: { ...fullDoc.metadados, logo_url: 'https://exemplo.invalido/logo.png' },
    };
    await expect(buildDocGenDocxBlob(doc, options)).resolves.toBeInstanceOf(Blob);
    await expect(buildDocGenPdfBlob(doc, options)).resolves.toBeInstanceOf(Blob);
  });
});
