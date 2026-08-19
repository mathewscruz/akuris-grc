/**
 * Nenhum formulário grava string vazia numa coluna `uuid`.
 *
 * Um <Select> por escolher guarda `""` no estado do formulário. Se esse `""`
 * seguir para uma coluna `uuid`, o Postgres recusa a linha inteira:
 *
 *   invalid input syntax for type uuid: ""
 *
 * O registo não fica meio gravado — não fica gravado de todo. E como o campo
 * costuma ser opcional, é exatamente quem NÃO preencheu o campo que apanha o
 * erro: o caminho mais comum do formulário é o que não funciona.
 *
 * Aconteceu no ROPA e ninguém deu por isso: os sete tratamentos importados não
 * tinham responsável nem encarregado, portanto guardar QUALQUER um deles falhava
 * sempre. O diálogo ficava aberto com um toast vermelho e o registo intacto.
 *
 * A regra: um campo de estado com o nome de uma coluna `uuid` do esquema tem de
 * ser normalizado a `null` antes de ir para `insert`/`update`, ou ser
 * obrigatório (validado antes de gravar). A lista de colunas é fixada aqui —
 * gerada de `information_schema` — para o teste não depender de um banco a
 * correr.
 */
import { describe, expect, it } from 'vitest';
import { fontes, ler } from './_fontes';

/** Colunas `uuid` anuláveis que aparecem como campo de formulário. */
const COLUNAS_UUID = [
  'aprovador_aceite',
  'area_sistema_id',
  'categoria_id',
  'coluna_id',
  'controlador_conjunto',
  'controle_vinculado_id',
  'dpo_id',
  'empresa_id',
  'encarregado_dados',
  'exercicio_id',
  'fornecedor_id',
  'framework_id',
  'framework_vinculado_id',
  'gestor_contrato',
  'matriz_id',
  'operador_dados',
  'permission_profile_id',
  'plano_id',
  'requisito_vinculado_id',
  'requirement_id',
  'responsavel_analise',
  'responsavel_deteccao',
  'responsavel_id',
  'responsavel_tratamento',
  'sprint_id',
  'template_id',
  'testador_id',
] as const;

const listaAlternada = COLUNAS_UUID.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

/** `campo: ""` ou `campo: algo || ""` — o estado inicial que guarda vazio. */
const INICIA_VAZIO = new RegExp(`^\\s*(${listaAlternada})\\s*:\\s*(?:[^,\\n]*?\\|\\|\\s*)?(['"])\\2\\s*,?\\s*$`);

const escreveNaBase = (texto: string) => /\.(insert|update|upsert)\s*\(/.test(texto);

/** O campo é normalizado a `null`, ou barrado antes de gravar. */
const protegido = (texto: string, campo: string) => {
  const c = campo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    // `campo: x || null`  /  `campo: x ? y : null`
    new RegExp(`${c}\\s*:\\s*[^,\\n]*\\|\\|\\s*null`).test(texto) ||
    new RegExp(`${c}\\s*:\\s*[^,:\\n]*\\?[^,\\n]*:\\s*null`).test(texto) ||
    // normalizador partilhado
    /vazioComoNulo|nuloSeVazio|emptyToNull/.test(texto) ||
    // obrigatório: barrado antes de chegar ao banco
    new RegExp(`!\\s*[A-Za-z_$][\\w$]*\\.${c}\\b`).test(texto) ||
    new RegExp(`${c}\\s*:\\s*z\\.string\\(\\)(?!\\s*\\.optional)`).test(texto)
  );
};

describe('coluna uuid nunca recebe string vazia', () => {
  it('todo campo uuid gravado é normalizado ou obrigatório', () => {
    const faltas: string[] = [];

    for (const ficheiro of fontes()) {
      const texto = ler(ficheiro);
      if (!escreveNaBase(texto)) continue;

      const campos = new Set<string>();
      for (const linha of texto.split('\n')) {
        const m = INICIA_VAZIO.exec(linha);
        if (m) campos.add(m[1]);
      }
      for (const campo of campos) {
        if (!protegido(texto, campo)) faltas.push(`${ficheiro}: ${campo}`);
      }
    }

    expect(faltas, `campos uuid que podem ir vazios para o banco:\n${faltas.join('\n')}`).toEqual(
      [],
    );
  });

  it('a própria regra reconhece as duas formas de proteger', () => {
    expect(protegido('responsavel_id: data.responsavel_id || null,', 'responsavel_id')).toBe(true);
    expect(protegido('if (!formData.template_id) return erro;', 'template_id')).toBe(true);
    expect(protegido('responsavel_id: data.responsavel_id,', 'responsavel_id')).toBe(false);
  });
});
