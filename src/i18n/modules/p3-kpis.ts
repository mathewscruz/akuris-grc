/**
 * Chaves do envio P3 (p3-kpis). Estrutura: { pt: {...}, en: {...} }.
 * O dicionário pt-BR é derivado automaticamente do pt (ver lib/pt-variants.ts).
 *
 * As chaves estavam escritas em texto plano com pontos — `'p3Kpis.revisaoAcessos.emptyTitle'`
 * como UMA chave — enquanto o resto do dicionário é aninhado. O `t()` desce por
 * níveis, nunca encontrava nada, e caía no humanizador: o ecrã de estreia da
 * Revisão de Acessos dizia "Empty Title", "Empty Description" e "Empty Action"
 * a todo o tenant novo. O teste de paridade não apanhava porque as duas línguas
 * estavam igualmente erradas.
 */
export const p3Kpis = {
  pt: {
    p3Kpis: {
      revisaoAcessos: {
        emptyTitle: 'Nenhuma revisão de acessos',
        emptyDescription: 'Crie a primeira revisão para acompanhar o acesso dos usuários aos sistemas.',
        emptyAction: 'Nova revisão',
      },
    },
  },
  en: {
    p3Kpis: {
      revisaoAcessos: {
        emptyTitle: 'No access reviews yet',
        emptyDescription: 'Create your first review to track user access to systems.',
        emptyAction: 'New review',
      },
    },
  },
};
