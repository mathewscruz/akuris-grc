import * as React from 'react';
import { BaseActionIcon, Ponto, type ActionIconProps } from './_BaseActionIcon';

/**
 * Ícones de objeto do Akuris — o que se VÊ.
 *
 * O escudo, a pessoa, o documento, o gráfico, a organização, o prazo. É onde
 * estava a maior parte do catálogo genérico: 851 usos de `lucide-react` em
 * 186 conceitos, muitos deles sinónimos da mesma ideia (`Shield`,
 * `ShieldCheck`, `ShieldAlert`, `ShieldQuestion`). Reduzir o vocabulário faz
 * tanto pela coerência como redesenhar.
 *
 * Regra do desenho, em `_BaseActionIcon`: o glifo parece-se com a coisa.
 * Um mundo é redondo, um alvo são círculos concêntricos, uma folha tem o
 * canto dobrado. Cantos e terminais redondos, traço 1.5.
 */

const icone = (nome: string, desenho: React.ReactNode) => {
  const C = React.forwardRef<SVGSVGElement, ActionIconProps>((props, ref) => (
    <BaseActionIcon ref={ref} {...props}>
      {desenho}
    </BaseActionIcon>
  ));
  C.displayName = nome;
  return C;
};

/** Mesma figura, rodada. Uma seta é uma seta — muda o sentido, não o desenho. */
const rodado = (nome: string, desenho: React.ReactNode, graus: number) =>
  icone(nome, <g transform={`rotate(${graus} 12 12)`}>{desenho}</g>);

/* ------------------------------------------------------------------ sentido */

const setaDireita = <><path d="M3.8 12h15" /><path d="M13.2 6.6 18.6 12l-5.4 5.4" /></>;

export const IconArrowRight = icone('IconArrowRight', setaDireita);
export const IconArrowLeft = rodado('IconArrowLeft', setaDireita, 180);
export const IconArrowUp = rodado('IconArrowUp', setaDireita, -90);
export const IconArrowDown = rodado('IconArrowDown', setaDireita, 90);

const chevron = <path d="M9.5 5.5 16 12l-6.5 6.5" />;

export const IconChevronDown = rodado('IconChevronDown', chevron, 90);
export const IconChevronUp = rodado('IconChevronUp', chevron, -90);
export const IconChevronLeft = rodado('IconChevronLeft', chevron, 180);

/** Seta na diagonal — sair, ir para fora. */
export const IconArrowUpRight = icone(
  'IconArrowUpRight',
  <><path d="M6.5 17.5 17.5 6.5" /><path d="M8.8 6.5h8.7v8.7" /></>,
);

/** Duas setas opostas — ordenar. */
export const IconSort = icone(
  'IconSort',
  <>
    <path d="M7.5 4.5v15" /><path d="M4 8l3.5-3.5L11 8" />
    <path d="M16.5 19.5v-15" /><path d="M13 16l3.5 3.5L20 16" />
  </>,
);

/** Linha ascendente com seta — tendência a subir. */
export const IconTrendUp = icone(
  'IconTrendUp',
  <><path d="M3.5 16.5 9 11l3.5 3.5L20.5 6.5" /><path d="M15.8 6.5h4.7v4.7" /></>,
);

/** Linha descendente com seta — tendência a descer. */
export const IconTrendDown = icone(
  'IconTrendDown',
  <><path d="M3.5 7.5 9 13l3.5-3.5 8 8" /><path d="M15.8 17.5h4.7v-4.7" /></>,
);

/* -------------------------------------------------------------- proteção */

const escudo = (
  <path d="M12 3.2 4.8 6v6.1c0 4.3 3 8.3 7.2 9.3 4.2-1 7.2-5 7.2-9.3V6L12 3.2Z" />
);

export const IconShield = icone('IconShield', escudo);
export const IconShieldCheck = icone('IconShieldCheck', <>{escudo}<path d="M9 11.8l2.2 2.2 4-4.2" /></>);
export const IconShieldAlert = icone(
  'IconShieldAlert',
  <>{escudo}<path d="M12 8v4.2" /><Ponto cx={12} cy={15.4} r={1.05} /></>,
);

/** Cadeado — trancado, restrito. */
export const IconLock = icone(
  'IconLock',
  <>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
    <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
  </>,
);

/** Chave — credencial. */
export const IconKey = icone(
  'IconKey',
  <><circle cx="8" cy="8" r="4.2" /><path d="M11 11l9.2 9.2" /><path d="M17.2 14.2l-2 2" /><path d="M20.2 17.2l-2 2" /></>,
);

/** Olho riscado — oculto. */
export const IconHide = icone(
  'IconHide',
  <>
    <path d="M9.6 6.1A9.5 9.5 0 0 1 12 5.8c5.7 0 9.5 6.2 9.5 6.2a17 17 0 0 1-2.9 3.6" />
    <path d="M6.2 8.3A17 17 0 0 0 2.5 12s3.8 6.2 9.5 6.2a9.7 9.7 0 0 0 3.8-.8" />
    <path d="M4 4l16 16" />
  </>,
);

