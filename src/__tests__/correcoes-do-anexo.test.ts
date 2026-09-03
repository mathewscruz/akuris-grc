/**
 * Regressões reportadas no anexo 1.docx.
 *
 * São invariantes de integração: os defeitos nasceram da composição entre
 * textos, cache e Edge Functions, não de uma função isolada.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const ler = (path: string) => readFileSync(path, 'utf8');

describe('Gap Analysis sem informação repetida', () => {
  it('não repete o número dentro do rótulo de cada bloqueio', () => {
    const traducoes = ler('src/i18n/modules/gap-prontidao.ts');
    expect(traducoes).not.toMatch(/one:\s*['"]1 requisito/);
    expect(traducoes).not.toMatch(/other:\s*['"]\{count\} requisitos/);
    expect(traducoes).not.toMatch(/one:\s*['"]1 requirement/);
    expect(traducoes).not.toMatch(/other:\s*['"]\{count\} requirements/);
  });

  it('deixa a contagem no diagnóstico e torna a prontidão apenas acionável', () => {
    const traducoes = ler('src/i18n/modules/gap-prontidao.ts');
    expect(traducoes).not.toContain("aindaNao: '{feitos}");
    expect(traducoes).toContain("aindaNao: 'Resolva os bloqueios abaixo");
  });

  it('usa o peso para ordenar, sem repetir “peso alto” em cada linha', () => {
    const fila = ler('src/components/gap-analysis/v2/PriorityQueueCard.tsx');
    expect(fila).not.toContain("reasonParts.push(t('gapV2.priorityQueue.highWeight'))");
    expect(fila).toContain('const priority = peso * sPen');
  });
});

describe('auditoria e atribuição de responsáveis', () => {
  it('invalida o vínculo que alimenta o filtro por auditoria dos controles', () => {
    const itens = ler('src/components/auditorias/ItensAuditoriaDialog.tsx');
    expect(itens).toContain('queryKey: ["controles-auditorias-vinculos"]');
    expect(itens).toContain('queryKey: ["auditorias-counts"]');
  });

  it('envia o id real do item novo e não ignora falhas da Edge Function', () => {
    const formulario = ler('src/components/auditorias/ItemAuditoriaFormDialog.tsx');
    expect(formulario).toContain('.select("id")');
    expect(formulario).toContain('item_id: savedItemId');
    expect(formulario).toContain('if (notificationError) throw notificationError');
    expect(formulario).not.toContain('item?.id || "new"');
  });

  it('confirma o envio do provedor e gera um link direto válido', () => {
    const avisoItem = ler('supabase/functions/send-auditoria-item-notification/index.ts');
    const avisoControle = ler('supabase/functions/send-controle-notification/index.ts');
    expect(avisoItem).toContain('/governanca/auditorias?focus=${item_id}');
    expect(avisoItem).toContain('email_sent: true');
    expect(avisoItem).toContain('if (emailError)');
    expect(avisoControle).toContain('email_sent: true');
    expect(avisoControle).toContain('if (emailError)');
  });
});
