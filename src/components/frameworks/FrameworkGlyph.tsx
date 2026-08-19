/**
 * Um glifo por framework — o que ele governa, desenhado.
 *
 * O cartão mostrava um quadrado colorido com a sigla lá dentro: "27001",
 * "27701", "62443", "20000". Quatro quadrados iguais com quatro números, numa
 * grelha de vinte e quatro. Isso não é um ícone — é o nome outra vez, em corpo
 * menor. Quem procura ISO 27001 num catálogo tem de ler todos os quadrados.
 *
 * **Porque não os logos oficiais.** ISO, NIST, PCI SSC, AICPA e a Comissão
 * Europeia registaram as suas marcas, e a ISO em particular proíbe o uso do
 * logótipo por quem não seja organismo de certificação acreditado. Pôr esses
 * logótipos num produto comercial de GRC — vendido a quem se certifica — é o
 * tipo de coisa que a própria ferramenta apanharia numa auditoria. Não é uma
 * limitação técnica: é a escolha certa, e já estava documentada em
 * `framework-brand.ts`.
 *
 * O que se desenha então é o ASSUNTO. ISO 27001 é um escudo com cadeado; o
 * NIST CSF é o seu próprio ciclo de cinco funções; o COSO é literalmente um
 * cubo; a ISO 14001 é uma folha. Isso é reconhecível sem ler, distingue-se em
 * miniatura, e não pede licença a ninguém.
 *
 * Gramática: a mesma de `_BaseModuleIcon` — grelha 24×24, `currentColor`,
 * traço 1.75, terminais redondos, sem fundo. Um framework sem glifo próprio
 * cai no da sua família (`tipo_framework`), e um cliente que cadastre o seu
 * framework interno recebe o glifo da família que escolheu.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FrameworkGlyphProps extends React.SVGProps<SVGSVGElement> {
  /** Nome do framework, como está em `gap_analysis_frameworks.nome`. */
  nome?: string | null;
  /** Família, de `gap_analysis_frameworks.tipo_framework`. Serve de reserva. */
  tipo?: string | null;
  size?: number;
}

const Svg = ({ size = 24, className, children, ...rest }: FrameworkGlyphProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn(className)}
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

/** Escudo — a forma base de tudo o que protege. */
const escudo = <path d="M12 3.2 4.8 6v5.4c0 4.4 2.9 7.6 7.2 9.4 4.3-1.8 7.2-5 7.2-9.4V6Z" />;

