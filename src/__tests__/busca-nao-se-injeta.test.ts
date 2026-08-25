/**
 * Uma caixa de busca não pode reescrever o filtro da consulta.
 *
 * ## O que esta guarda impede
 *
 * O PostgREST monta o `or(...)` a partir de uma string, separando por vírgula.
 * Interpolar texto de utilizador direto nessa string —
 *
 *     query.or(`nome.ilike.%${termo}%,descricao.ilike.%${termo}%`)
 *
 * — deixa quem escreve na caixa injetar condições que o programador nunca pôs.
 * O `empresa_id` continua a proteger o inquilino, mas o atacante escolhe que
 * linhas do próprio inquilino aparecem, e uma sintaxe inválida derruba a lista.
 *
 * Havia exatamente um sítio assim, em Auditorias. Esta guarda existe para que
 * o próximo não passe despercebido numa revisão.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontes } from './_fontes';
import { orIlike, termoBuscaSeguro } from '@/lib/busca-segura';

describe('a busca não se injeta', () => {
  it('remove os caracteres com que se reescreve o filtro', () => {
    /* Vírgula separa condições; parênteses agrupam; `*` é curinga do like. */
    expect(termoBuscaSeguro('x,tipo.eq.confidencial')).toBe('x tipo.eq.confidencial'.replace(/\s/g, ''));
    expect(termoBuscaSeguro('a(b)c')).toBe('abc');
    expect(termoBuscaSeguro('quero*tudo')).toBe('querotudo');
    expect(termoBuscaSeguro('back\\slash')).toBe('backslash');
  });

  it('deixa passar acentos e espaços, que são procura legítima', () => {
    expect(termoBuscaSeguro('  auditoria de segurança  ')).toBe('auditoria de segurança');
    expect(termoBuscaSeguro('José & Cia')).toBe('José & Cia');
  });

  it('sem termo útil devolve nulo, para não aplicar um or() vazio', () => {
    expect(orIlike(['nome'], '')).toBeNull();
    expect(orIlike(['nome'], '   ')).toBeNull();
    expect(orIlike(['nome'], ',,,')).toBeNull();
    expect(orIlike(['nome'], null)).toBeNull();
  });

  it('monta o filtro com o termo já limpo', () => {
    expect(orIlike(['nome', 'descricao'], 'contrato')).toBe(
      'nome.ilike.%contrato%,descricao.ilike.%contrato%',
    );
    /* O payload de ataque sai desarmado: uma só condição, sem a injetada. */
    expect(orIlike(['nome'], 'x,tipo.eq.interna')).toBe('nome.ilike.%xtipo.eq.interna%');
  });

  it('nenhum ficheiro interpola busca livre dentro de or(...ilike...)', () => {
    /*
      O padrão proibido: um template-string dentro de `.or(` que contém `ilike`
      e uma interpolação `${...}`. Datas e uuids gerados pelo sistema noutros
      `or()` não entram aqui — o alvo é só `ilike`, que é onde entra texto de
      pessoa.
    */
    const proibido = /\.or\(`[^`]*ilike[^`]*\$\{/;
    const infratores: string[] = [];
    for (const ficheiro of fontes()) {
      if (ficheiro === 'src/lib/busca-segura.ts') continue;
      const texto = readFileSync(ficheiro, 'utf8');
      texto.split('\n').forEach((linha, i) => {
        if (proibido.test(linha)) infratores.push(`${ficheiro}:${i + 1}`);
      });
    }
    expect(
      infratores,
      'Busca livre interpolada em or(...ilike...). Use `orIlike([campos], termo)` ' +
        'de `@/lib/busca-segura`, que remove vírgula, parênteses e curinga antes ' +
        'de montar o filtro.',
    ).toEqual([]);
  });
});
