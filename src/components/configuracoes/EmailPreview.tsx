import { useMemo } from 'react';

interface EmailPreviewProps {
  assunto: string;
  conteudoHtml: string;
  imagemUrl?: string | null;
}

/**
 * Pré-visualização WYSIWYG do e-mail com header/footer Akuris padrão
 * idênticos ao BaseEmailTemplate usado nos disparos reais.
 */
export function EmailPreview({ assunto, conteudoHtml, imagemUrl }: EmailPreviewProps) {
  const srcDoc = useMemo(() => {
    const safeImage = imagemUrl
      ? `<img src="${imagemUrl}" alt="" style="display:block;width:100%;max-width:512px;height:auto;border-radius:8px;margin:0 0 24px" />`
      : '';

    const title = (assunto || 'Assunto do e-mail').replace(/[<>]/g, '');

    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      body{margin:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:24px 0}
      .container{background:#ffffff;margin:0 auto;max-width:600px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}
      .header{background:#0a1628;padding:36px 40px;text-align:center}
      .header img{display:block;margin:0 auto;max-width:200px;height:auto}
      .accent{height:3px;background:linear-gradient(90deg,#7552ff,#5a3fd6,#7552ff)}
      .titleSection{padding:36px 44px 0}
      h1{color:#0a1628;font-size:26px;font-weight:700;line-height:34px;margin:0}
      .content{padding:24px 44px 8px;color:#2d3748;font-size:15px;line-height:26px}
      .content h2{color:#0a1628;font-size:20px;margin:16px 0 8px}
      .content h3{color:#0a1628;font-size:17px;margin:14px 0 6px}
      .content p{margin:0 0 16px}
      .content ul,.content ol{padding-left:20px;margin:8px 0 16px}
      .content li{margin:0 0 6px}
      .content a{color:#7552ff;text-decoration:underline}
      .signature{padding:8px 44px 32px}
      .signature p{margin:0 0 4px;color:#718096;font-size:14px}
      .signature .name{color:#0a1628;font-weight:600}
      .footer{background:#edf2f7;border-top:1px solid #e2e8f0;padding:20px 44px;text-align:center;color:#a0aec0;font-size:12px;line-height:20px}
      .footer a{color:#7552ff;text-decoration:none}
    </style></head><body>
      <div class="container">
        <div class="header"><img src="https://akuris-grc.lovable.app/akuris-logo-email.png" alt="Akuris" /></div>
        <div class="accent"></div>
        <div class="titleSection"><h1>${title}</h1></div>
        <div class="content">${safeImage}${conteudoHtml || '<p style="color:#a0aec0">Conteúdo do e-mail aparecerá aqui…</p>'}</div>
        <div class="signature"><p>Atenciosamente,</p><p class="name">Equipe Akuris</p></div>
        <div class="footer">
          <p>Este é um e-mail automático enviado pela plataforma <a href="https://akuris.com.br">Akuris</a>.</p>
          <p>© ${new Date().getFullYear()} Akuris · Governança, Risco e Compliance</p>
        </div>
      </div>
    </body></html>`;
  }, [assunto, conteudoHtml, imagemUrl]);

  return (
    <iframe
      title="Pré-visualização do e-mail"
      srcDoc={srcDoc}
      sandbox=""
      className="w-full h-[640px] rounded-md border border-border bg-white"
    />
  );
}
