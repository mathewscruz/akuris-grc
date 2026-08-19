import * as React from 'react';
import { BaseActionIcon, Ponto, type ActionIconProps } from './_BaseActionIcon';

/**
 * Ícones de ação do Akuris — o que se FAZ.
 *
 * Acrescentar, fechar, procurar, filtrar, editar, excluir, descarregar,
 * carregar, ver, abrir fora, mais ações, e os cinco estados.
 *
 * Gramática em `_BaseActionIcon`: grelha 24, desenho em 20, traço 1.5,
 * terminais e cantos redondos. A forma segue o objeto — a lupa é redonda
 * porque uma lupa é redonda.
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

/** Cruz — acrescentar. */
export const IconAdd = icone('IconAdd', <><path d="M12 5v14" /><path d="M5 12h14" /></>);

/** Cruz inclinada — fechar. */
export const IconClose = icone('IconClose', <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>);

/** Lente e cabo — procurar. */
export const IconSearch = icone(
  'IconSearch',
  <><circle cx="11" cy="11" r="7" /><path d="M16.2 16.2L21 21" /></>,
);

/** Funil — filtrar. */
export const IconFilter = icone(
  'IconFilter',
  <><path d="M4 5.5h16l-6.2 7.3v5.7l-3.6 1.8v-7.5L4 5.5Z" /></>,
);

/** Lápis com ponta — editar. */
export const IconEdit = icone(
  'IconEdit',
  <>
    <path d="M4.5 19.5h3.6L19 8.6a2.2 2.2 0 0 0-3.1-3.1L4.9 16.4v3.1Z" />
    <path d="M14.8 6.6l2.6 2.6" />
  </>,
);

/** Contentor com tampa — excluir. */
export const IconDelete = icone(
  'IconDelete',
  <>
    <path d="M4 6.5h16" />
    <path d="M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7" />
    <path d="M6.5 6.5l.9 12.2a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12.2" />
    <path d="M10.3 10.5v5.6" /><path d="M13.7 10.5v5.6" />
  </>,
);

/** Seta para a bandeja — descarregar. */
export const IconDownload = icone(
  'IconDownload',
  <><path d="M12 3.8v10.8" /><path d="M7.8 10.6L12 14.8l4.2-4.2" /><path d="M4.5 19.5h15" /></>,
);

/** Seta a partir da bandeja — carregar. */
export const IconUpload = icone(
  'IconUpload',
  <><path d="M12 15.4V4.6" /><path d="M7.8 8.8L12 4.6l4.2 4.2" /><path d="M4.5 19.5h15" /></>,
);

/** Olho — ver. */
export const IconView = icone(
  'IconView',
  <>
    <path d="M2.5 12S6.3 5.8 12 5.8 21.5 12 21.5 12 17.7 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </>,
);

/** Seta a sair da moldura — abrir fora. */
export const IconExternal = icone(
  'IconExternal',
  <>
    <path d="M18 13.5v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h5" />
    <path d="M14.5 4h5.5v5.5" /><path d="M20 4l-8.5 8.5" />
  </>,
);

/** Três pontos — mais ações. */
export const IconMore = icone(
  'IconMore',
  <><Ponto cx={5.5} cy={12} /><Ponto cx={12} cy={12} /><Ponto cx={18.5} cy={12} /></>,
);

/** Visto — concluído. */
export const IconCheck = icone('IconCheck', <path d="M4.5 12.5l5 5L19.5 6.5" />);

const circulo = <circle cx="12" cy="12" r="9" />;

/** Círculo com visto — estado concluído. */
export const IconSuccess = icone('IconSuccess', <>{circulo}<path d="M8.2 12.2l2.6 2.6 5-5.2" /></>);

/** Triângulo com haste — atenção. */
export const IconWarning = icone(
  'IconWarning',
  <>
    <path d="M10.7 4.2 2.6 18a1.5 1.5 0 0 0 1.3 2.2h16.2a1.5 1.5 0 0 0 1.3-2.2L13.3 4.2a1.5 1.5 0 0 0-2.6 0Z" />
    <path d="M12 9.6v4.2" /><Ponto cx={12} cy={17} r={1.1} />
  </>,
);

/** Círculo com "i" — informação. */
export const IconInfo = icone(
  'IconInfo',
  <>{circulo}<path d="M12 11.4v5" /><Ponto cx={12} cy={7.9} r={1.1} /></>,
);

/** Círculo com aspas — erro. */
export const IconError = icone(
  'IconError',
  <>{circulo}<path d="M9 9l6 6" /><path d="M15 9l-6 6" /></>,
);

/** Relógio — prazo. */
export const IconTime = icone('IconTime', <>{circulo}<path d="M12 7.2V12l3.4 2" /></>);

/** Folha com dois postes — data. */
export const IconCalendar = icone(
  'IconCalendar',
  <>
    <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17" /><path d="M8 3.5v4" /><path d="M16 3.5v4" />
  </>,
);

/** Duas setas em círculo — atualizar. */
export const IconRefresh = icone(
  'IconRefresh',
  <>
    <path d="M20.2 11a8.2 8.2 0 0 0-14-4.4L3.4 9.3" />
    <path d="M3.8 13a8.2 8.2 0 0 0 14 4.4l2.8-2.7" />
    <path d="M3.2 4.6v4.7h4.7" /><path d="M20.8 19.4v-4.7h-4.7" />
  </>,
);

/** Avião de papel — enviar. */
export const IconSend = icone(
  'IconSend',
  <><path d="M21 3.4 2.9 10.2a.6.6 0 0 0 0 1.1l7.3 2.6 2.6 7.3a.6.6 0 0 0 1.1 0L21 3.4Z" /><path d="M10.2 13.9 21 3.4" /></>,
);

/** Folha com canto dobrado — documento. */
export const IconFile = icone(
  'IconFile',
  <><path d="M14 3.2H6.6A1.6 1.6 0 0 0 5 4.8v14.4a1.6 1.6 0 0 0 1.6 1.6h10.8a1.6 1.6 0 0 0 1.6-1.6V8.2L14 3.2Z" /><path d="M13.8 3.2v5h5.2" /></>,
);

/** Chevron — avançar. */
export const IconChevron = icone('IconChevron', <path d="M9.5 5.5l6.5 6.5-6.5 6.5" />);
