import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCGEN_DIALOG_DESCRIPTION } from '@/components/documentos/docgen-copy';

const DOCGEN_DIALOG_SOURCE = resolve(
  process.cwd(),
  'src/components/documentos/DocGenDialog.tsx'
);

describe('DocGen — descrição acessível do diálogo (AKURIS QA-002)', () => {
  it('define um texto de descrição específico e significativo', () => {
    expect(DOCGEN_DIALOG_DESCRIPTION.length).toBeGreaterThan(40);
    // Não pode ser um texto genérico: precisa descrever a finalidade do diálogo
    expect(DOCGEN_DIALOG_DESCRIPTION).toMatch(/document/i);
    expect(DOCGEN_DIALOG_DESCRIPTION).toMatch(/IA|inteligência artificial/i);
  });

  it('o DocGenDialog passa essa descrição para o DialogShell', () => {
    const source = readFileSync(DOCGEN_DIALOG_SOURCE, 'utf8');

    expect(source).toMatch(/DOCGEN_DIALOG_DESCRIPTION/);
    expect(source).toMatch(/description=\{DOCGEN_DIALOG_DESCRIPTION\}/);
  });
});
