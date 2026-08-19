/**
 * Um filtro no ecrã tem de filtrar, e tem de nascer preenchido.
 *
 * O `DataTable` apenas DESENHA o que recebe em `filters` e `searchValue` — quem
 * filtra é a página. Em Privacidade, as três abas mostravam seis filtros e três
 * campos de busca e nenhum tocava nos dados: a página passava a lista crua.
 * Escolher "Saúde" no filtro de categoria deixava as quatro linhas na tabela.
 *
 * E os seis nasciam em `"todos"` sem que nenhuma opção tivesse esse valor, por
 * isso o `Select` ficava sem correspondência e o campo aparecia VAZIO — foi
 * assim que o defeito se deu a ver. Pior: depois de escolher um valor não havia
 * caminho de volta para "todas".
 *
 * As duas verificações abaixo apanharam exatamente esses casos na versão
 * anterior do ficheiro (8 e 6 ocorrências) e nenhuma no resto do produto.
 */
import { describe, expect, it } from 'vitest';
import { fontes, ler } from './_fontes';

/** Estado de filtro ou de busca, pelo nome. */
const ESTADO_DE_FILTRO =
  /const \[(\w*(?:[Ff]ilter|Filtro|SearchTerm|Term|Busca))\s*,\s*set\w+\]\s*=\s*useState/g;

/** Estado que nasce em "todos"/"todas"/"all" — o valor de "sem filtro". */
const ESTADO_INICIAL_TODOS =
  /const \[(\w+)\s*,\s*set\w+\]\s*=\s*useState[^(]*\(\s*["'](todos|todas|all)["']\s*\)/g;

/** Delimita o objeto literal que contém a posição dada, contando chavetas. */
function objetoEmVolta(texto: string, pos: number): string | null {
  let prof = 0;
  let ini = -1;
  for (let j = pos; j >= 0; j--) {
    const c = texto[j];
    if (c === '}') prof++;
    else if (c === '{') {
      if (prof === 0) {
        ini = j;
        break;
      }
      prof--;
    }
  }
  if (ini < 0) return null;
  prof = 0;
  for (let j = ini; j < texto.length; j++) {
    const c = texto[j];
    if (c === '{') prof++;
    else if (c === '}') {
      prof--;
      if (prof === 0) return texto.slice(ini, j + 1);
    }
  }
  return null;
}

/** Linhas em que o estado é usado para algo que não seja declarar ou passar. */
function usosReais(texto: string, nome: string): string[] {
  const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cita = new RegExp(`\\b${escapado}\\b`);
  const declara = new RegExp(`const \\[\\s*${escapado}\\s*,`);
  // `value: X` dentro de um objeto — com ou sem mais campos a seguir na mesma
  // linha. A primeira versão exigia fim de linha e não via o objeto escrito
  // numa linha só; foi a auto-verificação que o apanhou.
  const passaValor = new RegExp(`value:\\s*${escapado}\\s*[,}]?\\s*(?:$|\\w+:)`);
  const passaBusca = new RegExp(`searchValue=\\{${escapado}\\}`);

  return texto.split('\n').filter((linha) => {
    const t = linha.trimStart();
    if (t.startsWith('//') || t.startsWith('*')) return false;
    if (!cita.test(linha)) return false;
    return !declara.test(linha) && !passaValor.test(linha) && !passaBusca.test(linha);
  });
}

describe('filtro que filtra', () => {
  it('nenhum filtro ou busca é desenhado sem nunca ser aplicado', () => {
    const infratores: string[] = [];

    for (const arquivo of fontes()) {
      if (!arquivo.endsWith('.tsx')) continue;
      const texto = ler(arquivo);
      if (!texto.includes('<DataTable') && !texto.includes('filters=')) continue;

      for (const m of texto.matchAll(ESTADO_DE_FILTRO)) {
        if (usosReais(texto, m[1]).length === 0) {
          infratores.push(`${arquivo} → ${m[1]}`);
        }
      }
    }

    expect(
      infratores,
      'O DataTable só desenha os filtros. A página tem de aplicar o estado aos dados.',
    ).toEqual([]);
  });

  it('todo filtro que nasce em "todos" tem essa opção na lista', () => {
    const infratores: string[] = [];

    for (const arquivo of fontes()) {
      if (!arquivo.endsWith('.tsx')) continue;
      const texto = ler(arquivo);

      const iniciais = new Map<string, string>();
      for (const m of texto.matchAll(ESTADO_INICIAL_TODOS)) iniciais.set(m[1], m[2]);
      if (iniciais.size === 0) continue;

      for (const m of texto.matchAll(/value:\s*(\w+)\s*,/g)) {
        const esperado = iniciais.get(m[1]);
        if (!esperado) continue;
        const obj = objetoEmVolta(texto, m.index!);
        if (!obj || !obj.includes('options')) continue;
        if (!new RegExp(`value:\\s*['"]${esperado}['"]`).test(obj)) {
          infratores.push(`${arquivo} → ${m[1]} nasce '${esperado}' e a lista não o tem`);
        }
      }
    }

    expect(
      infratores,
      'Sem a opção do valor inicial o campo aparece vazio e não há como voltar a "todas".',
    ).toEqual([]);
  });

  it('as guardas enxergam os padrões que proíbem', () => {
    // Filtro desenhado e nunca aplicado.
    const decorativo = [
      '  const [categoriaFilter, setCategoriaFilter] = useState("todos");',
      '  const filtros = [{ options: [], value: categoriaFilter, onChange: setCategoriaFilter }];',
      '  <DataTable data={dados} filters={filtros} />',
    ].join('\n');
    expect(usosReais(decorativo, 'categoriaFilter')).toEqual([]);

    // O mesmo, mas aplicado: passa a ter uso real.
    const aplicado = `${decorativo}\n  const vis = dados.filter((d) => d.cat === categoriaFilter);`;
    expect(usosReais(aplicado, 'categoriaFilter').length).toBe(1);

    // Lista sem a opção do valor inicial.
    const semTodos = "{ options: [{ value: 'saude', label: 'Saúde' }], value: catFilter, }";
    expect(/value:\s*['"]todos['"]/.test(semTodos)).toBe(false);
    const comTodos = "{ options: [{ value: 'todos', label: 'Todas' }], value: catFilter, }";
    expect(/value:\s*['"]todos['"]/.test(comTodos)).toBe(true);

    // E o delimitador de objeto apanha o objeto certo, não o vizinho.
    const dois = "[{ options: [{ value: 'todos' }], value: a, }, { options: [], value: b, }]";
    const posB = dois.indexOf('value: b');
    expect(objetoEmVolta(dois, posB)).not.toContain("'todos'");
  });
});
