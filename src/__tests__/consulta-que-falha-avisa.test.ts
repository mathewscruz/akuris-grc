/**
 * Uma consulta que falha não pode passar por "não tens nada".
 *
 * ## Porque isto é um teste e não uma revisão de código
 *
 * O sintoma é invisível: a lista mostra o estado vazio -- «Nenhum documento
 * cadastrado» -- exactamente como mostraria numa empresa que ainda não criou
 * documentos. Nada na tela distingue "falhou a ler" de "não existe". Num
 * produto de compliance essa diferença é tudo: o auditor conclui que a empresa
 * não tem política nenhuma.
 *
 * Nenhum dos ecrãs de lista lê o `isError` da sua consulta. Em vez de os
 * corrigir um a um -- e esquecer o próximo -- o aviso vive no `QueryCache`, por
 * onde todas passam. Este teste prende esse contrato: o `onError` do cache
 * dispara mesmo quando o componente ignora o erro por completo.
 */
import { describe, expect, it, vi } from 'vitest';
import { QueryCache, QueryClient } from '@tanstack/react-query';
import { avisoDeConsultaFalhada, descreveErro } from '@/lib/erro-de-consulta';

describe('consulta que falha avisa', () => {
  it('o onError do cache dispara mesmo quando ninguém lê o isError', async () => {
    const avisos: string[] = [];

    const queryCache = new QueryCache({
      onError: (erro, query) => {
        const aviso = avisoDeConsultaFalhada(query.queryKey);
        avisos.push(`${aviso.id} :: ${descreveErro(erro)}`);
      },
    });
    const client = new QueryClient({
      queryCache,
      defaultOptions: { queries: { retry: false } },
    });

    // Consulta que rebenta -- e cujo resultado ninguém observa, tal como nos
    // ecrãs reais, que só desestruturam `data`.
    await client
      .fetchQuery({
        queryKey: ['documentos', 'empresa-x'],
        queryFn: async () => {
          throw new Error('Failed to fetch');
        },
      })
      .catch(() => undefined);

    expect(
      avisos,
      'A consulta falhou e ninguém foi avisado — a tela mostraria o estado ' +
        'vazio como se a empresa não tivesse dados.',
    ).toEqual(['consulta-falhou-documentos :: Failed to fetch']);
  });

  it('a mesma lista a falhar várias vezes não empilha avisos', () => {
    /*
      O `id` é derivado do assunto da consulta (a primeira parte da chave), e
      não do erro nem do instante. Assim o sonner substitui o aviso anterior em
      vez de encher a tela quando uma consulta falha em repetição.
    */
    const a = avisoDeConsultaFalhada(['incidentes', 'empresa-x']);
    const b = avisoDeConsultaFalhada(['incidentes', 'empresa-y']);
    expect(a.id).toBe(b.id);

    const outra = avisoDeConsultaFalhada(['documentos']);
    expect(outra.id).not.toBe(a.id);
  });

  it('uma chave vazia não rebenta o aviso', () => {
    const aviso = avisoDeConsultaFalhada([]);
    expect(aviso.id).toBe('consulta-falhou-desconhecida');
    expect(aviso.titulo.length).toBeGreaterThan(0);
  });

  it('o texto do erro sobrevive a um erro que não é Error', () => {
    expect(descreveErro(new Error('rede caiu'))).toBe('rede caiu');
    expect(descreveErro('string solta')).toBe('string solta');
    expect(descreveErro({ code: 42 })).toContain('object');
  });
});
