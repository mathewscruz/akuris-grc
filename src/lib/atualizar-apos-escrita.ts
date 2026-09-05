/**
 * O ecrã volta a ler a base depois de alguém lhe escrever.
 *
 * O sintoma era este: gravar e não ver. Criar um plano, mudar um estado,
 * apagar uma linha — e a lista atrás continuar igual até se sair da página e
 * voltar. Medido a 01/09/2026: de 172 ficheiros que escrevem na base, **114
 * não invalidam nem remandam ler nada**. Não é um esquecimento, é o que
 * acontece quando cada componente tem de se lembrar sozinho.
 *
 * Corrigir 114 ficheiros deixaria o 115.º na mesma. Já há neste produto uma
 * regra global escrita pela mesma razão — ver `stats-invalidation.ts`, que
 * diz por palavras dela: «em vez de repetir a invalidação em cada módulo (o
 * que volta sempre a ser esquecido por componentes novos), ligamos aqui uma
 * regra global». Esta é a irmã mais velha dessa.
 *
 * O sítio onde TODAS as escritas passam é o `fetch`. Um `POST`, `PATCH`,
 * `PUT` ou `DELETE` para `/rest/v1/<tabela>` que devolva sucesso é, sem
 * excepção, alguém a mudar dados — e a partir daí o que está no ecrã pode
 * estar errado. Marcamos tudo para reler; o React Query só vai à rede pelo
 * que está montado.
 *
 * Fica de fora, de propósito:
 *
 *  · **`/rest/v1/rpc/…`** — há funções que só LEEM e são chamadas por `POST`.
 *    Mandar reler por causa delas punha a consulta a chamar-se a si própria
 *    para sempre. Quem escreve por RPC continua a invalidar à mão.
 *  · **`/auth/v1/…`** — renovar a sessão não muda dados nenhuns, e acontece
 *    sozinho de tempos a tempos.
 *  · **`/storage/v1/…`** — um ficheiro que sobe vem quase sempre seguido da
 *    linha que o aponta, e é essa que conta.
 *
 * O `fetch` é trocado no momento em que este módulo é lido, e por isso ele é
 * a PRIMEIRA importação do `main.tsx`: o `supabase-js` guarda o `fetch` que
 * encontrar quando o cliente nasce, e trocá-lo depois não intercepta nada.
 * Está medido — foi assim que uma tentativa anterior falhou em silêncio.
 */

import { AI_FEATURES } from './ai-usage-catalog';

/** Quem quer saber. Fica pendurado até o `App` ligar o React Query. */
let avisar: (() => void) | null = null;

/*
   As funções de IA, pelo nome com que são chamadas.

   O produto já tinha o aviso de crédito todo montado — o banner, o saldo
   em tempo real, os eventos — pendurado num `invokeEdgeFunction` que SEIS
   ficheiros usam e QUARENTA E CINCO ignoram, chamando `functions.invoke`
   direto. E mesmo entre os seis era preciso lembrar de passar
   `isAiCall: true`. Por isso ninguém via aviso nenhum.

   Aqui não há nada para lembrar: quem passa pelo `fetch` passa por isto.
   A lista vem do mesmo catálogo que o painel Financeiro IA usa — uma
   funcionalidade nova entra lá uma vez e fica avisada aqui também.
*/
const FUNCOES_DE_IA: ReadonlySet<string> = new Set(AI_FEATURES.filter((f) => f.billing !== 'platform').map((f) => f.edgeFunction));

function chamadaDeFuncao(url: string): string | null {
  const m = /\/functions\/v1\/([a-z0-9-]+)/i.exec(url);
  return m ? m[1] : null;
}

/** Diz ao ecrã que um crédito saiu, ou que a franquia acabou. */
function anunciarIA(nome: string, ok: boolean, status: number) {
  if (typeof window === 'undefined') return;
  if (status === 402) {
    window.dispatchEvent(new CustomEvent('ai-credits-exhausted', { detail: { functionName: nome } }));
    return;
  }
  if (ok) {
    window.dispatchEvent(new CustomEvent('ai-credit-consumed', { detail: { functionName: nome } }));
  }
}

/** Uma escrita em lote são muitas escritas: chega um aviso no fim. */
const COALESCER_MS = 250;
let agendado: ReturnType<typeof setTimeout> | null = null;

function agendar() {
  if (agendado !== null) return;
  agendado = setTimeout(() => {
    agendado = null;
    avisar?.();
  }, COALESCER_MS);
}

const METODOS_QUE_ESCREVEM = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function urlDe(entrada: RequestInfo | URL): string {
  if (typeof entrada === 'string') return entrada;
  if (entrada instanceof URL) return entrada.toString();
  return entrada.url;
}

function metodoDe(entrada: RequestInfo | URL, inicio?: RequestInit): string {
  const bruto = inicio?.method ?? (typeof entrada === 'object' && 'method' in entrada ? entrada.method : 'GET');
  return String(bruto ?? 'GET').toUpperCase();
}

export function escreveNaBase(entrada: RequestInfo | URL, inicio?: RequestInit): boolean {
  if (!METODOS_QUE_ESCREVEM.has(metodoDe(entrada, inicio))) return false;
  const url = urlDe(entrada);
  if (!url.includes('/rest/v1/')) return false;
  if (url.includes('/rest/v1/rpc/')) return false;
  return true;
}

/**
 * Liga o aviso a quem sabe reler. Chamado uma vez, pelo `App`.
 * Devolve a forma de o desligar — os testes precisam dela.
 */
export function seguirEscritas(notificar: () => void): () => void {
  avisar = notificar;
  return () => {
    avisar = null;
    if (agendado !== null) {
      clearTimeout(agendado);
      agendado = null;
    }
  };
}

const original = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;

if (original) {
  globalThis.fetch = async (entrada: RequestInfo | URL, inicio?: RequestInit) => {
    const resposta = await original(entrada, inicio);
    // Só depois de a base confirmar. Uma escrita recusada não muda nada.
    if (resposta.ok && escreveNaBase(entrada, inicio)) agendar();

    const funcao = chamadaDeFuncao(urlDe(entrada));
    if (funcao && FUNCOES_DE_IA.has(funcao)) {
      anunciarIA(funcao, resposta.ok, resposta.status);
    }

    return resposta;
  };
}
