/**
 * A política de segurança de conteúdo do Akuris, num sítio só.
 *
 * É a mesma para o `<meta>` injetado no build e para os cabeçalhos HTTP que o
 * host serve. Ter as duas fontes a lerem daqui evita o pior: uma política a
 * dizer uma coisa no HTML e outra no header, com o navegador a aplicar a mais
 * restritiva das duas e a partir a aplicação de formas difíceis de diagnosticar.
 *
 * ## Como foi calibrada
 *
 * Cada directiva vem do que a aplicação REALMENTE carrega em runtime, não de um
 * modelo genérico. O grafo de ligações foi levantado do código:
 *
 *  · o único backend é o Supabase — API, realtime (`wss`) e storage;
 *  · fontes vêm do Google Fonts;
 *  · não há um único script de terceiros no `index.html`;
 *  · as integrações (Jira, ServiceNow, Slack) são chamadas do SERVIDOR, nas
 *    edge functions — nunca do navegador —, por isso não entram no `connect-src`.
 *
 * ## As duas concessões, e porque são seguras
 *
 *  · `style-src 'unsafe-inline'` — o Radix (base dos diálogos, dropdowns e
 *    tooltips) injecta estilos inline para posicionar. Sem isto, todo o menu
 *    aparece no sítio errado. Estilo inline não exfiltra dados como script
 *    inline exfiltra: a concessão é a norma, não um buraco.
 *  · `img-src https:` — os logótipos das empresas e os avatares são URLs que o
 *    cliente escolhe. Restringir a um host fixo partiria essa funcionalidade.
 *
 * O `script-src` NÃO tem `'unsafe-inline'` nem `'unsafe-eval'`: é a directiva
 * que trava o XSS, e o build do Vite não precisa de nenhum dos dois.
 */

const SUPABASE = 'https://*.supabase.co';
const SUPABASE_WS = 'wss://*.supabase.co';
const FONTS_CSS = 'https://fonts.googleapis.com';
const FONTS_FILES = 'https://fonts.gstatic.com';

/** As directivas, como pares — para poder servir em `<meta>` e em header. */
export const DIRETIVAS_CSP: Array<[string, string]> = [
  ['default-src', "'self'"],
  // O que trava o XSS. Sem inline, sem eval — o bundle do Vite não precisa.
  ['script-src', "'self'"],
  ['style-src', `'self' 'unsafe-inline' ${FONTS_CSS}`],
  ['font-src', `'self' ${FONTS_FILES}`],
  ['img-src', "'self' data: blob: https:"],
  ['connect-src', `'self' ${SUPABASE} ${SUPABASE_WS}`],
  ['worker-src', "'self' blob:"],
  ['manifest-src', "'self'"],
  ['media-src', "'self' blob:"],
  // Clickjacking: ninguém embute o Akuris num iframe. Só vale como header —
  // o navegador ignora `frame-ancestors` vindo de `<meta>` —, por isso há
  // também o `X-Frame-Options` nos ficheiros de header e o frame-buster em JS.
  ['frame-ancestors', "'none'"],
  // Nada de plugins, nada de `<base>` a reescrever URLs relativos, e formulários
  // só para a própria origem.
  ['object-src', "'none'"],
  ['base-uri', "'self'"],
  ['form-action', "'self'"],
  ['upgrade-insecure-requests', ''],
];

/** A política inteira numa linha, para o header ou o `<meta>`. */
export function politicaCsp(): string {
  return DIRETIVAS_CSP.map(([k, v]) => (v ? `${k} ${v}` : k)).join('; ');
}

/**
 * `frame-ancestors` não vale em `<meta>`. Para a versão do `<meta>`, servimos a
 * política sem essa directiva — o clickjacking fica coberto pelo header e pelo
 * frame-buster, e não deixamos o navegador a queixar-se de uma directiva que
 * ignora.
 */
export function politicaCspParaMeta(): string {
  return DIRETIVAS_CSP.filter(([k]) => k !== 'frame-ancestors')
    .map(([k, v]) => (v ? `${k} ${v}` : k))
    .join('; ');
}

/**
 * Os cabeçalhos de segurança HTTP, para os ficheiros de configuração do host.
 *
 * Cada um tem uma razão de estar:
 *  · CSP — a defesa principal contra XSS e injeção.
 *  · X-Frame-Options — clickjacking, para navegadores/hosts que não leem CSP.
 *  · X-Content-Type-Options — impede o navegador de adivinhar o tipo de um
 *    ficheiro e executar como script o que foi servido como texto.
 *  · Referrer-Policy — não vaza o URL interno (que pode ter ids) para terceiros.
 *  · Permissions-Policy — desliga câmara, micro e geolocalização, que o Akuris
 *    não usa: menos superfície para um XSS abusar.
 *  · HSTS — obriga HTTPS, e trava o downgrade para HTTP.
 */
export const CABECALHOS_SEGURANCA: Array<[string, string]> = [
  ['Content-Security-Policy', politicaCsp()],
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()'],
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
];
