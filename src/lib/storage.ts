import { supabase } from '@/integrations/supabase/client';

/**
 * Extrai o path relativo do objeto dentro do bucket a partir de:
 *  - path puro (ex: "empresa123/documentos/arquivo.pdf")
 *  - URL pública legada (ex: "https://xyz.supabase.co/storage/v1/object/public/documentos/empresa123/documentos/arquivo.pdf")
 *  - URL assinada legada (mesmo prefixo, mas com "/sign/" e query string)
 */
export function extractStoragePath(bucket: string, urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const raw = String(urlOrPath).trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, '');
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/${bucket}/`,
  ];
  for (const m of markers) {
    const idx = raw.indexOf(m);
    if (idx >= 0) {
      return raw.slice(idx + m.length).split('?')[0];
    }
  }
  return null;
}

/**
 * Resolve uma URL utilizável (signed URL) para arquivos em bucket privado.
 * Aceita path ou URL pública/assinada legada. Retorna null se não conseguir resolver.
 * `expiresIn` em segundos (default 1h).
 */
export async function resolveStorageUrl(
  bucket: string,
  urlOrPath: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  const path = extractStoragePath(bucket, urlOrPath);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Abre um arquivo de bucket privado em uma nova aba usando signed URL efêmera.
 * Usar sempre que o link original for de bucket privado (documentos, riscos-anexos,
 * incidentes-evidencias, controles-evidencias, auditoria-evidencias, dados-documentos,
 * denuncias-anexos, due-diligence-docs).
 */
export async function openStorageFile(
  bucket: string,
  urlOrPath: string | null | undefined,
  expiresIn = 300,
): Promise<boolean> {
  const url = await resolveStorageUrl(bucket, urlOrPath, expiresIn);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