/* ------------------------------------------------------------------ pessoas */

/** Cabeça e ombros — pessoa. */
export const IconPerson = icone(
  'IconPerson',
  <><circle cx="12" cy="8" r="3.8" /><path d="M4.6 20.3a7.6 7.6 0 0 1 14.8 0" /></>,
);

/** Duas pessoas — equipa, grupo. */
export const IconUsers = icone(
  'IconUsers',
  <>
    <circle cx="9.2" cy="8.2" r="3.5" />
    <path d="M2.8 20a6.6 6.6 0 0 1 12.8 0" />
    <path d="M16.4 5.2a3.5 3.5 0 0 1 0 6.6" />
    <path d="M17.8 14.4a6.6 6.6 0 0 1 3.4 4.6" />
  </>,
);

/** Pessoa com visto — aprovado, responsável confirmado. */
export const IconUserCheck = icone(
  'IconUserCheck',
  <>
    <circle cx="9.5" cy="8" r="3.7" />
    <path d="M2.8 20a6.9 6.9 0 0 1 11.3-4.3" />
    <path d="M15.4 17.6l2.2 2.2 4-4.4" />
  </>,
);

/** Pessoa riscada — inativo, removido. */
export const IconUserOff = icone(
  'IconUserOff',
  <>
    <circle cx="9.5" cy="8" r="3.7" />
    <path d="M2.8 20a6.9 6.9 0 0 1 11-4.6" />
    <path d="M16.4 15.6l5.2 5.2" /><path d="M21.6 15.6l-5.2 5.2" />
  </>,
);

/* --------------------------------------------------------------- documentos */

const folha = (
  <path d="M14 3.2H6.6A1.6 1.6 0 0 0 5 4.8v14.4a1.6 1.6 0 0 0 1.6 1.6h10.8a1.6 1.6 0 0 0 1.6-1.6V8.2L14 3.2Z" />
);
const dobra = <path d="M13.8 3.2v5h5.2" />;

export const IconFileCheck = icone('IconFileCheck', <>{folha}{dobra}<path d="M8.4 14.4l2.2 2.2 4-4.2" /></>);
export const IconFileText = icone(
  'IconFileText',
  <>{folha}{dobra}<path d="M8.2 12.6h7.6" /><path d="M8.2 16.4h7.6" /><path d="M8.2 8.8h3" /></>,
);

/** Pasta com aba — agrupamento de ficheiros. */
export const IconFolder = icone(
  'IconFolder',
  <><path d="M3.2 6.4a1.6 1.6 0 0 1 1.6-1.6h4.1l2.1 2.8h7.3a1.6 1.6 0 0 1 1.6 1.6v9.4a1.6 1.6 0 0 1-1.6 1.6H4.8a1.6 1.6 0 0 1-1.6-1.6V6.4Z" /></>,
);

/** Duas folhas — copiar. */
export const IconCopy = icone(
  'IconCopy',
  <>
    <rect x="8.4" y="8.4" width="11.6" height="11.6" rx="2" />
    <path d="M16 8.4V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.4" />
  </>,
);

/** Disquete — guardar. */
export const IconSave = icone(
  'IconSave',
  <>
    <path d="M4 6a2 2 0 0 1 2-2h10.3L20 7.7V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" />
    <path d="M8 4h8v4.6H8V4Z" /><path d="M7.4 20v-5.4h9.2V20" />
  </>,
);

/** Clipe — anexo. */
export const IconAttach = icone(
  'IconAttach',
  <><path d="M17.6 8.4 9.9 16a2.6 2.6 0 0 1-3.7-3.7l8.2-8.2a4.3 4.3 0 0 1 6.1 6.1l-8.2 8.2a6 6 0 0 1-8.5-8.5l7.3-7.3" /></>,
);

/** Livro aberto — biblioteca, referência. */
export const IconBook = icone(
  'IconBook',
  <><path d="M12 6.6 4 4.4v14.2l8 2.2 8-2.2V4.4L12 6.6Z" /><path d="M12 6.6v14.2" /></>,
);

/** Prancheta com visto — lista de verificação. */
export const IconChecklist = icone(
  'IconChecklist',
  <>
    <path d="M9 4.4H6.4a1.6 1.6 0 0 0-1.6 1.6v13.4a1.6 1.6 0 0 0 1.6 1.6h11.2a1.6 1.6 0 0 0 1.6-1.6V6a1.6 1.6 0 0 0-1.6-1.6H15" />
    <rect x="8.8" y="2.6" width="6.4" height="3.6" rx="1.2" />
    <path d="M8.4 12.6l1.8 1.8 3.4-3.6" /><path d="M8.4 17.6h7.2" />
  </>,
);

