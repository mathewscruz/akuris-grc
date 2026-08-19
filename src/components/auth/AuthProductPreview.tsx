/**
 * O produto, no ecrã de acesso.
 *
 * O painel de marca dizia o que a plataforma faz — "Riscos", "Controles",
 * "Gap Analysis" — em palavras. Quem chega a um ecrã de login de GRC já sabe
 * o que é GRC; o que ainda não viu é como o trabalho fica quando está feito.
 *
 * Isto é um recorte fiel da linguagem do produto: a mesma tipografia, a mesma
 * escala de severidade, os mesmos fios de 1px, o mesmo roxo usado uma vez só.
 * Não é um screenshot — é o próprio sistema de desenho, o que significa que
 * nunca fica desatualizado em relação a ele.
 *
 * Os números são ilustrativos e propositadamente modestos: um painel de
 * demonstração com 100% de conformidade não convence ninguém que trabalha
 * com auditoria.
 */
import { cn } from '@/lib/utils';

/** Uma linha de framework: nome, versão e a barra de conformidade. */
function LinhaFramework({
  nome,
  versao,
  pct,
  destaque,
}: {
  nome: string;
  versao: string;
  pct: number;
  destaque?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3">
      <div className="min-w-0">
        <p className="truncate text-[0.8125rem] font-medium text-white/85">{nome}</p>
        <p className="mt-0.5 text-[0.6875rem] text-white/35">{versao}</p>
      </div>
      <span
        className={cn(
          'text-[0.9375rem] font-medium tabular-nums',
          destaque ? 'text-primary' : 'text-white/70',
        )}
      >
        {pct}%
      </span>
      <div className="col-span-2 h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={cn('h-full rounded-full', destaque ? 'bg-primary' : 'bg-white/25')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AuthProductPreview({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        // `rounded-lg` e não `rounded-xl`: o raio de contentor do produto é um só,
        // e a guarda de linguagem visual existe para isso.
        'w-full max-w-[38rem] rounded-lg border border-white/[0.09] bg-white/[0.025]',
        'shadow-[0_24px_60px_-24px_rgb(0_0_0/0.7)] backdrop-blur-sm',
        className,
      )}
    >
      {/* Cabeçalho: o número que o painel existe para mostrar. */}
      <div className="border-b border-white/[0.07] px-7 py-6">
        <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-white/35">
          Índice de maturidade
        </p>
        <div className="mt-2 flex items-baseline gap-2.5">
          <span className="text-[3rem] font-medium leading-none tabular-nums text-white">
            62
          </span>
          <span className="text-sm text-white/35">/ 100</span>
          <span className="ml-auto text-[0.6875rem] tabular-nums text-white/45">
            +4 pts · 30 dias
          </span>
        </div>
      </div>

      {/* Frameworks — o trabalho em curso. */}
      <div className="divide-y divide-white/[0.06] px-7 py-1">
        <LinhaFramework nome="ISO/IEC 27001" versao="2022 · 121 requisitos" pct={74} destaque />
        <LinhaFramework nome="LGPD" versao="2020 · 96 requisitos" pct={58} />
        <LinhaFramework nome="SOC 2 Type II" versao="2017 · 63 requisitos" pct={41} />
      </div>

      {/* Rodapé: o que exige decisão. A única cor de alarme do cartão. */}
      <div className="flex items-center gap-6 border-t border-white/[0.07] px-7 py-5">
        <span className="flex items-baseline gap-1.5">
          <span className="text-sm font-medium tabular-nums text-severity-high">7</span>
          <span className="text-[0.6875rem] text-white/40">riscos acima do apetite</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-sm font-medium tabular-nums text-white/70">23</span>
          <span className="text-[0.6875rem] text-white/40">controles a testar</span>
        </span>
      </div>
    </div>
  );
}
