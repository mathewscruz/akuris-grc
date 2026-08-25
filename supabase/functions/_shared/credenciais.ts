/**
 * Ler o segredo de uma integração, decifrado.
 *
 * As credenciais de `integracoes_config.credenciais_encrypted` passaram a ser
 * cifradas em repouso (ver a migration `20260825170000`). O texto na coluna é
 * opaco — `pgp:...` — e só a função `ler_credenciais_integracao`, no servidor,
 * o decifra, usando a chave que vive no Vault.
 *
 * Nenhuma edge function deve voltar a fazer `JSON.parse` da coluna crua: isso
 * lê o texto cifrado como se fosse JSON e falha. Passa tudo por aqui.
 *
 * É retrocompatível por baixo: a função SQL devolve o JSON legado em claro tal
 * e qual, para as linhas ainda não migradas. Aqui só é preciso o `JSON.parse`
 * do resultado já decifrado.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Devolve o objecto de credenciais de uma integração, ou `null` se não houver
 * (ou se o formato guardado não for JSON válido).
 */
export async function lerCredenciais(
  supabase: SupabaseClient,
  configId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('ler_credenciais_integracao', {
    p_config_id: configId,
  });
  if (error || !data) return null;
  try {
    return typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown>);
  } catch {
    return null;
  }
}