/** Marcas e linhas — lista. */
export const IconList = icone(
  'IconList',
  <>
    <Ponto cx={4.8} cy={7} r={1.1} /><path d="M9 7h10.5" />
    <Ponto cx={4.8} cy={12} r={1.1} /><path d="M9 12h10.5" />
    <Ponto cx={4.8} cy={17} r={1.1} /><path d="M9 17h10.5" />
  </>,
);

/** Caixa com visto — seleção. */
export const IconCheckbox = icone(
  'IconCheckbox',
  <><rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3" /><path d="M8.2 12.2l2.6 2.6 5-5.4" /></>,
);

/* ------------------------------------------------------------------ medidas */

/** Barras — gráfico. */
export const IconChart = icone(
  'IconChart',
  <><path d="M4 20h16" /><path d="M7.2 20v-6" /><path d="M12 20V7.5" /><path d="M16.8 20v-9" /></>,
);

/** Linha sobre eixo — evolução. */
export const IconChartLine = icone(
  'IconChartLine',
  <><path d="M4 4v16h16" /><path d="M7.2 15.8 11 12l3 3 5-6" /></>,
);

/** Disco repartido — distribuição. */
export const IconChartPie = icone(
  'IconChartPie',
  <><circle cx="12" cy="12" r="8.8" /><path d="M12 3.2V12h8.8" /></>,
);

/** Traçado de sinal — atividade. */
export const IconActivity = icone('IconActivity', <path d="M2.6 12h4.8l3-7.2 4 14.4 3-7.2h4" />);

/** Mostrador com ponteiro — medidor. */
export const IconGauge = icone(
  'IconGauge',
  <><path d="M3.4 18a9.6 9.6 0 1 1 17.2 0" /><path d="M12 18l4-5.2" /><Ponto cx={12} cy={18} r={1.3} /></>,
);

/** Círculos concêntricos — alvo, meta. */
export const IconTarget = icone(
  'IconTarget',
  <><circle cx="12" cy="12" r="8.8" /><circle cx="12" cy="12" r="4.4" /><Ponto cx={12} cy={12} r={1.3} /></>,
);

/** Balança — conformidade, equilíbrio. */
export const IconScale = icone(
  'IconScale',
  <>
    <path d="M12 4.4v16" /><path d="M6.6 20.4h10.8" /><path d="M4 7.6h16" />
    <path d="M6.2 7.6 3 14.2h6.4L6.2 7.6Z" /><path d="M17.8 7.6l-3.2 6.6H21l-3.2-6.6Z" />
  </>,
);

/* -------------------------------------------------------------- organização */

/** Prédio — organização, empresa. */
export const IconOrg = icone(
  'IconOrg',
  <>
    <path d="M3.4 20.6V6.2a1.4 1.4 0 0 1 1-1.35l5.6-1.6a1.4 1.4 0 0 1 1.8 1.35v15.9" />
    <path d="M11.8 10.4h7.4a1.4 1.4 0 0 1 1.4 1.4v8.8" />
    <path d="M2.6 20.6h18.8" />
    <path d="M6.4 8.6h1.6" /><path d="M6.4 12.4h1.6" /><path d="M6.4 16.2h1.6" />
    <path d="M15.4 14.4h1.6" /><path d="M15.4 17.6h1.6" />
  </>,
);

/** Mundo — jurisdição, idioma. */
export const IconGlobe = icone(
  'IconGlobe',
  <>
    <circle cx="12" cy="12" r="8.8" /><path d="M3.2 12h17.6" />
    <path d="M12 3.2a13.4 13.4 0 0 1 0 17.6 13.4 13.4 0 0 1 0-17.6Z" />
  </>,
);

/** Alfinete — localização. */
export const IconPin = icone(
  'IconPin',
  <><path d="M19 10.2c0 5.2-7 11-7 11s-7-5.8-7-11a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2.6" /></>,
);

/** Dois elos — vínculo, ligação. */
export const IconLink = icone(
  'IconLink',
  <>
    <path d="M10.2 13.8a3.8 3.8 0 0 0 5.6.4l2.8-2.8a3.8 3.8 0 0 0-5.4-5.4l-1.6 1.6" />
    <path d="M13.8 10.2a3.8 3.8 0 0 0-5.6-.4l-2.8 2.8a3.8 3.8 0 0 0 5.4 5.4l1.6-1.6" />
  </>,
);

/** Tomada — integração. */
export const IconPlug = icone(
  'IconPlug',
  <>
    <path d="M9 3.4v4.4" /><path d="M15 3.4v4.4" />
    <path d="M6.4 7.8h11.2v3.6a5.6 5.6 0 0 1-11.2 0V7.8Z" />
    <path d="M12 17v3.6" />
  </>,
);

/** Cilindro — base de dados. */
export const IconDatabase = icone(
  'IconDatabase',
  <>
    <ellipse cx="12" cy="6" rx="8" ry="3.2" />
    <path d="M4 6v12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V6" />
    <path d="M4 12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2" />
  </>,
);

