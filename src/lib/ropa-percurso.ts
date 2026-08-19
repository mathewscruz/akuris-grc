/**
 * O percurso do dado — a etapa que falta ao ROPA em papel.
 *
 * Um registo de tratamento conta uma história: o dado entra por uma origem, é
 * operado de certas formas, é partilhado dentro de casa, depois com terceiros,
 * às vezes atravessa a fronteira, fica guardado um tempo e é descartado por um
 * critério.
 *
 * A planilha achata essa história em sete células que não sabem que estão
 * relacionadas — é limitação do papel, não escolha de quem a escreveu. No ecrã
 * as sete voltam a ser um caminho, e uma etapa por preencher passa a ser
 * visível como buraco no percurso em vez de simplesmente não existir.
 *
 * Os campos são os mesmos de `ropa-schema.ts`. Isto não acrescenta dado nenhum:
 * só diz em que ordem a história acontece.
 */
import { ROPA_FIELDS } from '@/lib/ropa-schema';

export interface EtapaDoPercurso {
  /** Campo de `ropa_registros` que descreve esta etapa. */
  campo: string;
  rotulo: { pt: string; en: string };
  /** Uma linha sobre o que a etapa responde. */
  nota: { pt: string; en: string };
}

export const PERCURSO_DO_DADO: EtapaDoPercurso[] = [
  {
    campo: 'fonte_dados',
    rotulo: { pt: 'Origem', en: 'Source' },
    nota: { pt: 'De onde o dado vem.', en: 'Where the data comes from.' },
  },
  {
    campo: 'operacoes_realizadas',
    rotulo: { pt: 'Tratamento', en: 'Processing' },
    nota: { pt: 'O que se faz com ele.', en: 'What is done with it.' },
  },
  {
    campo: 'compartilhamento_interno',
    rotulo: { pt: 'Partilha interna', en: 'Internal sharing' },
    nota: { pt: 'Quem, dentro de casa, tem acesso.', en: 'Who inside has access.' },
  },
  {
    campo: 'compartilhamento_externo',
    rotulo: { pt: 'Terceiros', en: 'Third parties' },
    nota: { pt: 'Que operadores recebem o dado.', en: 'Which processors receive it.' },
  },
  {
    campo: 'transferencia_detalhes',
    rotulo: { pt: 'Fora do país', en: 'Cross-border' },
    nota: { pt: 'Se sai do país, e com que salvaguarda.', en: 'If it leaves, under what safeguard.' },
  },
  {
    campo: 'prazo_retencao',
    rotulo: { pt: 'Retenção', en: 'Retention' },
    nota: { pt: 'Por quanto tempo fica.', en: 'How long it is kept.' },
  },
  {
    campo: 'criterio_descarte',
    rotulo: { pt: 'Descarte', en: 'Disposal' },
    nota: { pt: 'Como e quando é eliminado.', en: 'How and when it is deleted.' },
  },
];

/**
 * Guarda de coerência: toda etapa aponta para um campo que existe no esquema.
 *
 * Sem isto, renomear um campo em `ropa-schema.ts` deixaria uma etapa a ler
 * `undefined` — e o percurso mostraria "por preencher" num registo completo,
 * que é a pior forma de errar: parece um problema do cliente.
 */
export const camposDoPercursoExistem = (): string[] =>
  PERCURSO_DO_DADO.map((e) => e.campo).filter(
    (campo) => !ROPA_FIELDS.some((f) => f.key === campo),
  );
