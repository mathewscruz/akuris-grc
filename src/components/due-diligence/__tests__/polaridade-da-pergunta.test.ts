/**
 * Quem escreve a pergunta diz qual das opções é a boa.
 *
 * O cálculo dá 10 à primeira opção e 0 à última. Em «Existe política
 * anticorrupção?» com `["Sim","Não"]` isso está certo. Em «Houve vazamento de
 * dados nos últimos 12 meses?» está ao contrário — e ninguém dava por isso,
 * porque o número aparece na mesma e parece bom.
 *
 * Sete perguntas dos modelos de fábrica eram assim. Um padrão de texto achava
 * DUAS; as outras cinco só apareceram lendo as 39 interrogativas uma a uma.
 * Por isso a polaridade é campo do formulário — e o padrão fica só como aviso
 * ao lado, para lembrar quem escreve.
 *
 * Sem isto, um questionário escrito pelo cliente pode premiar o fornecedor
 * errado sem nenhum sinal no ecrã.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pareceNegativa } from '../QuestionsManager';

const EDITOR = 'src/components/due-diligence/QuestionsManager.tsx';

describe('o aviso de polaridade', () => {
  it('acende nas sete dos modelos de fábrica', () => {
    const invertidas = [
      'A organização consta de listas restritivas ou de sanções?',
      'A organização foi autuada por infração laboral nos últimos 24 meses?',
      'A organização, sócios ou administradores foram condenados por corrupção ou fraude?',
      'Existe dependência crítica de um único subfornecedor?',
      'Existe pessoa politicamente exposta (PEP) no quadro societário?',
      'Houve acidente de trabalho grave ou fatal nos últimos 24 meses?',
      'Houve interrupção não planeada superior a 4 horas nos últimos 24 meses?',
    ];
    const falhou = invertidas.filter((t) => !pareceNegativa(t));
    expect(falhou, 'Estas são as sete que motivaram o campo.').toEqual([]);
  });

  it('não acende nas perguntas normais', () => {
    /* Um aviso que aparece em tudo deixa de se ler. Estas são perguntas em que
       «Sim» é mesmo a boa resposta. */
    const normais = [
      'Existe política anticorrupção específica?',
      'As cópias de segurança são testadas por restauro?',
      'Existe plano de continuidade de negócio documentado?',
      'Existe canal de denúncia acessível e com garantia de anonimato?',
      'Antivírus',
      'Classificação de Dados',
    ];
    const falsoPositivo = normais.filter(pareceNegativa);
    expect(falsoPositivo, 'Aviso a mais é aviso que ninguém lê.').toEqual([]);
  });
});

describe('o editor guarda a polaridade', () => {
  const fonte = readFileSync(EDITOR, 'utf8');

  it('grava-a em `configuracoes`, que é onde o cálculo a lê', () => {
    expect(/polaridade:\s*formData\.polaridade/.test(fonte)).toBe(true);
  });

  it('não apaga o resto de `configuracoes` ao gravar', () => {
    /* `configuracoes` guarda também os rótulos de evidência e justificação —
       99 das 139 perguntas têm `mostrar_evidencia_quando`. Um `{}` apagava-os
       na primeira edição de qualquer pergunta. */
    expect(/\.\.\.\(editingQuestion\?\.configuracoes \?\? \{\}\)/.test(fonte)).toBe(true);
  });

  it('lê-a de volta ao abrir a pergunta para editar', () => {
    // Sem isto, editar uma pergunta invertida repunha-a como positiva.
    expect(/configuracoes\?\.polaridade === 'negativa'/.test(fonte)).toBe(true);
  });

  it('só aparece onde faz sentido: perguntas de opções', () => {
    // Numa pergunta de texto livre não há opção nenhuma para inverter.
    const bloco = fonte.slice(fonte.indexOf('fieldPolarity') - 900, fonte.indexOf('fieldPolarity'));
    expect(/\['select', 'radio', 'checkbox'\]\.includes\(formData\.tipo\)/.test(bloco)).toBe(true);
  });
});
