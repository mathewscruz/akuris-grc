/**
 * Chaves do envio P3 (p3-denuncia). Estrutura: { pt: {...}, en: {...} }.
 * O dicionário pt-BR é derivado automaticamente do pt (ver lib/pt-variants.ts).
 */
export const p3Denuncia = {
  pt: {
    channel: {
      title: 'Canal de Denúncia Público',
      description: 'Este é o endereço público pelo qual denunciantes acedem ao canal. É um requisito legal (Lei n.º 93/2021, transposição da Diretiva UE 2019/1937) que este canal esteja acessível.',
      urlLabel: 'Endereço público do formulário',
      copy: 'Copiar link',
      copied: 'Link copiado',
      copiedDescription: 'O endereço público do canal de denúncia foi copiado para a área de transferência.',
      open: 'Abrir em nova aba',
      preview: 'Pré-visualizar',
      previewTitle: 'Pré-visualização do formulário público',
      previewDescription: 'É exactamente assim que o denunciante verá o formulário.',
      openFull: 'Abrir formulário completo',
      qrTitle: 'Código QR',
      qrDescription: 'Descarregue e divulgue este código QR (por exemplo em cartazes ou no site) para facilitar o acesso ao canal.',
      downloadQr: 'Descarregar QR (PNG)',
      noSlugTitle: 'Canal ainda não está publicamente acessível',
      noSlugDescription: 'É necessário definir o identificador (slug) público da empresa antes de o canal de denúncia ficar acessível a denunciantes. Sem este passo, o requisito legal de acessibilidade do canal (Lei n.º 93/2021) não é cumprido.',
      noSlugAction: 'Definir identificador da empresa',
    },
  },
  en: {
    channel: {
      title: 'Public Reporting Channel',
      description: 'This is the public address whistleblowers use to access the channel. Under Portuguese Law 93/2021 (transposing EU Directive 2019/1937), the channel must be accessible to reporters.',
      urlLabel: 'Public form address',
      copy: 'Copy link',
      copied: 'Link copied',
      copiedDescription: 'The public reporting channel address was copied to the clipboard.',
      open: 'Open in new tab',
      preview: 'Preview',
      previewTitle: 'Public form preview',
      previewDescription: 'This is exactly what the whistleblower will see.',
      openFull: 'Open full form',
      qrTitle: 'QR Code',
      qrDescription: 'Download and share this QR code (e.g. on posters or the website) to make the channel easier to reach.',
      downloadQr: 'Download QR (PNG)',
      noSlugTitle: 'Channel is not publicly accessible yet',
      noSlugDescription: 'You must set the company\'s public identifier (slug) before the reporting channel becomes accessible to whistleblowers. Without this step, the legal accessibility requirement (Law 93/2021) is not met.',
      noSlugAction: 'Set company identifier',
    },
  },
};
