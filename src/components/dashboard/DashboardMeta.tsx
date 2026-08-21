/**
 * DashboardMeta — o tamanho do parque, em linha, no cabeçalho.
 *
 * Era uma faixa de oito pílulas com moldura, rolável na horizontal, ocupando
 * uma banda inteira da página. Duas coisas estavam erradas nisso:
 *
 *  1. **A forma prometia decisão e o conteúdo não tinha nenhuma.** Uma caixa
 *     com borda, fundo próprio e ícone colorido lê-se como um cartão de
 *     estado. O que lá está é contexto: quantos ativos existem, quantos
 *     documentos há. Ninguém age sobre "8 documentos".
 *
 *  2. **Contagem sem referência não se lê.** "11 Riscos" — onze é muito?
 *     Comparado com quê? Toda contagem passa a trazer o número que a qualifica
 *     ("11 riscos, 1 crítico"), que é o que decide se aquilo merece atenção.
 *
 * De passagem morre o "1 Incidentes abertos": o rótulo era string fixa no
 * plural, e com valor 1 mentia em português e em inglês.
 *
 * Continua clicável — cada entrada abre o mesmo drill-down de antes. O que
 * muda é o peso visual, não a função.
 */
import { useNavigate } from 'react-router-dom';
import {
  AtivosIcon,
  RiscosIcon,
  IncidentesIcon,
  DocumentosIcon,
  DueDiligenceIcon,
  DenunciasIcon,
  IconScale,
  IconChecklist,
} from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';

export type KpiKey =
  | 'ativos'
  | 'riscos'
  | 'incidentes'
  | 'planos'
  | 'contratos'
  | 'documentos'
  | 'due_diligence'
  | 'denuncias';

interface Entrada {
  key: KpiKey;
  icon: React.ElementType;
  /** Chave em `kpi.rotulo.*`, que traz singular e plural. */
  rotulo: string;
  value: number;
  route: string;
  /** O número que dá referência à contagem. Omitido quando é zero. */
  qualificador?: { n: number; palavra: string };
}

interface Props {
  ativos: number;
  activeIncidents: number;
  incidentsThisMonth: number;
  activeContracts: number;
  contractsExpiring: number;
  contractsExpired: number;
  activeDocs: number;
  totalDocs: number;
  docsExpiring: number;
  docsPending: number;
  totalRiscos: number;
  riscosCriticos: number;
  riscosAltos: number;
  planosPendentes: number;
  planosAtrasados: number;
  ddAtivos: number;
  ddExpirados: number;
  denunciasAbertas: number;
  denunciasNovas: number;
  onPillClick?: (key: KpiKey) => void;
}

export function DashboardMeta(props: Props) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  /**
   * Singular ou plural, decidido pelo número — nunca por uma string fixa.
   * O `count` liga o plural nativo do `t()`, o mesmo mecanismo que o resto do
   * produto já usava em `risksCount` e companhia.
   */
  const conta = (chave: string, n: number) => t(`kpi.rotulo.${chave}`, { count: n });
  const qualifica = (palavra: string, n: number) =>
    t(`kpi.qualificador.${palavra}`, { count: n });

  const entradas: Entrada[] = [
    {
      key: 'riscos',
      icon: RiscosIcon,
      rotulo: 'risks',
      value: props.totalRiscos,
      route: '/riscos',
      qualificador:
        props.riscosCriticos > 0
          ? { n: props.riscosCriticos, palavra: 'critical' }
          : props.riscosAltos > 0
            ? { n: props.riscosAltos, palavra: 'high' }
            : undefined,
    },
    {
      key: 'planos',
      icon: IconChecklist,
      rotulo: 'actionPlansOpen',
      value: props.planosPendentes,
      route: '/planos-acao',
      qualificador:
        props.planosAtrasados > 0 ? { n: props.planosAtrasados, palavra: 'overdue' } : undefined,
    },
    {
      key: 'incidentes',
      icon: IncidentesIcon,
      rotulo: 'incidentsOpen',
      value: props.activeIncidents,
      route: '/incidentes',
      qualificador:
        props.incidentsThisMonth > 0
          ? { n: props.incidentsThisMonth, palavra: 'month' }
          : undefined,
    },
    {
      key: 'ativos',
      icon: AtivosIcon,
      rotulo: 'assets',
      value: props.ativos,
      route: '/ativos',
    },
    {
      key: 'documentos',
      icon: DocumentosIcon,
      rotulo: 'documents',
      value: props.totalDocs,
      route: '/documentos',
      qualificador:
        props.docsExpiring > 0
          ? { n: props.docsExpiring, palavra: 'expiring' }
          : props.docsPending > 0
            ? { n: props.docsPending, palavra: 'pending' }
            : undefined,
    },
    {
      key: 'contratos',
      icon: IconScale,
      rotulo: 'contractsActive',
      value: props.activeContracts,
      route: '/contratos',
      qualificador:
        props.contractsExpired > 0
          ? { n: props.contractsExpired, palavra: 'expired' }
          : props.contractsExpiring > 0
            ? { n: props.contractsExpiring, palavra: 'expiring' }
            : undefined,
    },
    {
      key: 'due_diligence',
      icon: DueDiligenceIcon,
      rotulo: 'dueDiligenceActive',
      value: props.ddAtivos,
      route: '/due-diligence',
      // "avaliações vencidas" — feminino, ao contrário de contratos e documentos.
      qualificador:
        props.ddExpirados > 0 ? { n: props.ddExpirados, palavra: 'expiredFem' } : undefined,
    },
    {
      key: 'denuncias',
      icon: DenunciasIcon,
      rotulo: 'reportsOpen',
      value: props.denunciasAbertas,
      route: '/denuncia',
      qualificador:
        props.denunciasNovas > 0 ? { n: props.denunciasNovas, palavra: 'new' } : undefined,
    },
  ];

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {entradas.map((e) => (
        <li key={e.key}>
          <button
            type="button"
            onClick={() =>
              props.onPillClick ? props.onPillClick(e.key) : navigate(e.route)
            }
            className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs text-muted-foreground transition-ui hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* O ícone identifica o módulo e mais nada: um só cinzento, sem
                estado. Quem carrega o alarme é o número. */}
            <e.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            <span className="font-medium tabular-nums text-foreground">{e.value}</span>
            {/* Rótulo e qualificador numa só caixa: separados, o `gap` do flex
                metia um espaço antes da vírgula ("11 riscos , 1 crítico"). */}
            <span className="whitespace-nowrap">
              {conta(e.rotulo, e.value)}
              {e.qualificador && `, ${qualifica(e.qualificador.palavra, e.qualificador.n)}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