/** Duas unidades em rack — servidor. */
export const IconServer = icone(
  'IconServer',
  <>
    <rect x="3.4" y="4" width="17.2" height="6.4" rx="1.8" />
    <rect x="3.4" y="13.6" width="17.2" height="6.4" rx="1.8" />
    <Ponto cx={7} cy={7.2} r={1.05} /><Ponto cx={7} cy={16.8} r={1.05} />
  </>,
);

/** Caixa — ativo, pacote. */
export const IconPackage = icone(
  'IconPackage',
  <><path d="M12 2.6 20.4 7v10L12 21.4 3.6 17V7L12 2.6Z" /><path d="M3.6 7 12 11.6 20.4 7" /><path d="M12 11.6v9.8" /></>,
);

/** Lâminas sobrepostas — camadas. */
export const IconLayers = icone(
  'IconLayers',
  <><path d="M12 2.8 21 7.4 12 12 3 7.4l9-4.6Z" /><path d="M3 12.4 12 17l9-4.6" /><path d="M3 17.2 12 21.8l9-4.6" /></>,
);

/* -------------------------------------------------------------- comunicação */

/** Envelope — e-mail. */
export const IconMail = icone(
  'IconMail',
  <><rect x="3" y="5" width="18" height="14" rx="2.4" /><path d="M3.6 6.6 12 12.8l8.4-6.2" /></>,
);

/** Bolacha com mordida — cookies e rastreadores web. */
export const IconCookie = icone(
  'IconCookie',
  <>
    <path d="M20.6 13.1A8.7 8.7 0 1 1 10.9 3.4a4.2 4.2 0 0 0 5.7 4.3 4.2 4.2 0 0 0 4 5.4Z" />
    <Ponto cx={8.6} cy={9.3} r={1.05} />
    <Ponto cx={8.8} cy={15.5} r={1.05} />
    <Ponto cx={14.1} cy={15.1} r={1.05} />
  </>,
);

/** Balão — mensagem, comentário. */
export const IconMessage = icone(
  'IconMessage',
  <><path d="M20.5 15.2a2.4 2.4 0 0 1-2.4 2.4H8.4L4 21.2V6a2.4 2.4 0 0 1 2.4-2.4h11.7A2.4 2.4 0 0 1 20.5 6v9.2Z" /></>,
);

/** Sino — notificação. */
export const IconBell = icone(
  'IconBell',
  <><path d="M18.4 16.4V10.6a6.4 6.4 0 1 0-12.8 0v5.8L4 18.4h16l-1.6-2Z" /><path d="M10 21.2a2.4 2.4 0 0 0 4 0" /></>,
);

/** Aparelho — telemóvel, dispositivo. */
export const IconPhone = icone(
  'IconPhone',
  <><rect x="6.6" y="2.4" width="10.8" height="19.2" rx="2.6" /><path d="M10.4 18.8h3.2" /></>,
);

/** Nó e ramos — partilhar. */
export const IconShare = icone(
  'IconShare',
  <>
    <circle cx="6.2" cy="12" r="2.6" /><circle cx="17.8" cy="6.2" r="2.6" /><circle cx="17.8" cy="17.8" r="2.6" />
    <path d="M8.6 10.8 15.4 7.4" /><path d="M8.6 13.2l6.8 3.4" />
  </>,
);

/* ------------------------------------------------------------------- tempo */

/** Relógio com seta de retorno — histórico. */
export const IconHistory = icone(
  'IconHistory',
  <>
    <path d="M3.6 9.4A8.8 8.8 0 1 1 3.2 13" />
    <path d="M2.8 4.6v4.8h4.8" /><path d="M12 7.6V12l3.2 2" />
  </>,
);

/** Cronómetro — prazo em curso. */
export const IconTimer = icone(
  'IconTimer',
  <><path d="M9.4 2.6h5.2" /><path d="M12 2.6v3" /><circle cx="12" cy="13.4" r="8" /><path d="M12 9.6v3.8h3.2" /></>,
);

/** Data com relógio — prazo marcado. */
export const IconCalendarClock = icone(
  'IconCalendarClock',
  <>
    <path d="M20.5 11V8a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 8v10A2.5 2.5 0 0 0 6 20.5h5" />
    <path d="M3.5 10h17" /><path d="M8 3.5v4" /><path d="M16 3.5v4" />
    <circle cx="17.4" cy="17.4" r="4.2" /><path d="M17.4 15.6v1.8h1.6" />
  </>,
);

/* ------------------------------------------------------------- ferramentas */

/** Três cursores — definições. Não é uma roda dentada: a roda dentada é o
 *  glifo mais gasto que existe, e um cursor diz melhor "ajustar". */
export const IconSettings = icone(
  'IconSettings',
  <>
    <path d="M3.4 7h15.2" /><circle cx="9" cy="7" r="2.2" />
    <path d="M5.4 12h15.2" /><circle cx="16" cy="12" r="2.2" />
    <path d="M3.4 17h15.2" /><circle cx="8" cy="17" r="2.2" />
  </>,
);