const G: Record<string, React.ReactNode> = {
  // ── Segurança da informação ───────────────────────────────────────────────
  /** ISO/IEC 27001 — SGSI: o escudo guarda o segredo. */
  iso27001: (
    <>
      {escudo}
      <rect x="9.4" y="11.4" width="5.2" height="4.2" rx="1" />
      <path d="M10.6 11.4V10a1.4 1.4 0 0 1 2.8 0v1.4" />
    </>
  ),
  /** NIST CSF — as cinco funções em ciclo: identificar, proteger, detetar, responder, recuperar. */
  nistcsf: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v3.4M18.9 9.1l-3.2 2.3M16.3 19l-1.3-3.8M7.7 19l1.3-3.8M5.1 9.1l3.2 2.3" />
    </>
  ),
  /** CIS Controls — os grupos de implementação, um degrau de cada vez. */
  cis: (
    <>
      <path d="M4 19h4.5v-4H4zM9.75 19h4.5v-8h-4.5zM15.5 19H20V6h-4.5z" />
    </>
  ),
  /** PCI DSS — o cartão e o que o protege. */
  pcidss: (
    <>
      <rect x="2.8" y="6" width="18.4" height="12" rx="2" />
      <path d="M2.8 10h18.4" />
      <rect x="13.6" y="13" width="4.6" height="3.4" rx="0.8" />
      <path d="M14.7 13v-1a1.2 1.2 0 0 1 2.4 0v1" />
    </>
  ),
  /** ISO/IEC 62443 e NIST 800-82 — segurança do chão de fábrica: a engrenagem protegida. */
  ot: (
    <>
      {escudo}
      <circle cx="12" cy="12.6" r="2.1" />
      <path d="M12 8.9v1.1M12 15.2v1.1M15.2 10.8l-.95.55M9.75 13.85l-.95.55M15.2 14.4l-.95-.55M9.75 11.35l-.95-.55" />
    </>
  ),
  /** SOC 2 Type II — atestação verificada ao longo do tempo: o selo e o período. */
  soc2: (
    <>
      <circle cx="10.5" cy="9.5" r="5.5" />
      <path d="m8.2 9.6 1.7 1.7 3.1-3.4" />
      <path d="M6.6 14.4 5.4 21l5.1-2.4L15.6 21l-1.2-6.6" />
    </>
  ),

  // ── Privacidade ───────────────────────────────────────────────────────────
  /** LGPD, GDPR — o titular no centro, e a lei à volta dele. */
  titular: (
    <>
      {escudo}
      <circle cx="12" cy="10.6" r="1.9" />
      <path d="M8.7 16.6a3.6 3.6 0 0 1 6.6 0" />
    </>
  ),
  /** CCPA — o direito de sair: o titular e a porta. */
  ccpa: (
    <>
      <circle cx="9" cy="8.4" r="2.6" />
      <path d="M4.4 16.8a4.9 4.9 0 0 1 9.2 0" />
      <path d="M16.4 12h4.8M19.2 9.6 21.6 12l-2.4 2.4" />
    </>
  ),
  /** HIPAA — dado de saúde: o prontuário protegido. */
  hipaa: (
    <>
      {escudo}
      <path d="M12 9.6v5.4M9.3 12.3h5.4" />
    </>
  ),
  /** ISO/IEC 27701 — privacidade construída sobre a segurança: cadeado com titular. */
  iso27701: (
    <>
      <rect x="4.4" y="10.4" width="15.2" height="10" rx="2" />
      <path d="M7.8 10.4V7.6a4.2 4.2 0 0 1 8.4 0v2.8" />
      <circle cx="12" cy="14.4" r="1.5" />
      <path d="M9.9 18.2a2.4 2.4 0 0 1 4.2 0" />
    </>
  ),

  // ── Governança de TI, serviço e qualidade ─────────────────────────────────
  /** COBIT — a cadeia de responsabilidade, de cima a baixo. */
  cobit: (
    <>
      <rect x="9.2" y="3" width="5.6" height="4.2" rx="1" />
      <rect x="2.8" y="16.8" width="5.6" height="4.2" rx="1" />
      <rect x="15.6" y="16.8" width="5.6" height="4.2" rx="1" />
      <path d="M12 7.2v3.4M5.6 16.8v-2.5h12.8v2.5M12 10.6v3.7" />
    </>
  ),
  /** ITIL e ISO/IEC 20000 — o ciclo de vida do serviço. */
  servico: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20.2 4.6v4h-4" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  /** ISO 9001 — o PDCA e a marca de conformidade no fim. */
  qualidade: (
    <>
      <path d="M20 12a8 8 0 1 1-3.3-6.5" />
      <path d="m8.6 12.2 2.4 2.4 5.4-6" />
    </>
  ),
  /** COSO Internal Control — o cubo, que é a imagem que o próprio COSO usa. */
  cubo: (
    <>
      <path d="M12 2.8 21 7.4v9.2L12 21.2 3 16.6V7.4Z" />
      <path d="M3 7.4l9 4.6 9-4.6M12 12v9.2" />
    </>
  ),

  // ── Risco ─────────────────────────────────────────────────────────────────
  /** ISO 31000 — a matriz: probabilidade contra impacto. */
  matrizRisco: (
    <>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2" />
      <path d="M9.1 3.4v17.2M14.9 3.4v17.2M3.4 9.1h17.2M3.4 14.9h17.2" />
      <rect x="15.4" y="3.9" width="4.7" height="4.7" rx="0.8" fill="currentColor" stroke="none" opacity="0.9" />
    </>
  ),
  /** COSO ERM — o risco na trajectória da estratégia. */
  cosoErm: (
    <>
      <path d="M3.2 18.4c4.6 0 5.4-11.2 10-11.2 3 0 4.2 4.4 7.6 4.4" />
      <circle cx="8.8" cy="11.4" r="1.7" />
      <path d="M3.2 21h17.6" />
    </>
  ),

  // ── Compliance e financeiro ───────────────────────────────────────────────
  /** ISO 37301 — a balança: o programa de compliance. */
  balanca: (
    <>
      <path d="M12 3.6v17M6.6 20.6h10.8M5 7.4h14M12 7.4 8.2 6" />
      <path d="M2.6 13.2 5 7.8l2.4 5.4a2.4 2.4 0 0 1-4.8 0ZM16.6 13.2 19 7.8l2.4 5.4a2.4 2.4 0 0 1-4.8 0Z" />
    </>
  ),
  /** SOX — a demonstração financeira que alguém assina. */
  sox: (
    <>
      <path d="M5.4 3.2h9.2l4 4v13.6H5.4Z" />
      <path d="M14.2 3.2v4.2h4.2" />
      <path d="M8.4 12.4h7.2M8.4 15.6h4.4" />
    </>
  ),
  /** DORA — resiliência operacional do sistema financeiro. */
  dora: (
    <>
      {escudo}
      <path d="M8.6 12.6h1.8l1.1-2.4 1.3 4.4 1-2h1.6" />
    </>
  ),
  /** NIS2 — a infraestrutura crítica em rede. */
  nis2: (
    <>
      <circle cx="12" cy="5.4" r="2.2" />
      <circle cx="5.2" cy="17.4" r="2.2" />
      <circle cx="18.8" cy="17.4" r="2.2" />
      <path d="M10.8 7.4 6.4 15.4M13.2 7.4l4.4 8M7.4 17.4h9.2" />
    </>
  ),

  // ── Ambiente ──────────────────────────────────────────────────────────────
  /** ISO 14001 — a folha, e o ciclo de melhoria por baixo. */
  iso14001: (
    <>
      <path d="M20 4.2c0 8.4-4.4 12.2-9.6 12.2A5.6 5.6 0 0 1 4.8 10.8C4.8 6.4 9.6 4.2 20 4.2Z" />
      <path d="M4.6 20.4c1.6-4.2 4.6-7.4 8.6-9.4" />
    </>
  ),
};

