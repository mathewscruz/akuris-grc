import { describe, it, expect } from 'vitest';
import { estruturarDocumento, sumarioDe } from '../estrutura-documento';

const txt = `OBJETIVO

Esta Política estabelece os princípios.

DOCUMENTOS AUXILIARES

Lei nº 9.610/1998 (Lei de Direitos Autorais): Protege os conteúdos.
PO 0021: Política de Segurança da Informação.

1.1 Responsabilidades

Acervo Acadêmico Digital: Conjunto de documentos acadêmicos de guarda permanente.
- primeiro item
- segundo item`;

describe('estruturarDocumento', () => {
  const b = estruturarDocumento(txt);
  it('linha em maiúsculas vira título capitalizado', () => expect(b[0]).toMatchObject({ tipo: 'titulo', nivel: 1, texto: 'Objetivo' }));
  it('parágrafo comum', () => expect(b[1]).toMatchObject({ tipo: 'paragrafo' }));
  it('referências normativas viram lista', () => expect(b[3]).toMatchObject({ tipo: 'lista', itens: [expect.stringContaining('Lei nº'), expect.stringContaining('PO 0021')] }));
  it('numeração com ponto é subtítulo', () => expect(b[4]).toMatchObject({ tipo: 'titulo', nivel: 2, texto: '1.1 Responsabilidades' }));
  it('termo: definição', () => expect(b[5]).toMatchObject({ tipo: 'definicao', termo: 'Acervo Acadêmico Digital' }));
  it('marcadores viram lista sem o marcador', () => expect(b[6]).toEqual({ tipo: 'lista', itens: ['primeiro item', 'segundo item'] }));
  it('sumário com os títulos', () => expect(sumarioDe(b).map((t) => t.texto)).toEqual(['Objetivo', 'Documentos Auxiliares', '1.1 Responsabilidades']));
});
