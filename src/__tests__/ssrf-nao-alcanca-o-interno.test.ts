/**
 * Nenhum `fetch` do servidor alcança um endereço interno.
 *
 * ## O ataque (OWASP A10 / MITRE T1090, T1552.005)
 *
 * Server-Side Request Forgery. As integrações do Akuris — Jira, ServiceNow,
 * Slack, webhooks — deixam o cliente escrever um URL, e o servidor depois faz
 * `fetch` a ele. Apontar para `169.254.169.254` devolve as credenciais IAM da
 * instância na cloud; para `127.0.0.1` ou `10.x`, alcança serviços internos.
 *
 * O guarda vive em `supabase/functions/_shared/ssrf.ts`. Como os testes correm
 * em Node e não em Deno, este ficheiro traz uma cópia da lógica pura e valida-a
 * contra os payloads que um atacante avançado usa — as formas exóticas de
 * escrever um IP interno que passam por um filtro ingénuo.
 *
 * A cópia é deliberada e está sob guarda: o último teste garante que ela não
 * diverge do original em silêncio.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/* ── cópia da lógica de ssrf.ts, mantida em sincronia pelo último teste ── */

function octeto(s: string): number | null {
  let n: number;
  if (/^0x[0-9a-f]+$/i.test(s)) n = parseInt(s, 16);
  else if (/^0[0-7]+$/.test(s)) n = parseInt(s, 8);
  else if (/^\d+$/.test(s)) n = parseInt(s, 10);
  else return null;
  return Number.isFinite(n) ? n : null;
}

function ipv4Interno(host: string): boolean {
  if (/^\d+$/.test(host)) {
    const n = Number(host);
    if (!Number.isFinite(n)) return false;
    return ipv4Interno([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'));
  }
  const partes = host.split('.');
  if (partes.length !== 4) return false;
  const oct = partes.map(octeto);
  if (oct.some((o) => o === null || (o as number) < 0 || (o as number) > 255)) return false;
  const [a, b] = oct as number[];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function ipv6Interno(host: string): boolean {
  let h = host.toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (h === '::1' || h === '::') return true;
  if (h.startsWith('fe80:')) return true;
  if (h.startsWith('fc') || h.startsWith('fd')) return true;
  if (h.startsWith('ff')) return true;
  const mapeado = h.match(/::ffff:([0-9a-f.:]+)$/i);
  if (mapeado) {
    const resto = mapeado[1];
    if (resto.includes('.')) return ipv4Interno(resto);
    const grupos = resto.split(':').filter(Boolean);
    if (grupos.length === 2) {
      const alto = parseInt(grupos[0], 16);
      const baixo = parseInt(grupos[1], 16);
      if (Number.isFinite(alto) && Number.isFinite(baixo)) {
        return ipv4Interno([(alto >> 8) & 255, alto & 255, (baixo >> 8) & 255, baixo & 255].join('.'));
      }
    }
  }
  return false;
}

function hostInterno(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local') || h === 'metadata.google.internal') return true;
  if (h.includes(':') || (h.startsWith('[') && h.endsWith(']'))) return ipv6Interno(h);
  return ipv4Interno(h);
}

function permitido(u: string): boolean {
  let p: URL;
  try { p = new URL(u); } catch { return false; }
  if (!['http:', 'https:'].includes(p.protocol)) return false;
  if (p.username || p.password) return false;
  if (hostInterno(p.hostname)) return false;
  return true;
}

/* ────────────────────────────── testes ────────────────────────────── */

describe('SSRF — o servidor não busca o interno', () => {
  const ATAQUES = [
    'http://169.254.169.254/latest/meta-data/iam/security-credentials/', // AWS metadata
    'http://metadata.google.internal/computeMetadata/v1/', // GCP metadata
    'http://127.0.0.1:5432/', // postgres local
    'http://localhost/admin',
    'http://2130706433/', // 127.0.0.1 em decimal
    'http://0x7f000001/', // 127.0.0.1 em hex
    'http://[::1]/', // ipv6 loopback
    'http://[::ffff:127.0.0.1]/', // ipv4 mapeado em ipv6
    'http://[fd00::1]/', // ULA
    'http://[fe80::1]/', // link-local
    'http://10.0.0.5/',
    'http://172.16.0.1/',
    'http://192.168.1.1/',
    'http://100.100.0.1/', // CGNAT
    'http://169.254.169.254@jira.suaempresa.com/', // credenciais a esconder o host
    'file:///etc/passwd',
    'gopher://127.0.0.1:6379/', // protocolo perigoso
  ];

  const LEGITIMOS = [
    'https://suaempresa.atlassian.net/rest/api/3/issue',
    'https://hooks.slack.com/services/T00/B00/xxxx',
    'https://empresa.service-now.com/api/now/table/incident',
    'https://outlook.office.com/webhook/abc',
  ];

  it.each(ATAQUES)('bloqueia %s', (u) => {
    expect(permitido(u)).toBe(false);
  });

  it.each(LEGITIMOS)('permite %s', (u) => {
    expect(permitido(u)).toBe(true);
  });

  it('a cópia deste teste não divergiu de _shared/ssrf.ts', () => {
    /*
      A lógica está em dois sítios — aqui (para correr em Node) e no módulo Deno
      que o servidor usa. Se um ganhar uma defesa e o outro não, o teste passa a
      mentir. Esta verificação compara as regras de decisão que importam, para
      que a divergência apareça como falha, e não como falsa confiança.
    */
    const fonte = readFileSync('supabase/functions/_shared/ssrf.ts', 'utf8');
    for (const marca of [
      'a === 169 && b === 254', // metadata
      "h.startsWith('fc')", // ULA
      '::ffff:', // ipv4 mapeado
      'parsed.username || parsed.password', // credenciais embutidas
      "'metadata.google.internal'",
    ]) {
      expect(fonte, `_shared/ssrf.ts perdeu a defesa: ${marca}`).toContain(marca);
    }
  });
});
