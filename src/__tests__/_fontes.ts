import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Listagem e leitura das fontes, feitas uma vez por processo.
 *
 * Os testes de guarda leem a base inteira à procura de padrões. Feito à
 * bruta, cada um deles lança o seu `git ls-files` e relê os mesmos ~500
 * arquivos várias vezes — e isso mediu-se: ao acrescentar seis testes destes,
 * o teste de exportação de PDF passou a estourar o limite de 5s por falta de
 * CPU, sem ter mudado uma linha. Um teste lento não é só lento: faz falhar
 * os do lado.
 *
 * O índice do git ainda lista arquivos apagados e por confirmar, daí o
 * `existsSync` — sem ele o teste rebenta com ENOENT em vez de acusar a regra.
 */

let cacheLista: string[] | null = null;
const cacheConteudo = new Map<string, string>();

/**
 * Todas as fontes de `src` — versionadas E por versionar.
 *
 * O `-o --exclude-standard` não é detalhe: sem ele o `git ls-files` devolve só
 * o que já está no índice, e **todo o código novo escapa às guardas**. Foi o
 * que aconteceu: ficheiros criados durante a revisão (as próprias guardas
 * incluídas) ficaram fora de todas elas, e um componente novo do Gap Analysis
 * passou meses com `toLocaleDateString('pt-BR')` sem ninguém acusar — porque a
 * guarda que proíbe exatamente isso não o estava sequer a ler.
 *
 * Uma guarda que não vê o código novo é pior do que não ter guarda: dá a
 * sensação de estar coberto.
 */
export function fontes(): string[] {
  if (cacheLista) return cacheLista;
  const versionadas = execSync('git ls-files "src/*.ts" "src/*.tsx"', { encoding: 'utf8' });
  const novas = execSync('git ls-files -o --exclude-standard "src/*.ts" "src/*.tsx"', {
    encoding: 'utf8',
  });
  cacheLista = [...new Set(`${versionadas}\n${novas}`.split('\n'))]
    .filter(Boolean)
    // As próprias guardas ficam de fora: cada uma cita, como texto, o padrão
    // que proíbe — é assim que provam que mordem. Ao passarem a ver ficheiros
    // por versionar, começaram a acusar-se umas às outras.
    .filter((f) => !f.includes('__tests__'))
    .filter((f) => existsSync(f));
  return cacheLista;
}

/**
 * Superfícies públicas com identidade própria, fora do tema da aplicação.
 * Ficam de fora das regras visuais de propósito, decidido no início da
 * varredura — não são páginas do produto autenticado.
 */
export const FORA_DO_TEMA = ['pages/Assessment.tsx', 'MFAVerification'];

/**
 * TODAS as fontes de `src` — `.ts` incluídos, sem excepções de tema.
 *
 * `fontesTsx()` faz duas exclusões que são certas para as regras VISUAIS e
 * erradas para as de CORRECÇÃO: deixa de fora os `.ts` e as superfícies com
 * identidade própria. Medido ao descobri-lo: dezasseis leituras cruas de
 * coluna `date` viviam exactamente nesse ponto cego — doze delas em
 * `generateTemplatePDF.ts`, que é o relatório que se imprime e se manda ao
 * auditor, e uma no caminho de ESCRITA de `controle-testes.ts`.
 *
 * A guarda do fuso dizia «daqui para a frente é regressão». Estava a ler
 * pouco mais de metade do repositório.
 *
 * Regra: guarda de aparência usa `fontesTsx()`; guarda de correcção usa esta.
 */
export function fontesTodas(): string[] {
  return fontes();
}

/** Só os `.tsx`, e só os que seguem o tema da aplicação. */
export function fontesTsx(): string[] {
  return fontes()
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => !FORA_DO_TEMA.some((x) => f.includes(x)));
}

/** Conteúdo do arquivo, lido do disco no máximo uma vez. */
export function ler(f: string): string {
  const emCache = cacheConteudo.get(f);
  if (emCache !== undefined) return emCache;
  const texto = readFileSync(f, 'utf8');
  cacheConteudo.set(f, texto);
  return texto;
}

/** Linhas do arquivo, a partir do conteúdo em cache. */
export function linhas(f: string): string[] {
  return ler(f).split('\n');
}

/** `arquivo:linha` de cada arquivo onde o padrão aparece pela primeira vez. */
/**
 * Uma linha de comentário não é código.
 *
 * As guardas visuais procuram classes proibidas linha a linha, e acusavam
 * também quem as MENCIONA — explicar num comentário porque não se usa
 * `rounded-xl` fazia a guarda apontar o comentário. O aviso deixava de
 * distinguir a infração da nota sobre a infração, que é a maneira mais rápida
 * de uma guarda perder a confiança de quem a lê.
 *
 * Corta `//`, `/* … *\/` de uma linha e as linhas de bloco que começam por
 * `*`. Um bloco multi-linha aberto continua a ser lido — é raro e o custo de
 * o seguir não compensa.
 */
export const semComentario = (linha: string): string => {
  const t = linha.trim();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
  return linha.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '');
};

export function ocorrencias(lista: string[], re: RegExp): string[] {
  const achados: string[] = [];
  for (const f of lista) {
    const i = linhas(f).findIndex((l) => re.test(semComentario(l)));
    if (i >= 0) achados.push(`${f}:${i + 1}`);
  }
  return achados;
}

/**
 * A tag JSX inteira — e nenhuma regex serve para isto.
 *
 * Dentro de uma tag há `>` em dois sítios que não a fecham: a seta de
 * `onChange={(e) => …}` e as chavetas aninhadas de `set({ ...s, x: 1 })`. Uma
 * regex fecha a tag no primeiro `>` que vê, e isso já custou duas vezes:
 * partiu dezasseis ficheiros ao inserir `min="0"` no meio de uma seta, e fez
 * uma guarda dar falso positivo por não chegar ao `placeholder` que vinha
 * depois do `onChange`.
 *
 * Este varrimento conta chavetas e aspas: a tag só fecha no `>` que está fora
 * de ambas.
 */
export function tagsJsx(
  fonte: string,
  nome: string,
): Array<{ texto: string; posicao: number }> {
  const achados: Array<{ texto: string; posicao: number }> = [];
  const abertura = `<${nome}`;
  let i = 0;
  while ((i = fonte.indexOf(abertura, i)) !== -1) {
    // `<Input` não pode casar com `<InputOTP`.
    const seguinte = fonte[i + abertura.length];
    if (seguinte && /[A-Za-z0-9]/.test(seguinte)) {
      i += abertura.length;
      continue;
    }
    let j = i + abertura.length;
    let chavetas = 0;
    let aspas: string | null = null;
    while (j < fonte.length) {
      const c = fonte[j];
      if (aspas) {
        if (c === aspas) aspas = null;
      } else if (c === '"' || c === "'" || c === '`') {
        aspas = c;
      } else if (c === '{') {
        chavetas += 1;
      } else if (c === '}') {
        chavetas -= 1;
      } else if (c === '>' && chavetas === 0) {
        break;
      }
      j += 1;
    }
    achados.push({ texto: fonte.slice(i, j + 1), posicao: i });
    i = j + 1;
  }
  return achados;
}
