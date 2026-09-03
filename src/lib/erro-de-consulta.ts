/**
 * Uma consulta que falha tem de o dizer.
 *
 * ## O problema
 *
 * Nenhum dos ecrãs de lista lê o `isError` da sua consulta — só o `data`, que
 * cai no `[]` por omissão. Quando a leitura rebenta (rede, RLS, coluna
 * renomeada), a tabela mostra o ESTADO VAZIO: «Nenhum documento cadastrado —
 * comece criando documentos».
 *
 * Num produto de compliance é o pior erro possível: o auditor conclui que a
 * empresa não tem política nenhuma, quando na verdade a leitura falhou.
 *
 * Tratar isto ecrã a ecrã seriam catorze sítios e um esquecimento garantido no
 * próximo. Apanha-se no sítio por onde todas passam — o `QueryCache`.
 */

import { tGlobal } from '@/lib/i18n-global';

type ChaveDeConsulta = readonly unknown[];

export interface AvisoDeFalha {
  /** Identificador estável, para o mesmo erro não empilhar avisos. */
  id: string;
  titulo: string;
  descricao: string;
}

/**
 * Constrói o aviso para uma consulta que falhou.
 *
 * Separado do React de propósito: assim o comportamento é verificável sem
 * montar a aplicação.
 */
export function avisoDeConsultaFalhada(chave: ChaveDeConsulta): AvisoDeFalha {
  // A primeira parte da chave é o "assunto" da consulta (ex.: 'documentos').
  // Serve de identidade: se a mesma lista falhar três vezes seguidas, o aviso
  // é substituído em vez de se acumular na pilha.
  const assunto = chave.length > 0 ? String(chave[0]) : 'desconhecida';
  // Textos vêm do dicionário i18n (idioma ativo do app) — nunca fixos em PT.
  return {
    id: `consulta-falhou-${assunto}`,
    titulo: tGlobal('residuos.consultaFalhou.titulo'),
    descricao: tGlobal('residuos.consultaFalhou.descricao'),
  };
}

/** Texto curto do erro, para o registo estruturado. */
export function descreveErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
