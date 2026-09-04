import * as React from 'react';
import { BaseModuleIcon, type ModuleIconProps } from './_BaseModuleIcon';

/**
 * Ícones de navegação Akuris.
 *
 * O menu é a principal memória espacial do produto. Estes glifos não usam a
 * coleção de objetos genéricos: cada um foi desenhado na mesma grelha 24x24,
 * com o mesmo peso e uma silhueta diferente mesmo quando visto a 16px.
 */
const modulo = (nome: string, desenho: React.ReactNode) => {
  const Componente = React.forwardRef<SVGSVGElement, ModuleIconProps>((props, ref) => (
    <BaseModuleIcon ref={ref} {...props}>
      {desenho}
    </BaseModuleIcon>
  ));
  Componente.displayName = nome;
  return Componente;
};

/** Painel — núcleo de decisão enquadrado pelas quatro áreas monitorizadas. */
export const DashboardIcon = modulo(
  'DashboardIcon',
  <>
    <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
    <path d="m12 7 5 5-5 5-5-5 5-5Z" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
  </>,
);

/**
 * Planos de ação — prancheta com duas entregas verificáveis.
 *
 * A escada com seta anterior reduzia-se a um zigue-zague aos 16 px. A
 * prancheta dá contexto à lista e os dois vistos dizem execução, não apenas
 * direção.
 */
export const PlanosAcaoIcon = modulo(
  'PlanosAcaoIcon',
  <>
    <path d="M6 5h12v16H6Z" />
    <path d="M9 5V3h6v2" />
    <path d="m9 10 1.4 1.4L13 8" />
    <path d="M14.5 10H16" />
    <path d="m9 16 1.4 1.4L13 14" />
    <path d="M14.5 16H16" />
  </>,
);

/**
 * Projetos — pasta de trabalho com uma linha de três marcos.
 *
 * O trajeto solto anterior parecia uma seta quebrada. Pasta + marcos forma
 * uma silhueta reconhecível e continua distinta de Documento e Plano.
 */
export const ProjetosIcon = modulo(
  'ProjetosIcon',
  <>
    <path d="M3.5 7h6l2-3h9v16h-17Z" />
    <path d="M6.5 13h11" />
    <circle cx="7" cy="13" r="1.25" fill="currentColor" stroke="none" />
    <path d="m12 10.8 2.2 2.2-2.2 2.2-2.2-2.2 2.2-2.2Z" />
    <circle cx="17" cy="13" r="1.25" fill="currentColor" stroke="none" />
  </>,
);

/** Catálogo de frameworks — biblioteca estruturada em referencial e níveis. */
export const FrameworksIcon = modulo(
  'FrameworksIcon',
  <>
    <path d="M4 4h5v16H4Z" />
    <path d="M11 4h9v4h-9ZM11 10h9v4h-9ZM11 16h9v4h-9Z" />
  </>,
);

/** Gestão de ativos — inventário como três camadas coordenadas. */
export const GestaoAtivosIcon = modulo(
  'GestaoAtivosIcon',
  <>
    <path d="m12 3 8 4-8 4-8-4 8-4Z" />
    <path d="m4 11 8 4 8-4" />
    <path d="m4 15 8 4 8-4" />
  </>,
);

/** Licenças — documento técnico com selo incorporado. */
export const LicencasIcon = modulo(
  'LicencasIcon',
  <>
    <path d="M6 3h9l4 4v8" />
    <path d="M15 3v5h4" />
    <path d="M6 3v18h7" />
    <circle cx="17" cy="16" r="3" />
    <path d="m15.2 18.4-.7 3.1 2.5-1.3 2.5 1.3-.7-3.1" />
  </>,
);

/** Chaves — credencial física/digital com dentes assimétricos. */
export const ChavesIcon = modulo(
  'ChavesIcon',
  <>
    <circle cx="8" cy="9" r="4" />
    <path d="m10.8 11.8 8.2 8.2" />
    <path d="m15 16 2-2M17.5 18.5l2-2" />
  </>,
);

/** Contratos — duas partes ligadas pelo mesmo compromisso. */
export const ContratosIcon = modulo(
  'ContratosIcon',
  <>
    <path d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" />
    <path d="M14 6h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4" />
    <path d="M8 12h8" />
    <path d="m10.5 9.5-2.5 2.5 2.5 2.5M13.5 9.5 16 12l-2.5 2.5" />
  </>,
);

