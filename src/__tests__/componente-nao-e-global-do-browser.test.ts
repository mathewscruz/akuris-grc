/**
 * Nenhum componente renderizado é, na verdade, uma classe do navegador.
 *
 * `FrameworkOnboarding` escrevia `icon(Lock)` onde queria dizer `icon(IconLock)`.
 * `Lock` não é um erro de digitação qualquer: é a classe **Web Locks API**,
 * declarada em `lib.dom.d.ts`. Existe como valor global, portanto o TypeScript
 * compila sem uma queixa, o `npm run typecheck` passa, o build passa e as
 * quinze guardas do repositório passam. Só em execução é que o React tenta
 * instanciá-la e o navegador responde `TypeError: Illegal constructor`.
 *
 * O custo foi o PCI DSS — 288 requisitos, o maior framework do catálogo —
 * abrindo no "Algo deu errado" exactamente no único ecrã de orientação do
 * módulo. Uma empresa de pagamentos via a tela de erro antes de ver uma linha
 * do produto.
 *
 * Esta guarda olha para os nomes que o produto usa como componente e reprova os
 * que colidem com globais do DOM. É barata e apanha uma classe inteira que o
 * compilador, por construção, nunca vai apanhar.
 */
import { describe, expect, it } from 'vitest';
import { fontes, ler, linhas, semComentario } from './_fontes';

/**
 * Globais do navegador cujo nome parece um componente React.
 *
 * Todos começam por maiúscula, todos existem em `lib.dom.d.ts` e todos são
 * plausíveis como nome de ícone ou de componente num produto de GRC.
 */
const GLOBAIS_DO_DOM = [
  'Lock', 'Image', 'Option', 'Range', 'Comment', 'Selection',
  'Notification', 'Request', 'Headers', 'Report',
  'Attr', 'Screen', 'History', 'Location', 'Storage', 'Cache', 'Path2D', 'Audio',
];

/**
 * `<Lock ...>` no JSX, ou `Lock` passado onde se espera um componente.
 *
 * O `<` do JSX vem sempre depois de espaço, `(`, `{`, `>`, `=` ou `,`. Sem essa
 * âncora casaria `useState<File | null>` e `Promise<Blob>`, onde o `<` de um
 * genérico vem colado a uma letra e o nome é o tipo certo, não um componente.
 */
const usosComoComponente = (nome: string) => [
  new RegExp(`(^|[\\s({>=,])<${nome}[\\s/>]`),
  new RegExp(`\\bicon:\\s*${nome}\\b`),
  new RegExp(`\\bicon\\(\\s*${nome}\\s*\\)`),
  new RegExp(`\\bIcon\\s*=\\s*${nome}\\b`),
  new RegExp(`\\bcomponent:\\s*${nome}\\b`),
];

/*
  As expressões constroem-se UMA vez, não por ficheiro.

  A primeira versão montava 28 nomes × 5 padrões para cada um dos ~700 ficheiros
  — quase cem mil objectos RegExp. Passava sozinha em 2s e estourava os 5s do
  vitest quando corria com a suite toda. Uma guarda que só passa quando corre
  sozinha não é uma guarda.
*/
const PADROES = GLOBAIS_DO_DOM.map((nome) => ({
  nome,
  importado: new RegExp(`import[^;]*\\b${nome}\\b[^;]*from`, 's'),
  usos: usosComoComponente(nome),
}));

describe('componente não é global do navegador', () => {
  it('nenhum global do DOM é usado como componente', () => {
    const maus: string[] = [];

    for (const f of fontes()) {
      if (!/\.tsx?$/.test(f) || f.includes('__tests__')) continue;

      const fonte = ler(f);
      // Filtro barato: a esmagadora maioria dos ficheiros não menciona nenhum
      // destes nomes e sai daqui sem que se parta uma única linha.
      const candidatos = PADROES.filter((p) => fonte.includes(p.nome));
      if (candidatos.length === 0) continue;

      // Importar o nome significa que é um componente legítimo homónimo; o
      // defeito é exactamente o contrário — usar SEM importar.
      const ativos = candidatos.filter((p) => !p.importado.test(fonte));
      if (ativos.length === 0) continue;

      linhas(f).forEach((linha, i) => {
        const l = semComentario(linha);
        if (!l) return;
        for (const p of ativos) {
          if (l.includes(p.nome) && p.usos.some((re) => re.test(l))) {
            maus.push(`${f}:${i + 1} → ${p.nome} usado como componente sem ser importado: ${l.trim()}`);
          }
        }
      });
    }

    expect(
      maus,
      `estes nomes resolvem para globais do navegador e rebentam só em execução:\n${maus.join('\n')}`,
    ).toEqual([]);
  });

  it('a guarda enxerga o padrão que proíbe', () => {
    // A forma exacta que passou por typecheck, build e todas as outras guardas.
    const mau = "  if (lower.includes('pci')) return { key: 'pciDss', icon: icon(Lock) };";
    expect(usosComoComponente('Lock').some((p) => p.test(mau))).toBe(true);
    // E a forma correcta não dispara.
    const boa = "  if (lower.includes('pci')) return { key: 'pciDss', icon: icon(IconLock) };";
    expect(usosComoComponente('Lock').some((p) => p.test(boa))).toBe(false);
    // Nem a posição de tipo, que foi o falso positivo da primeira versão.
    expect(usosComoComponente('Image').some((p) => p.test('const [f, setF] = useState<Image | null>(null);'))).toBe(false);
  });
});
