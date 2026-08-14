/**
 * Chaves do envio P3 (p3-projetos). Estrutura: { pt: {...}, en: {...} }.
 * O dicionário pt-BR é derivado automaticamente do pt (ver lib/pt-variants.ts).
 */
export const p3Projetos = {
  pt: {
    p3Projetos: {
      papel: {
        owner: 'Dono',
        admin: 'Administrador',
        membro: 'Membro',
        viewer: 'Visualizador',
      },
      dependencia: {
        FS: 'Término → Início',
        SS: 'Início → Início',
        FF: 'Término → Término',
        SF: 'Início → Término',
      },
      lista: {
        filterStatusLabel: 'Status',
        filterPriorityLabel: 'Prioridade',
        filterColumnLabel: 'Coluna',
        filterGroupLabel: 'Agrupar por',
      },
    },
  },
  en: {
    p3Projetos: {
      papel: {
        owner: 'Owner',
        admin: 'Admin',
        membro: 'Member',
        viewer: 'Viewer',
      },
      dependencia: {
        FS: 'Finish → Start',
        SS: 'Start → Start',
        FF: 'Finish → Finish',
        SF: 'Start → Finish',
      },
      lista: {
        filterStatusLabel: 'Status',
        filterPriorityLabel: 'Priority',
        filterColumnLabel: 'Column',
        filterGroupLabel: 'Group by',
      },
    },
  },
};
