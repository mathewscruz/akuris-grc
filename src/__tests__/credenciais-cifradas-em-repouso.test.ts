/**
 * Os segredos de integração são cifrados em repouso, e ninguém lê a coluna crua.
 *
 * ## O que esta guarda protege
 *
 * `integracoes_config.credenciais_encrypted` passou a guardar `pgp:...` cifrado
 * (migration `20260825170000`). Uma edge function que faça `JSON.parse` da
 * coluna directamente lê o texto cifrado como se fosse JSON — e a integração
 * pára de funcionar em silêncio, ou pior, alguém "corrige" gravando o segredo
 * outra vez em claro.
 *
 * Toda a leitura tem de passar pela RPC `ler_credenciais_integracao`, via o
 * helper `_shared/credenciais.ts`. Esta guarda faz falhar qualquer regresso ao
 * `JSON.parse` da coluna.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FUNCS = 'supabase/functions';

function ficheirosDeFuncao(): string[] {
  const out: string[] = [];
  for (const dir of readdirSync(FUNCS)) {
    if (dir === '_shared') continue;
    const idx = join(FUNCS, dir, 'index.ts');
    if (existsSync(idx)) out.push(idx);
  }
  return out;
}

describe('credenciais cifradas em repouso', () => {
  it('nenhuma edge function faz JSON.parse da coluna credenciais_encrypted', () => {
    const infratores: string[] = [];
    for (const ficheiro of ficheirosDeFuncao()) {
      const texto = readFileSync(ficheiro, 'utf8');
      texto.split('\n').forEach((linha, i) => {
        // JSON.parse(...credenciais_encrypted...) — em qualquer ordem, na mesma linha
        if (/JSON\.parse\([^)]*credenciais_encrypted/.test(linha)) {
          infratores.push(`${ficheiro}:${i + 1}`);
        }
      });
    }
    expect(
      infratores,
      'Edge function a fazer JSON.parse do segredo cru. O segredo está cifrado ' +
        '(`pgp:...`) — use `lerCredenciais(supabase, configId)` de ' +
        '`_shared/credenciais.ts`, que chama a RPC de decifra.',
    ).toEqual([]);
  });

  it('quem lê segredo de integração usa o helper partilhado', () => {
    /*
      Se uma função menciona `credenciais_encrypted` (a não ser em comentário),
      deve também importar `lerCredenciais`. Apanha o caso de alguém voltar a
      ler a coluna por outra via que não o `JSON.parse`.
    */
    const suspeitos: string[] = [];
    for (const ficheiro of ficheirosDeFuncao()) {
      const texto = readFileSync(ficheiro, 'utf8');
      // linhas de código (não comentário) que tocam na coluna
      const tocaColuna = texto
        .split('\n')
        .some((l) => /credenciais_encrypted/.test(l) && !/^\s*(\*|\/\/|--)/.test(l) && !/select\(/i.test(l));
      const usaHelper = texto.includes("from '../_shared/credenciais.ts'");
      if (tocaColuna && !usaHelper) suspeitos.push(ficheiro);
    }
    expect(
      suspeitos,
      'Função a manipular credenciais_encrypted sem o helper de decifra.',
    ).toEqual([]);
  });

  it('a migration cifra, decifra retrocompatível, e tranca o anon', () => {
    const dir = readdirSync('supabase/migrations').filter((f) => f.includes('cifra_em_repouso'));
    expect(dir.length, 'a migration de cifra sumiu').toBeGreaterThan(0);
    const sql = readFileSync(join('supabase/migrations', dir[0]), 'utf8');
    // cifra com pgcrypto qualificado (não depende de search_path)
    expect(sql).toMatch(/extensions\.pgp_sym_encrypt/);
    expect(sql).toMatch(/extensions\.pgp_sym_decrypt/);
    // retrocompatível: devolve o legado em claro
    expect(sql).toMatch(/left\(v_bruto, 4\)\s*<>\s*'pgp:'/);
    // a chave vive no Vault, não na tabela
    expect(sql).toMatch(/vault\.(create_secret|decrypted_secrets)/);
    // gatilho que cifra na escrita
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE.*credenciais_encrypted/i);
  });
});