/** Lâmpada — ideia, recomendação. */
export const IconIdea = icone(
  'IconIdea',
  <><path d="M9.2 16.4a6 6 0 1 1 5.6 0v1.8H9.2v-1.8Z" /><path d="M10 20.6h4" /></>,
);

/** Frasco — teste, ensaio. */
export const IconTest = icone(
  'IconTest',
  <><path d="M9.4 3h5.2" /><path d="M10.2 3v6.4L4.6 18.6A1.6 1.6 0 0 0 6 21h12a1.6 1.6 0 0 0 1.4-2.4l-5.6-9.2V3" /><path d="M7.4 15.4h9.2" /></>,
);

/** Raio — automação, ação imediata. */
export const IconBolt = icone('IconBolt', <path d="M13.2 2.4 4.4 13.4h6.2l-1.8 8.2 8.8-11h-6.2l1.8-8.2Z" />);

/** Círculo com interrogação — ajuda. */
export const IconHelp = icone(
  'IconHelp',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.6a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.6" />
    <Ponto cx={12} cy={16.6} r={1.05} />
  </>,
);

/** Etiqueta com furo — categoria, marcador. */
export const IconTag = icone(
  'IconTag',
  <><path d="M3.2 4.4a1.2 1.2 0 0 1 1.2-1.2h5.6l10 10a1.7 1.7 0 0 1 0 2.4l-5.2 5.2a1.7 1.7 0 0 1-2.4 0l-10-10V4.4Z" /><Ponto cx={7.4} cy={7.4} r={1.2} /></>,
);

/** Bandeira — marco, prioridade. */
export const IconFlag = icone(
  'IconFlag',
  <><path d="M5 3.4v17.2" /><path d="M5 4.4h13l-2.8 4 2.8 4H5" /></>,
);

/** Estrela — favorito. */
export const IconStar = icone(
  'IconStar',
  <><path d="m12 3.2 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.7l6.1-.9L12 3.2Z" /></>,
);

/** Medalha — reconhecimento, certificação. */
export const IconAward = icone(
  'IconAward',
  <><circle cx="12" cy="8.6" r="5.4" /><path d="M8.6 13.4 7.2 21.2 12 18.4l4.8 2.8-1.4-7.8" /></>,
);

/** Caixa com tampa — arquivo. */
export const IconArchive = icone(
  'IconArchive',
  <><rect x="3.2" y="3.8" width="17.6" height="4.4" rx="1.4" /><path d="M4.8 8.2v10.4a1.6 1.6 0 0 0 1.6 1.6h11.2a1.6 1.6 0 0 0 1.6-1.6V8.2" /><path d="M10.2 12h3.6" /></>,
);

/** Moldura com horizonte — imagem. */
export const IconImage = icone(
  'IconImage',
  <>
    <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2.6" />
    <path d="M3.8 16.6 8.8 11.6l3.4 3.4 2.6-2.6 4 4" />
    <circle cx="9" cy="8.6" r="1.5" />
  </>,
);

/** Quatro células — grelha. */
export const IconGrid = icone(
  'IconGrid',
  <>
    <rect x="3.6" y="3.6" width="7.2" height="7.2" rx="1.8" />
    <rect x="13.2" y="3.6" width="7.2" height="7.2" rx="1.8" />
    <rect x="3.6" y="13.2" width="7.2" height="7.2" rx="1.8" />
    <rect x="13.2" y="13.2" width="7.2" height="7.2" rx="1.8" />
  </>,
);

/** Faixas empilhadas — linhas. */
export const IconRows = icone(
  'IconRows',
  <>
    <rect x="3.4" y="4.6" width="17.2" height="4.6" rx="1.5" />
    <rect x="3.4" y="10.9" width="17.2" height="4.6" rx="1.5" />
    <rect x="3.4" y="17.2" width="17.2" height="3.4" rx="1.5" />
  </>,
);

/** Moldura com cabeçalho e coluna — tabela. */
export const IconTable = icone(
  'IconTable',
  <><rect x="3.4" y="3.8" width="17.2" height="16.4" rx="2.4" /><path d="M3.4 9.2h17.2" /><path d="M10 9.2v11" /></>,
);

/* -------------------------------------------------------------- controlos */

export const IconMinus = icone('IconMinus', <path d="M5 12h14" />);
export const IconPlay = icone('IconPlay', <path d="M7.4 4.6 19 12 7.4 19.4V4.6Z" />);
export const IconPause = icone('IconPause', <><path d="M9.2 4.6v14.8" /><path d="M14.8 4.6v14.8" /></>);
export const IconStop = icone('IconStop', <rect x="5.4" y="5.4" width="13.2" height="13.2" rx="2.4" />);

/** Seta de retorno — desfazer. */
export const IconUndo = icone(
  'IconUndo',
  <><path d="M8.6 6 3.8 10.8l4.8 4.8" /><path d="M3.8 10.8h9.6a6.8 6.8 0 0 1 6.8 6.8v1.6" /></>,
);

