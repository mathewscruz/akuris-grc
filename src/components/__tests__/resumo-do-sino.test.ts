/**
 * O cabeçalho do sino descreve a lista, não o que já foi visto.
 *
 * Dizia «Tudo em dia» sempre que `unreadCount` era zero. Só que as
 * notificações do produto são CALCULADAS e marcam-se ao abrir o painel
 * (`useNotificacoesLidas`), por isso zero é o estado normal a partir da
 * segunda vez que se abre o sino.
 *
 * Medido: «Tudo em dia» em cima de nove avisos — entre eles um risco com
 * revisão atrasada há 43 dias e um contrato vencido há 33. Lida não é
 * resolvida, e o cabeçalho do painel é o sítio mais visto para dizer o
 * contrário do que está logo por baixo.
 *
 * A guarda é sobre a ORDEM das condições: «tudo em dia» tem de ser o último
 * ramo, e só se aplica à lista vazia.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const FONTE = 'src/components/NotificationCenter.tsx';

describe('resumo do sino', () => {
  it('«tudo em dia» é o último ramo, depois de contar o que está na lista', () => {
    const fonte = readFileSync(FONTE, 'utf8');
    const iUrgente = fonte.indexOf('notifications.summaryUrgent');
    const iAberto = fonte.indexOf('notifications.summaryOpen');
    const iEmDia = fonte.indexOf('notifications.allCaughtUp');

    expect(iUrgente, 'falta o resumo dos urgentes').toBeGreaterThan(-1);
    expect(iAberto, 'falta o resumo dos que estão em aberto').toBeGreaterThan(-1);
    expect(iUrgente, 'urgentes antes de «tudo em dia»').toBeLessThan(iEmDia);
    expect(iAberto, 'em aberto antes de «tudo em dia»').toBeLessThan(iEmDia);
  });

  it('«tudo em dia» exige a lista vazia', () => {
    const fonte = readFileSync(FONTE, 'utf8');
    /* Sem esta condição, qualquer estado que não seja "há não lidas" volta a
       cair em «tudo em dia» — que é exactamente como o defeito nasceu. */
    expect(/allNotifications\.length > 0[\s\S]{0,200}allCaughtUp/.test(fonte)).toBe(true);
  });

  it('as chaves novas existem nas duas línguas', () => {
    const pt = readFileSync('src/i18n/pt.ts', 'utf8');
    const en = readFileSync('src/i18n/en.ts', 'utf8');
    for (const chave of ['summaryUrgent', 'summaryUrgentOne', 'summaryOpen']) {
      expect(pt.includes(`${chave}:`), `falta ${chave} em pt`).toBe(true);
      expect(en.includes(`${chave}:`), `falta ${chave} em en`).toBe(true);
    }
    // Plural tratado à parte, como o produto já faz com `unread`/`unreadOne`.
    expect(pt).toContain("summaryUrgentOne: '1 urgente'");
    expect(pt).toContain("summaryUrgent: '{n} urgentes'");
  });
});
