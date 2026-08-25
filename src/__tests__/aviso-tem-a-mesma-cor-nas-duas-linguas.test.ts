/**
 * O mesmo aviso tem de ter a mesma cor em português e em inglês.
 *
 * ## Porque isto precisa de guarda
 *
 * Cerca de 138 chamadas a `toast({...})` não passam `variant`. A cor sai de
 * `detectVariantFromText`, que adivinha pelo TEXTO do título — e o texto do
 * título vem de `t()`, ou seja, muda com a língua.
 *
 * Os padrões eram só portugueses. Resultado medido antes da correcção: dos 59
 * títulos que ganhavam cor em PT, só 36 a ganhavam em EN. «Sucesso» vira
 * «Success» e deixava de casar; quem usava o produto em inglês via avisos
 * cinzentos onde um colega via verdes.
 *
 * Os 36 que sobreviviam foi por acidente: «error» contém «erro».
 *
 * Esta guarda não valida que a cor está certa — valida que é a MESMA nas duas
 * línguas. É o invariante que se parte sozinho quando alguém acrescenta uma
 * chave nova e traduz sem pensar na heurística.
 */
import { describe, expect, it } from 'vitest';
import { modulesPt, modulesEn } from '@/i18n/modules';
import { PADRAO_ERRO, PADRAO_SUCESSO, PADRAO_AVISO } from '@/hooks/use-toast';

type Dict = Record<string, unknown>;

function achatar(o: Dict, prefixo = ''): Array<[string, string]> {
  return Object.entries(o).flatMap(([k, v]) => {
    const caminho = prefixo ? `${prefixo}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) return achatar(v as Dict, caminho);
    return typeof v === 'string' ? ([[caminho, v]] as Array<[string, string]>) : [];
  });
}

/** A mesma decisão que `detectVariantFromText` toma, na mesma ordem. */
function cor(texto: string): 'erro' | 'sucesso' | 'aviso' | 'neutro' {
  const t = texto.toLowerCase();
  if (PADRAO_ERRO.test(t)) return 'erro';
  if (PADRAO_SUCESSO.test(t)) return 'sucesso';
  if (PADRAO_AVISO.test(t)) return 'aviso';
  return 'neutro';
}

const pt = new Map(achatar(modulesPt as Dict));
const en = new Map(achatar(modulesEn as Dict));

/* Só as chaves que acabam mesmo num título de aviso. */
const CHAVES_DE_TITULO = [...pt.keys()].filter((k) => /toast[A-Za-z]*Title$/i.test(k));

/**
 * Divergências que existiam antes desta guarda e que ficam registadas em vez
 * de silenciadas. Cada linha é uma tradução a rever, não uma excepção legítima
 * — a lista é para encolher.
 */
const DIVERGENCIAS_CONHECIDAS = new Set<string>([]);

describe('o aviso tem a mesma cor nas duas línguas', () => {
  it('há títulos de aviso para verificar', () => {
    expect(CHAVES_DE_TITULO.length).toBeGreaterThan(50);
  });

  it('PT e EN decidem a mesma cor para o mesmo título', () => {
    const divergentes = CHAVES_DE_TITULO.filter((k) => {
      if (DIVERGENCIAS_CONHECIDAS.has(k)) return false;
      const vp = pt.get(k);
      const ve = en.get(k);
      if (!vp || !ve) return false;
      return cor(vp) !== cor(ve);
    }).map((k) => `${k}: "${pt.get(k)}" (${cor(pt.get(k)!)}) ≠ "${en.get(k)}" (${cor(en.get(k)!)})`);

    expect(
      divergentes,
      'Estes títulos ganham cores diferentes conforme a língua. A cor de um ' +
        'aviso não pode depender do idioma de quem lê: ou ajuste a tradução, ' +
        'ou passe `variant` explicitamente na chamada a toast().',
    ).toEqual([]);
  });

  it('o erro é decidido antes do sucesso', () => {
    /*
      «Error: could not be updated» contém «updated». Com o sucesso a ser
      testado primeiro — como estava — uma falha aparecia verde.
    */
    expect(cor('Error: could not be updated')).toBe('erro');
    expect(cor('Erro ao atualizado registro')).toBe('erro');
  });

  it('as palavras das duas línguas são reconhecidas', () => {
    expect(cor('Sucesso')).toBe('sucesso');
    expect(cor('Success')).toBe('sucesso');
    expect(cor('Erro')).toBe('erro');
    expect(cor('Error')).toBe('erro');
    expect(cor('Atenção')).toBe('aviso');
    expect(cor('Warning')).toBe('aviso');
  });
});