/** Cantos a abrir — expandir. */
export const IconExpand = icone(
  'IconExpand',
  <><path d="M4 9.6V4h5.6" /><path d="M20 14.4V20h-5.6" /><path d="M4 4l6 6" /><path d="M20 20l-6-6" /></>,
);

/** Cantos a fechar — recolher. */
export const IconCollapse = icone(
  'IconCollapse',
  <><path d="M9.6 4v5.6H4" /><path d="M14.4 20v-5.6H20" /><path d="M3.4 3.4l6.2 6.2" /><path d="M20.6 20.6l-6.2-6.2" /></>,
);

/** Duas colunas de pontos — arrastar. */
export const IconDrag = icone(
  'IconDrag',
  <>
    <Ponto cx={9.4} cy={6.4} r={1.3} /><Ponto cx={9.4} cy={12} r={1.3} /><Ponto cx={9.4} cy={17.6} r={1.3} />
    <Ponto cx={14.6} cy={6.4} r={1.3} /><Ponto cx={14.6} cy={12} r={1.3} /><Ponto cx={14.6} cy={17.6} r={1.3} />
  </>,
);

/** Porta com seta — terminar sessão. */
export const IconLogout = icone(
  'IconLogout',
  <><path d="M14.4 4.4H6.4a2 2 0 0 0-2 2v11.2a2 2 0 0 0 2 2h8" /><path d="M10.4 12h10.2" /><path d="M17.4 8.6 20.8 12l-3.4 3.4" /></>,
);

/** Sol — claro. */
export const IconSun = icone(
  'IconSun',
  <>
    <circle cx="12" cy="12" r="4.4" />
    <path d="M12 2.6v2.2" /><path d="M12 19.2v2.2" /><path d="M2.6 12h2.2" /><path d="M19.2 12h2.2" />
    <path d="M5.4 5.4l1.6 1.6" /><path d="M17 17l1.6 1.6" /><path d="M18.6 5.4 17 7" /><path d="M7 17l-1.6 1.6" />
  </>,
);

/** Crescente — escuro. */
export const IconMoon = icone(
  'IconMoon',
  <><path d="M20.4 14.6A8.8 8.8 0 0 1 9.4 3.6a8.8 8.8 0 1 0 11 11Z" /></>,
);

/** Cifrão — valor, custo. */
export const IconMoney = icone(
  'IconMoney',
  <><path d="M12 3.4v17.2" /><path d="M16.4 7H9.8a2.9 2.9 0 0 0 0 5.8h4.4a2.9 2.9 0 0 1 0 5.8H7.2" /></>,
);

/** Cartão — pagamento. */
export const IconCard = icone(
  'IconCard',
  <><rect x="2.8" y="5.4" width="18.4" height="13.2" rx="2.4" /><path d="M2.8 10h18.4" /><path d="M6.4 14.4h3.6" /></>,
);

/** Inseto — defeito, incidente técnico. */
export const IconBug = icone(
  'IconBug',
  <>
    <path d="M8.6 6.4a3.4 3.4 0 0 1 6.8 0" />
    <path d="M6.4 9.4h11.2v5.2a5.6 5.6 0 0 1-11.2 0V9.4Z" />
    <path d="M4 10.4H6.4" /><path d="M17.6 10.4H20" /><path d="M4 16H6.6" /><path d="M17.4 16H20" />
  </>,
);

/** Duas mãos — acordo, contraparte. */
export const IconHandshake = icone(
  'IconHandshake',
  <><path d="M2.6 10.4 7 7l5 2.6L17 7l4.4 3.4" /><path d="M7 12.4 12 17l5-4.6" /><path d="M12 9.6V17" /></>,
);

/** Pasta com pega — trabalho, responsabilidade profissional. */
export const IconBriefcase = icone(
  'IconBriefcase',
  <>
    <rect x="3" y="7.2" width="18" height="12.6" rx="2.2" />
    <path d="M8.4 7.2V5.4A1.8 1.8 0 0 1 10.2 3.6h3.6a1.8 1.8 0 0 1 1.8 1.8v1.8" />
    <path d="M3 12.2c5.7 2.4 12.3 2.4 18 0" /><path d="M10.2 13.8h3.6" />
  </>,
);

/** Pessoa com sinal de adição — admissão, cadastro de colaborador. */
export const IconUserAdd = icone(
  'IconUserAdd',
  <>
    <circle cx="9" cy="7.4" r="3.4" />
    <path d="M2.8 20a6.4 6.4 0 0 1 11.4-4" />
    <path d="M18.2 13.8v6.4M15 17h6.4" />
  </>,
);

/** Casa — trabalho remoto e ambiente residencial. */
export const IconHome = icone(
  'IconHome',
  <>
    <path d="m3.2 10.2 8.8-7 8.8 7" />
    <path d="M5.4 9.2v11h13.2v-11" />
    <path d="M9.4 20.2v-6.4h5.2v6.4" />
  </>,
);

