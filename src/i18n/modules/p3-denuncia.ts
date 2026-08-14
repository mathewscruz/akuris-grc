/**
 * Chaves do envio P3 (p3-denuncia). Estrutura: { pt: { p3Denuncia: {...} }, en: {...} }.
 * O namespace tem de estar presente dentro do dicionário, porque os módulos são
 * fundidos na raiz (ver src/i18n/modules/index.ts) e o componente usa a chave
 * completa `p3Denuncia.channel.*`.
 * O dicionário pt-BR é derivado automaticamente do pt (ver lib/pt-variants.ts).
 */
export const p3Denuncia = {
  pt: {
    p3Denuncia: {
      channel: {
        title: 'Canal de denúncia público',
        description: 'Este é o endereço público pelo qual os denunciantes acedem ao canal. É um requisito legal (Lei n.º 93/2021, transposição da Diretiva UE 2019/1937) que este canal esteja acessível.',
        urlLabel: 'Endereço público do formulário',
        copy: 'Copiar link',
        copied: 'Link copiado',
        copiedDescription: 'O endereço público do canal de denúncia foi copiado para a área de transferência.',
        open: 'Abrir em nova aba',
        preview: 'Pré-visualizar',
        previewTitle: 'Pré-visualização do formulário público',
        previewDescription: 'É exatamente assim que o denunciante verá o formulário.',
        openFull: 'Abrir formulário completo',
        qrTitle: 'Código QR do canal',
        qrDescription: 'Descarregue e divulgue este código QR (em cartazes, placards ou no site) para facilitar o acesso ao canal de denúncia.',
        downloadQr: 'Descarregar QR (PNG)',
        noSlugTitle: 'O canal ainda não está publicamente acessível',
        noSlugDescription: 'A empresa ainda não tem um identificador público (slug) definido, por isso não existe endereço para divulgar aos denunciantes. Defina o identificador da empresa para publicar o canal e cumprir o requisito legal de acessibilidade.',
        noSlugAction: 'Definir identificador da empresa',
      },
    },
  },
  en: {
    p3Denuncia: {
      channel: {
        title: 'Public reporting channel',
        description: 'This is the public address whistleblowers use to reach the channel. Under Portuguese Law 93/2021 (transposing EU Directive 2019/1937), the channel must be accessible to reporters.',
        urlLabel: 'Public form address',
        copy: 'Copy link',
        copied: 'Link copied',
        copiedDescription: 'The public reporting channel address was copied to the clipboard.',
        open: 'Open in new tab',
        preview: 'Preview',
        previewTitle: 'Public form preview',
        previewDescription: 'This is exactly what the whistleblower will see.',
        openFull: 'Open full form',
        qrTitle: 'Channel QR code',
        qrDescription: 'Download and share this QR code (on posters, notice boards or the website) to make the reporting channel easier to reach.',
        downloadQr: 'Download QR (PNG)',
        noSlugTitle: 'The channel is not publicly accessible yet',
        noSlugDescription: 'The company has no public identifier (slug) set, so there is no address to share with whistleblowers. Set the company identifier to publish the channel and meet the legal accessibility requirement.',
        noSlugAction: 'Set company identifier',
      },
    },
  },
};