/** Reserva por família — cobre também os frameworks internos do cliente. */
const POR_FAMILIA: Record<string, React.ReactNode> = {
  seguranca_informacao: G.iso27001,
  privacidade: G.titular,
  governanca_ti: G.cobit,
  gestao_riscos: G.matrizRisco,
  compliance: G.balanca,
  qualidade: G.qualidade,
  meio_ambiente: G.iso14001,
  financeiro: G.sox,
  saude: G.hipaa,
};

const norm = (s?: string | null) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Nome do framework → glifo. Testado por prefixo para aguentar as variações
 * que o catálogo tem ("ISO/IEC 27001", "ISO 27001:2022", "NIST CSF 2.0").
 */
const POR_NOME: [RegExp, React.ReactNode][] = [
  [/^iso(iec)?27001/, G.iso27001],
  [/^iso(iec)?27701/, G.iso27701],
  [/^iso(iec)?62443/, G.ot],
  [/^nistsp80082|^nist80082/, G.ot],
  [/^nist/, G.nistcsf],
  [/^ciscontrols|^cis\d|^cis$/, G.cis],
  [/^pcidss|^pci/, G.pcidss],
  [/^soc2|^soc/, G.soc2],
  [/^lgpd/, G.titular],
  [/^gdpr|^rgpd/, G.titular],
  [/^ccpa|^cpra/, G.ccpa],
  [/^hipaa/, G.hipaa],
  [/^cobit/, G.cobit],
  [/^itil/, G.servico],
  [/^iso(iec)?20000/, G.servico],
  [/^iso9001/, G.qualidade],
  [/^cosointernalcontrol|^cosoic/, G.cubo],
  [/^cosoerm|^coso/, G.cosoErm],
  [/^iso31000/, G.matrizRisco],
  [/^iso37301/, G.balanca],
  [/^sox|^sarbanes/, G.sox],
  [/^dora/, G.dora],
  [/^nis2|^nis/, G.nis2],
  [/^iso14001/, G.iso14001],
];

/** Resolve o desenho: nome primeiro, família a seguir, escudo como último caso. */
export function glifoDoFramework(nome?: string | null, tipo?: string | null): React.ReactNode {
  const n = norm(nome);
  if (n) {
    for (const [re, glifo] of POR_NOME) if (re.test(n)) return glifo;
  }
  const familia = (tipo ?? '').toLowerCase().trim();
  return POR_FAMILIA[familia] ?? escudo;
}

export const FrameworkGlyph = React.forwardRef<SVGSVGElement, FrameworkGlyphProps>(
  ({ nome, tipo, ...rest }, ref) => (
    <Svg ref={ref as never} {...rest}>
      {glifoDoFramework(nome, tipo)}
    </Svg>
  ),
);
FrameworkGlyph.displayName = 'FrameworkGlyph';
