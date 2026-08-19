/**
 * O dossiê do ROPA não diz a mesma coisa duas vezes.
 *
 * A primeira versão desenhava a capa, o percurso do dado e as bases legais — e
 * depois repetia os mesmos treze campos nos capítulos. O mesmo parágrafo de
 * "Fonte dos dados" lia-se em Origem e outra vez em Dados; o mesmo "Alto" lia-se
 * na pílula de risco e no capítulo Risco. Um documento que se repete lê-se como
 * rascunho, e quem o exporta para um auditor leva a repetição junto.
 *
 * O teste fixa a regra: cada campo do esquema aparece em exactamente UMA
 * superfície. E fixa a outra metade — renomear um campo em `ropa-schema.ts` sem
 * actualizar o plano deixaria uma etapa do percurso a ler `undefined`, ou seja,
 * a mostrar "Por preencher" num registo completo. É a pior forma de errar:
 * parece um problema do cliente.
 */
import { describe, expect, it } from 'vitest';
import {
  CAMPOS_DAS_BASES_LEGAIS,
  CAMPOS_DA_CAPA,
  CAMPOS_DOS_SINAIS,
  CAMPOS_DO_PERCURSO,
  camposDoPlanoForaDoEsquema,
  camposDosCapitulos,
  camposJaMostrados,
} from '@/lib/ropa-dossie-plano';
import { camposDoPercursoExistem } from '@/lib/ropa-percurso';
import { ROPA_FIELDS } from '@/lib/ropa-schema';

describe('dossiê do ROPA', () => {
  it('só nomeia campos que existem no esquema', () => {
    expect(camposDoPercursoExistem()).toEqual([]);
    expect(camposDoPlanoForaDoEsquema()).toEqual([]);
  });

  it('não repete o mesmo campo em duas superfícies', () => {
    const acima = [...CAMPOS_DA_CAPA, ...CAMPOS_DOS_SINAIS, ...CAMPOS_DO_PERCURSO];
    expect(new Set(acima).size).toBe(acima.length);

    for (const temBases of [true, false]) {
      const mostrados = camposJaMostrados(temBases);
      const capitulos = camposDosCapitulos(temBases);
      const repetidos = capitulos.filter((k) => mostrados.has(k));
      expect(repetidos, `com bases=${temBases}`).toEqual([]);
    }
  });

  it('não perde nenhum campo pelo caminho', () => {
    for (const temBases of [true, false]) {
      const cobertos = new Set([...camposJaMostrados(temBases), ...camposDosCapitulos(temBases)]);
      const emFalta = ROPA_FIELDS.map((f) => f.key).filter((k) => !cobertos.has(k));
      expect(emFalta, `com bases=${temBases}`).toEqual([]);
    }
  });

  it('devolve a base legal aos capítulos quando não há bases normalizadas', () => {
    // Um registo importado sem base reconhecível não tem secção de bases
    // legais: se o campo bruto também saísse dos capítulos, a base legal do
    // tratamento não aparecia em lado nenhum.
    const semBases = camposDosCapitulos(false);
    for (const campo of CAMPOS_DAS_BASES_LEGAIS) {
      expect(semBases).toContain(campo);
      expect(camposDosCapitulos(true)).not.toContain(campo);
    }
  });
});