/** Ponto — marcador neutro. */
export const IconDot = icone('IconDot', <Ponto cx={12} cy={12} r={3.4} />);

/* -------------------------------------------------- desambiguação de menu */
/* Reduzir 186 conceitos genéricos a ~110 glifos ganhou coerência e perdeu    */
/* distinção: dois itens de menu ficaram com o mesmo desenho. Estes existem   */
/* para os separar, porque o ícone só serve para alguma coisa se identificar. */

/** Painel largo com dois blocos — visão geral. Não confundir com `IconGrid`,
 *  que são quatro células iguais e quer dizer "grelha". */
export const IconDashboard = icone(
  'IconDashboard',
  <>
    <rect x="3.4" y="3.4" width="7.4" height="17.2" rx="2" />
    <rect x="13.2" y="3.4" width="7.4" height="7" rx="2" />
    <rect x="13.2" y="13.6" width="7.4" height="7" rx="2" />
  </>,
);

/** Três colunas de alturas diferentes — quadro de trabalho, projeto. */
export const IconBoard = icone(
  'IconBoard',
  <>
    <rect x="3.4" y="3.4" width="4.8" height="11.6" rx="1.6" />
    <rect x="9.6" y="3.4" width="4.8" height="17.2" rx="1.6" />
    <rect x="15.8" y="3.4" width="4.8" height="8" rx="1.6" />
  </>,
);

/** Documento com roseta — licença, certificado. */
export const IconLicense = icone(
  'IconLicense',
  <>
    <path d="M13.4 3.2H6.4A1.6 1.6 0 0 0 4.8 4.8v14.4a1.6 1.6 0 0 0 1.6 1.6h3.2" />
    <path d="M13.2 3.2v5h5.2V11" />
    <circle cx="16.4" cy="15.4" r="3.2" />
    <path d="M14.2 17.8 13.4 21.4l3-1.5 3 1.5-.8-3.6" />
  </>,
);

/** Pessoa com chave — gestão de acessos. */
export const IconAccess = icone(
  'IconAccess',
  <>
    <circle cx="8.6" cy="7.4" r="3.4" />
    <path d="M2.4 19.6a6.4 6.4 0 0 1 10.2-4.4" />
    <circle cx="17.2" cy="15.4" r="2.4" />
    <path d="m19 17.2 3.2 3.2" /><path d="m21.4 19.6-1.2 1.2" />
  </>,
);

/** Boia — continuidade de negócio. */
export const IconLifebuoy = icone(
  'IconLifebuoy',
  <>
    <circle cx="12" cy="12" r="8.8" /><circle cx="12" cy="12" r="3.8" />
    <path d="m5.8 5.8 3.5 3.5" /><path d="m14.7 14.7 3.5 3.5" />
    <path d="m18.2 5.8-3.5 3.5" /><path d="m9.3 14.7-3.5 3.5" />
  </>,
);

/** Círculo cortado — cancelado, revogado. Um estado que foi retirado não é o
 *  mesmo que um estado que falhou: `IconError` é falha, este é retirada. */
export const IconBan = icone(
  'IconBan',
  <><circle cx="12" cy="12" r="8.8" /><path d="m5.8 5.8 12.4 12.4" /></>,
);

/** Taça — excelente. Separa o topo da escala do simples "conforme". */
export const IconTrophy = icone(
  'IconTrophy',
  <>
    <path d="M8 3.8h8v5.4a4 4 0 0 1-8 0V3.8Z" />
    <path d="M8 5.4H5.4v1.4a3 3 0 0 0 2.4 2.9" />
    <path d="M16 5.4h2.6v1.4a3 3 0 0 1-2.4 2.9" />
    <path d="M12 13.2v3.4" /><path d="M9.6 16.6h4.8v3.8H9.6v-3.8Z" />
    <path d="M7.6 20.4h8.8" />
  </>,
);

/** Megafone — denúncia, comunicado. */
export const IconMegaphone = icone(
  'IconMegaphone',
  <>
    <path d="M4 10.2v3.6a2.2 2.2 0 0 0 2.2 2.2H7.4l9.2 4.2V3.8L7.4 8H6.2A2.2 2.2 0 0 0 4 10.2Z" />
    <path d="M19.4 9.4a3.4 3.4 0 0 1 0 5.2" /><path d="M7.4 16v4.2h3" />
  </>,
);

/** Hierarquia — referencial, framework. Um alvo é a meta; isto é a estrutura
 *  que se usa para lá chegar. */
export const IconFramework = icone(
  'IconFramework',
  <>
    <rect x="8.8" y="3" width="6.4" height="4.6" rx="1.4" />
    <rect x="2.6" y="16.4" width="6.4" height="4.6" rx="1.4" />
    <rect x="15" y="16.4" width="6.4" height="4.6" rx="1.4" />
    <path d="M12 7.6v3.4" /><path d="M5.8 16.4v-2.6h12.4v2.6" />
  </>,
);

