/**
 * Guarda contra SSRF, num sítio só.
 *
 * ## O que é
 *
 * Server-Side Request Forgery: o servidor faz um pedido HTTP a um endereço que
 * o utilizador controla. Num SaaS multi-inquilino na cloud, é dos piores —
 * apontar o pedido para `169.254.169.254` devolve as credenciais IAM da
 * instância; para `127.0.0.1` ou `10.x`, alcança bases de dados e serviços
 * internos que nunca deviam ver a internet.
 *
 * O Akuris tem várias integrações onde o cliente escreve um URL — a instância
 * do Jira, do ServiceNow, o webhook do Slack — e o servidor depois faz `fetch`
 * a esse URL. Sem esta guarda, «a minha instância Jira é http://169.254.169.254»
 * transforma uma integração legítima num canal de exfiltração.
 *
 * ## Porque estava duplicada, e porque agora é uma
 *
 * Havia duas cópias — `scan-url-forms` e `test-integration-connection` — e o
 * despachante de webhooks, que é quem MAIS faz `fetch` a URLs de cliente, não
 * tinha nenhuma. Cópias divergem: uma ganha uma defesa, a outra não. Fica aqui,
 * e quem faz `fetch` a URL de fora importa daqui.
 *
 * ## O que esta versão apanha e as anteriores deixavam passar
 *
 *  · **IPv6 interno** — `::1`, `fc00::/7` (ULA), `fe80::` (link-local) e o
 *    truque `::ffff:127.0.0.1` (IPv4 mapeado em IPv6).
 *  · **IP não-decimal** — `http://2130706433/` e `http://0x7f.0.0.1/` são
 *    `127.0.0.1` escritos de outra forma; o navegador e o `fetch` resolvem-nos,
 *    a regex de «quatro grupos decimais» não.
 *  · **Credenciais no URL** — `http://169.254.169.254@evil.com` e afins.
 */

/** Converte um octeto que pode vir em decimal, hex (0x..) ou octal (0..). */
function octeto(s: string): number | null {
  let n: number;
  if (/^0x[0-9a-f]+$/i.test(s)) n = parseInt(s, 16);
  else if (/^0[0-7]+$/.test(s)) n = parseInt(s, 8);
  else if (/^\d+$/.test(s)) n = parseInt(s, 10);
  else return null;
  return Number.isFinite(n) ? n : null;
}

/** True para qualquer forma de IPv4 interno/reservado — decimal, hex ou octal. */
function ipv4Interno(host: string): boolean {
  // Forma inteira única: http://2130706433/ == 127.0.0.1
  if (/^\d+$/.test(host)) {
    const n = Number(host);
    if (!Number.isFinite(n)) return false;
    return ipv4Interno([
      (n >>> 24) & 255,
      (n >>> 16) & 255,
      (n >>> 8) & 255,
      n & 255,
    ].join('.'));
  }

  const partes = host.split('.');
  if (partes.length !== 4) return false;
  const oct = partes.map(octeto);
  if (oct.some((o) => o === null || o! < 0 || o! > 255)) return false;
  const [a, b] = oct as number[];

  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local + metadata cloud
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a >= 224) return true; // multicast + reservado
  return false;
}

/** True para IPv6 interno/reservado, incluindo IPv4 mapeado. */
function ipv6Interno(host: string): boolean {
  let h = host.toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);

  if (h === '::1' || h === '::') return true; // loopback e não-especificado
  if (h.startsWith('fe80:')) return true; // link-local
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // ULA fc00::/7
  if (h.startsWith('ff')) return true; // multicast

  /*
    IPv4 mapeado em IPv6.

    `new URL('http://[::ffff:127.0.0.1]/')` normaliza o host para
    `::ffff:7f00:1` — os quatro octetos viram dois grupos hexadecimais. Tratar
    só a forma com pontos deixava passar exactamente o payload que o `fetch`
    resolve para 127.0.0.1. É preciso cobrir as duas escritas.
  */
  const mapeado = h.match(/::ffff:([0-9a-f.:]+)$/i);
  if (mapeado) {
    const resto = mapeado[1];
    if (resto.includes('.')) return ipv4Interno(resto);
    const grupos = resto.split(':').filter(Boolean);
    if (grupos.length === 2) {
      const alto = parseInt(grupos[0], 16);
      const baixo = parseInt(grupos[1], 16);
      if (Number.isFinite(alto) && Number.isFinite(baixo)) {
        return ipv4Interno([
          (alto >> 8) & 255,
          alto & 255,
          (baixo >> 8) & 255,
          baixo & 255,
        ].join('.'));
      }
    }
  }
  return false;
}

/** True quando o hostname aponta para dentro — e não deve ser buscado. */
export function hostInterno(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, ''); // tira o ponto final de FQDN
  if (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.internal') ||
    h.endsWith('.local') ||
    h === 'metadata.google.internal'
  ) {
    return true;
  }
  if (h.includes(':') || (h.startsWith('[') && h.endsWith(']'))) return ipv6Interno(h);
  return ipv4Interno(h);
}

export interface UrlSegura {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Valida um URL para `fetch` do lado do servidor.
 *
 * Recusa o que não é http(s), o que aponta para dentro, e o que traz
 * credenciais embutidas (`user:pass@host`) — um truque clássico para esconder
 * o host real por trás de um que parece legítimo.
 */
export function validarUrlExterno(rawUrl: string | undefined | null): UrlSegura {
  if (!rawUrl) return { ok: false, error: 'URL não informada' };

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'URL inválida' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: 'Apenas URLs HTTP/HTTPS são permitidas' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URLs com credenciais embutidas não são permitidas' };
  }
  if (hostInterno(parsed.hostname)) {
    return { ok: false, error: 'URLs internas ou privadas não são permitidas' };
  }

  return { ok: true, url: parsed.toString() };
}