/** Privacidade — identidade protegida por uma área de visibilidade limitada. */
export const PrivacidadeIcon = modulo(
  'PrivacidadeIcon',
  <>
    <path d="M8 4H4v4M16 4h4v4M4 16v4h4M20 16v4h-4" />
    <circle cx="12" cy="10" r="3" />
    <path d="M7 18a5 5 0 0 1 10 0" />
  </>,
);

/** Gestão de acessos — portal controlado com ponto único de autorização. */
export const GestaoAcessosIcon = modulo(
  'GestaoAcessosIcon',
  <>
    <path d="M4 20V5h6v15M20 20V5h-6v15" />
    <path d="M10 12h4" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </>,
);

/** Sistemas — console técnico, diferente de ativo ou relatório. */
export const SistemasIcon = modulo(
  'SistemasIcon',
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18" />
    <circle cx="6" cy="6.5" r=".7" fill="currentColor" stroke="none" />
    <path d="m7 13 3 2.5L7 18M13 18h4" />
  </>,
);

/** Contas privilegiadas — identidade acompanhada por marca de autoridade. */
export const ContasPrivilegiadasIcon = modulo(
  'ContasPrivilegiadasIcon',
  <>
    <circle cx="9" cy="9" r="3" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="m18 4 2.5 2.5L18 9l-2.5-2.5L18 4Z" />
    <path d="M18 9v5" />
  </>,
);

/** Revisão de acessos — identidade enquadrada e decisão de aprovação. */
export const RevisaoAcessosIcon = modulo(
  'RevisaoAcessosIcon',
  <>
    <path d="M8 4H4v4M16 4h4v4M4 16v4h4" />
    <circle cx="10" cy="10" r="2.7" />
    <path d="M5.5 17a4.5 4.5 0 0 1 8-2.8" />
    <path d="m15 17 2 2 4-5" />
  </>,
);

/** Compliance — regra verificável, não um selo decorativo. */
export const ComplianceIcon = modulo(
  'ComplianceIcon',
  <>
    <path d="M5 3h14v18H5Z" />
    <path d="m8 10 2 2 5-5" />
    <path d="M8 16h8M8 18.5h5" />
  </>,
);

/** Continuidade — ciclo de recuperação envolvendo o pulso do negócio. */
export const ContinuidadeIcon = modulo(
  'ContinuidadeIcon',
  <>
    <path d="M18.5 8A8 8 0 0 0 5.8 5.7L4 7.5" />
    <path d="M5.5 16A8 8 0 0 0 18.2 18.3L20 16.5" />
    <path d="M4 4v3.5h3.5M20 20v-3.5h-3.5" />
    <path d="M7 12h2.5l2-3.5 2.7 7 1.8-3.5h1" />
  </>,
);

/** Relatórios — folha analítica com três séries, não um gráfico solto. */
export const RelatoriosIcon = modulo(
  'RelatoriosIcon',
  <>
    <path d="M5 3h14v18H5Z" />
    <path d="M8 7h8" />
    <path d="M8 17v-3M12 17v-6M16 17V9" />
    <path d="m10.5 5 1.5-1.5L13.5 5 12 6.5 10.5 5Z" />
  </>,
);

/** Configurações — engrenagem, a metáfora solicitada para parametrização. */
export const ConfiguracoesIcon = modulo(
  'ConfiguracoesIcon',
  <>
    <path d="M9.5 3h5l.6 2.2 2 .9 2-1.1 2.5 4.3-1.7 1.6v2.2l1.7 1.6-2.5 4.3-2-1.1-2 .9-.6 2.2h-5l-.6-2.2-2-.9-2 1.1-2.5-4.3 1.7-1.6v-2.2L2.4 9.3 4.9 5l2 1.1 2-.9L9.5 3Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

/** Sair — vão aberto e percurso para fora, legível mesmo a 16 px. */
export const SaidaIcon = modulo(
  'SaidaIcon',
  <>
    <path d="M13 4H5v16h8" />
    <path d="M10 12h10" />
    <path d="m17 9 3 3-3 3" />
    <path d="M5 4h10v4M15 16v4H5" opacity=".55" />
  </>,
);