/** Selo com visto — conformidade como disciplina. Diferencia a área de
 *  Compliance de um simples estado de sucesso (`IconSuccess`). */
export const IconCompliance = icone(
  'IconCompliance',
  <>
    <path d="M12 2.8 14.4 5l3.2-.1.7 3 2.5 1.9-1.2 2.8 1.2 2.8-2.5 1.9-.7 3-3.2-.1L12 21.2 9.6 19l-3.2.1-.7-3-2.5-1.9 1.2-2.8-1.2-2.8 2.5-1.9.7-3 3.2.1Z" />
    <path d="m8.3 12.1 2.3 2.3 5-5" />
  </>,
);

/* ------------------------------------------------------------------- cauda */

/** Dois chevrons — código, técnico. */
export const IconCode = icone('IconCode', <><path d="M9 7.6 4 12l5 4.4" /><path d="M15 7.6 20 12l-5 4.4" /></>);

/** Haste e arco — ligar, desligar. */
export const IconPower = icone(
  'IconPower',
  <><path d="M12 3.4v8.2" /><path d="M6.8 6.6a7.6 7.6 0 1 0 10.4 0" /></>,
);

/** Tronco com derivação — fluxo, ramificação. */
export const IconBranch = icone(
  'IconBranch',
  <>
    <circle cx="6.4" cy="5.6" r="2.4" /><circle cx="6.4" cy="18.4" r="2.4" /><circle cx="17.6" cy="8.4" r="2.4" />
    <path d="M6.4 8v8" /><path d="M17.6 10.8a5.2 5.2 0 0 1-5.2 5.2H8.8" />
  </>,
);

/** Folha com nervura — ambiental, ESG. */
export const IconLeaf = icone(
  'IconLeaf',
  <><path d="M20.4 3.6C10.8 3.6 4.4 8.4 4.4 15.2a5.2 5.2 0 0 0 5.2 5.2c6.8 0 10.8-7.2 10.8-16.8Z" /><path d="M4.6 20.2 12.4 12" /></>,
);

/** Visor e teclas — cálculo. */
export const IconCalculator = icone(
  'IconCalculator',
  <>
    <rect x="4.6" y="2.8" width="14.8" height="18.4" rx="2.4" />
    <path d="M8 6.6h8v3.2H8V6.6Z" />
    <Ponto cx={8.4} cy={13.6} r={1.05} /><Ponto cx={12} cy={13.6} r={1.05} /><Ponto cx={15.6} cy={13.6} r={1.05} />
    <Ponto cx={8.4} cy={17.4} r={1.05} /><Ponto cx={12} cy={17.4} r={1.05} /><Ponto cx={15.6} cy={17.4} r={1.05} />
  </>,
);

/** Rosto — reação. */
export const IconReaction = icone(
  'IconReaction',
  <>
    <circle cx="12" cy="12" r="9" />
    <Ponto cx={9.2} cy={10} r={1.05} /><Ponto cx={14.8} cy={10} r={1.05} />
    <path d="M8.4 14.4a4.4 4.4 0 0 0 7.2 0" />
  </>,
);

/** Âncoras e miolo — código legível por máquina. */
export const IconQr = icone(
  'IconQr',
  <>
    <rect x="3.6" y="3.6" width="6.8" height="6.8" rx="1.6" />
    <rect x="13.6" y="3.6" width="6.8" height="6.8" rx="1.6" />
    <rect x="3.6" y="13.6" width="6.8" height="6.8" rx="1.6" />
    <path d="M13.6 13.6h2.8v2.8" /><path d="M20.4 17.6v2.8h-2.8" />
  </>,
);

/** Nuvem — serviço externo. */
export const IconCloud = icone(
  'IconCloud',
  <><path d="M17.4 19.4H7a4.6 4.6 0 0 1-.6-9.2 6.2 6.2 0 0 1 11.8 1.6 4 4 0 0 1-.8 7.6Z" /></>,
);

/** Pastilha com pinos — processamento. */
export const IconChip = icone(
  'IconChip',
  <>
    <rect x="6.8" y="6.8" width="10.4" height="10.4" rx="2" />
    <path d="M9.8 3.4v3.4" /><path d="M14.2 3.4v3.4" /><path d="M9.8 17.2v3.4" /><path d="M14.2 17.2v3.4" />
    <path d="M3.4 9.8h3.4" /><path d="M3.4 14.2h3.4" /><path d="M17.2 9.8h3.4" /><path d="M17.2 14.2h3.4" />
  </>,
);

/** Écran sobre pé — estação de trabalho. */
export const IconMonitor = icone(
  'IconMonitor',
  <><rect x="2.8" y="4" width="18.4" height="12.4" rx="2.2" /><path d="M12 16.4v3.6" /><path d="M8.6 20h6.8" /></>,
);
