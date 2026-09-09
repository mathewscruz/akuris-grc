import { describe, expect, it } from 'vitest';
import { calcularScoreFramework, ganhoPotencial } from '../gap-score';
import { comparableFrameworkTrend } from '../framework-trend';
import { efetividadeControles } from '../metrics/controles';
import { financialImpact, scoreFromMatriz } from '@/components/riscos/risk-utils';
import { recoveryHours, validRecoveryTargets } from '../recovery-targets';
import { validAssessmentAnswer } from '../../../supabase/functions/_shared/assessment-validation';
import { nivelRiscoFromConfig } from '@/components/riscos/matriz-config';

describe('calculation integrity — hand-calculated cases', () => {
  it('62.5 rounds to 63; missing, partial and N/A remain distinct', () => {
    const statuses = ['conforme','conforme','conforme','conforme','parcial','parcial','nao_conforme',null,'nao_aplicavel'];
    const r = calcularScoreFramework(statuses.map((s,i) => ({ id: String(i), conformityStatus: s, peso: 1 })));
    expect(r).toMatchObject({ score: 63, aplicaveis: 8, naoAplicaveis: 1, avaliados: 7, naoAvaliado: 1 });
  });
  it('handles fractional and invalid legacy weights without negative/NaN scores', () => {
    expect(calcularScoreFramework([{id:'a',peso:1.5,conformityStatus:'conforme'},{id:'b',peso:.5,conformityStatus:'nao_conforme'}]).score).toBe(75);
    for (const peso of [0,-1,NaN,Infinity]) expect(calcularScoreFramework([{id:'a',peso,conformityStatus:'conforme'},{id:'b',peso:1}]).score).toBe(50);
  });
  it('does not duplicate requirements or count foreign targets in projected gains', () => {
    const a = {id:'a',peso:3,conformityStatus:'parcial'};
    const b = {id:'b',peso:1,conformityStatus:'conforme'};
    expect(calcularScoreFramework([a,a,b]).score).toBe(63);
    expect(ganhoPotencial([a,b], [a,a,{id:'foreign',peso:999}])).toBe(38);
  });
  it('excludes tests of deleted/out-of-scope controls and keeps the latest result', () => {
    const r = efetividadeControles([{id:'a'}], [
      {controle_id:'a',data_teste:'2026-01-01',resultado:'eficaz'},
      {controle_id:'a',data_teste:'2026-02-01',resultado:'ineficaz'},
      {controle_id:'deleted',data_teste:'2026-03-01',resultado:'eficaz'},
    ]);
    expect(r).toEqual({ percentual: 0, controlesTestados: 1, totalControles: 1, testes: 2 });
    expect(efetividadeControles([], []).percentual).toBeNull();
  });
  it('compares each framework against its latest pre-cutoff snapshot, not all observations', () => {
    const date = new Date('2026-08-10T00:00:00Z');
    const cohort = [{id:'a',score:90},{id:'b',score:30}];
    const history = [
      {framework_id:'a',score:0,recorded_at:'2026-08-01'},
      {framework_id:'a',score:50,recorded_at:'2026-08-09'},
      {framework_id:'b',score:10,recorded_at:'2026-08-08'},
      {framework_id:'a',score:100,recorded_at:'2026-08-11'},
      {framework_id:'unrelated',score:100,recorded_at:'2026-08-09'},
    ];
    expect(comparableFrameworkTrend(cohort, history, date)).toBe(30);
    expect(comparableFrameworkTrend([...cohort,{id:'new',score:100}],history,date)).toBeNull();
  });
  it('reports declared financial impact instead of converting ordinal likelihood to currency', () => {
    expect(financialImpact('50000')).toBe(50000);
    expect(financialImpact(0)).toBe(0);
    for (const v of ['', 'not a number', -1, Infinity, null]) expect(financialImpact(v)).toBeNull();
    expect(scoreFromMatriz(4,3,'soma')).toBe(7);
    expect(scoreFromMatriz(4,3,'multiplicacao')).toBe(12);
  });
  it('does not turn blank, fractional or out-of-scale inputs into a risk level', () => {
    const config = { escala_probabilidade:[{valor:'1',descricao:''}], escala_impacto:[{valor:'1',descricao:''}], niveis_risco:[{min:0,max:10,nivel:'Low'}] };
    for (const p of [null,'',0,1.5,2]) expect(nivelRiscoFromConfig(p,1,config)).toBeNull();
    expect(nivelRiscoFromConfig(1,1,config)).toBe('Low');
  });
  it('preserves fractional recovery targets and zero RPO; rejects RTO beyond MTPD', () => {
    expect(recoveryHours('.5')).toBe(.5);
    expect(recoveryHours('')).toBeNull();
    expect(recoveryHours(-1)).toBeNull();
    expect(validRecoveryTargets({mtpd_horas:'4',rto_horas:'.5',rpo_horas:'0'})).toBe(true);
    expect(validRecoveryTargets({mtpd_horas:'4',rto_horas:'5',rpo_horas:'0'})).toBe(false);
    // Independent dimensions: RPO is not constrained by the RTO.
    expect(validRecoveryTargets({mtpd_horas:'4',rto_horas:'1',rpo_horas:'24'})).toBe(true);
  });
  it('validates questionnaire answers, including zero, exact checkbox options and real uploads', () => {
    expect(validAssessmentAnswer({tipo:'score'},0)).toBe(true);
    for(const v of ['',null,NaN,Infinity,11,-1]) expect(validAssessmentAnswer({tipo:'score'},v)).toBe(false);
    expect(validAssessmentAnswer({tipo:'radio',opcoes:['Sim','Não']},'Talvez')).toBe(false);
    expect(validAssessmentAnswer({tipo:'checkbox',opcoes:['AWS','AWS Backup']},'AWS Backup')).toBe(true);
    expect(validAssessmentAnswer({tipo:'checkbox',opcoes:['A','B']},'A; A')).toBe(false);
    expect(validAssessmentAnswer({tipo:'file'},'fake path',false)).toBe(false);
    expect(validAssessmentAnswer({tipo:'file'},null,true)).toBe(true);
  });
});
