/**
 * Função de borda sem JWT tem de se defender no código.
 *
 * ## O buraco
 *
 * `verify_jwt = false` no `config.toml` publica a função na internet sem
 * qualquer verificação do gateway. Para as que servem o público — o canal
 * anónimo de denúncia, o formulário de contacto — é isso mesmo que se quer.
 * Para as que existem só para um agendador ou para outra função chamar, é uma
 * porta aberta: qualquer pessoa que saiba o URL dispara-as à vontade, e as que
 * mandam e-mail passam a ser uma máquina de spam a partir do domínio da
 * plataforma, com o custo e o descrédito que isso traz.
 *
 * Quatro estavam assim: `send-licenca-reminder`, `send-chave-reminder`,
 * `check-trial-expiration` e `process-invitation-reminders` — esta última
 * ainda por cima aceitava `empresa_id` do corpo do pedido e, sem ele,
 * processava lembretes de TODAS as empresas.
 *
 * ## A regra
 *
 * Quem não pode confiar no gateway fecha a porta por dentro: `_shared/interna.ts`
 * — `exigeChamadaInterna` (só a chave de serviço) ou `exigeInternaOuUtilizador`
 * (chave de serviço ou uma sessão válida, para as que também têm um botão no
 * produto).
 *
 * Esta guarda existe sobretudo porque o Lovable regenera ficheiros: se uma
 * destas voltar a nascer sem a verificação, o teste cai antes de ir para o ar.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/*
  Funções internas já fechadas. Uma função nova que só sirva agendador ou
  chamada entre funções entra nesta lista -- e passa a ter de se defender.

  NOTA: há mais funções com `verify_jwt = false` no `config.toml` que ainda não
  foram auditadas uma a uma (webhooks, e-mails de sistema, processadores). Esta
  lista é o que está verificado, não o universo todo.
*/
const INTERNAS = [
  'send-licenca-reminder',
  'send-chave-reminder',
  'check-trial-expiration',
  'process-invitation-reminders',
];

/* Notificações que resolvem um destinatário vindo do pedido: têm de confirmar
   que ele é do mesmo inquilino de quem chama. */
const NOTIFICACOES_COM_DESTINATARIO = [
  'send-risco-notification',
  'send-controle-notification',
  'send-controle-mention-notification',
];

const ler = (fn: string) => {
  const p = resolve(process.cwd(), 'supabase/functions', fn, 'index.ts');
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};

describe('função interna fecha a porta', () => {
  it('as funções internas exigem chave de serviço (ou sessão)', () => {
    const desprotegidas: string[] = [];
    for (const fn of INTERNAS) {
      const src = ler(fn);
      if (src === null) continue; // apagada: deixa de ser problema
      const temGuarda =
        /exigeChamadaInterna\s*\(/.test(src) || /exigeInternaOuUtilizador\s*\(/.test(src);
      if (!temGuarda) desprotegidas.push(fn);
    }

    expect(
      desprotegidas,
      'Função interna publicada sem verificação própria. Chame ' +
        '`exigeChamadaInterna(req)` de `../_shared/interna.ts` — ou ' +
        '`exigeInternaOuUtilizador(req)` se também for chamada do produto.',
    ).toEqual([]);
  });

  it('as notificações confirmam que o destinatário é do mesmo inquilino', () => {
    const semVerificacao: string[] = [];
    for (const fn of NOTIFICACOES_COM_DESTINATARIO) {
      const src = ler(fn);
      if (src === null) continue;
      // Tem de resolver quem chama E comparar a empresa do destinatário.
      const resolveChamador = /requireUserContext\s*\(/.test(src);
      const comparaEmpresa = /empresa_id\s*!==\s*(ctx\.empresaId|empresa_id)/.test(src);
      if (!resolveChamador || !comparaEmpresa) semVerificacao.push(fn);
    }

    expect(
      semVerificacao,
      'Notificação que aceita o destinatário do corpo do pedido sem confirmar ' +
        'o inquilino. Resolva quem chama com `requireUserContext(req)` e ' +
        'recuse quando a empresa do destinatário for outra — senão qualquer ' +
        'utilizador manda e-mail a qualquer pessoa de qualquer empresa.',
    ).toEqual([]);
  });

  it('o corpo do pedido não escolhe a empresa nas funções corrigidas', () => {
    /*
      O padrão que causou o problema: ler `empresa_id` do JSON e usá-lo direito
      contra um cliente de service_role, que ignora RLS. A empresa vem da
      sessão; só uma chamada interna a pode indicar.
    */
    const src = ler('process-invitation-reminders');
    if (src === null) return;
    expect(
      /chamador\.interna\s*\?\s*empresaPedida\s*:\s*chamador\.empresaId/.test(src),
      'process-invitation-reminders voltou a aceitar `empresa_id` do corpo sem ' +
        'o prender à sessão de quem chama.',
    ).toBe(true);
  });
});
