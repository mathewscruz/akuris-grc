/**
 * Desligar o aviso por e-mail desliga mesmo o aviso.
 *
 * `profiles.notificar_por_email` era lido e gravado só pelo ecrã que o mostra.
 * **Nenhuma função de envio o consultava**: quem desligava o interruptor
 * continuava a receber tudo. Num produto de GRC, um opt-out que não opta por
 * nada é o pior sítio para ter esse defeito.
 *
 * A regra separa duas coisas que não se confundem:
 *
 *  · **Aviso** — o utilizador pode dispensar. Risco atribuído, controlo a
 *    vencer, incidente, aprovação, lembrete de chave ou licença.
 *  · **Transacional** — tem de sair sempre. Repor senha, código de MFA,
 *    boas-vindas, contacto, teste de envio. Dispensar isto seria trancar
 *    alguém fora da própria conta.
 *
 * A trava vive na consulta que resolve o destinatário: quem dispensou deixa
 * de ser encontrado, e o caminho que já existia para «sem destinatário» trata
 * do resto. Verificado na base: com o interruptor desligado o perfil sai da
 * lista de elegíveis, e volta quando se liga.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const RAIZ = 'supabase/functions';

/** Avisos: dispensáveis. */
const AVISOS = [
  'send-risco-notification',
  'send-controle-notification',
  'send-controle-mention-notification',
  'send-risco-mention-notification',
  'send-incidente-notification',
  'send-approval-notification',
  'send-auditoria-item-notification',
  'send-risco-aceite-notification',
  'send-denuncia-notification',
  'send-contrato-vencimento-notification',
  'send-chave-reminder',
  'send-licenca-reminder',
  'send-review-notification',
];

/** Transacionais: saem sempre, e a preferência não lhes toca. */
const TRANSACIONAIS = [
  'send-password-reset',
  'send-mfa-code',
  'send-welcome-email',
  'resend-welcome-email',
  'send-contact-email',
  'send-test-email',
];

const ler = (n: string) =>
  existsSync(`${RAIZ}/${n}/index.ts`) ? readFileSync(`${RAIZ}/${n}/index.ts`, 'utf8') : null;

describe('aviso por e-mail', () => {
  it('todo o aviso respeita a preferência de quem o recebe', () => {
    const falhas: string[] = [];
    for (const nome of AVISOS) {
      const fonte = ler(nome);
      if (fonte === null) {
        falhas.push(`${nome} (sem ficheiro)`);
        continue;
      }
      if (!fonte.includes('notificar_por_email')) falhas.push(nome);
    }
    expect(
      falhas,
      'Quem desliga o interruptor continua a receber: filtre o destinatário por `notificar_por_email`.',
    ).toEqual([]);
  });

  it('o transacional não pergunta pela preferência', () => {
    const falhas: string[] = [];
    for (const nome of TRANSACIONAIS) {
      const fonte = ler(nome);
      if (fonte === null) continue;
      if (fonte.includes('notificar_por_email')) falhas.push(nome);
    }
    expect(
      falhas,
      'Repor senha e código de MFA têm de sair sempre — dispensá-los tranca alguém fora da conta.',
    ).toEqual([]);
  });

  it('a lista de avisos não ficou para trás de novo', () => {
    /* Um `send-*-notification` novo que ninguém acrescente aqui passa
       despercebido — e volta a ignorar a preferência em silêncio. */
    const noDisco = readdirSync(RAIZ).filter((n) => /^send-.*-notification$/.test(n));
    const esquecidos = noDisco.filter((n) => !AVISOS.includes(n) && !TRANSACIONAIS.includes(n));
    expect(
      esquecidos,
      'Aviso novo: decida se é dispensável (junte a AVISOS) ou transacional (a TRANSACIONAIS).',
    ).toEqual([]);
  });
});
