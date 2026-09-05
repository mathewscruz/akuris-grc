import { z } from 'zod';

type Translate = (key: string) => string;
/** Keep browser validation aligned with create_denuncia_publica_secure. */
export function buildDenunciaSchema(t: Translate, permitirAnonimas: boolean, exigirPolitica: boolean, requererEmail = false) {
  return z.object({
    categoria_id: z.string().min(1, t('publicPortal.denunciaForm.validation.category')),
    titulo: z.string().trim().min(8, t('canalExperience.titleLength')).max(160, t('canalExperience.titleLength')),
    descricao: z.string().trim().min(20, t('canalExperience.descriptionLength')).max(10000, t('canalExperience.descriptionLength')),
    local_ocorrencia: z.string().optional(), data_ocorrencia: z.string().optional(),
    nivel_identificacao: z.enum(['identificada', 'confidencial', 'anonima']),
    denunciante_nome: z.string().optional(), denunciante_email: z.string().optional(), denunciante_telefone: z.string().optional(),
    testemunhas: z.string().optional(), evidencias_descricao: z.string().optional(), politica_aceita: z.boolean().optional(),
  }).superRefine((data, context) => {
    const issue = (field: string, key: string) => context.addIssue({ code: 'custom', path: [field], message: t(key) });
    if (data.nivel_identificacao === 'anonima') {
      if (!permitirAnonimas || requererEmail) issue('nivel_identificacao', 'canalExperience.emailRequired');
    } else {
      if ((data.denunciante_nome ?? '').trim().length < 3) issue('denunciante_nome', 'publicPortal.denunciaForm.validation.nameRequired');
      const email = (data.denunciante_email ?? '').trim();
      if (requererEmail && !email) issue('denunciante_email', 'canalExperience.emailRequired');
      else if (email && !z.string().email().safeParse(email).success) issue('denunciante_email', 'publicPortal.denunciaForm.validation.email');
    }
    if (exigirPolitica && data.politica_aceita !== true) issue('politica_aceita', 'publicPortal.denunciaForm.validation.policyRequired');
  });
}

export const CANAL_FILE_MIMES: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
export function canalFileMime(file: Pick<File, 'name' | 'type'>): string | null {
  const expected = CANAL_FILE_MIMES[file.name.split('.').pop()?.toLowerCase() ?? ''];
  // The server still validates file signatures before accepting evidence.
  return expected && (!file.type || file.type === expected || file.type === 'application/octet-stream') ? expected : null;
}
