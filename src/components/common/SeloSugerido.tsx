import { Chip } from '@/components/ui/chip';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Selo de sugestão — o que a máquina propôs e ninguém ainda decidiu.
 *
 * Substitui o antigo `AIBadge`, um chip roxo com estrela de 4 pontas. A
 * estrela é o significante universal de IA em produto gerado; pior, havia um
 * teste de guarda a **exigi-la** por todo o lado, o que trocava a estrelinha
 * de catálogo pela nossa própria estrelinha e chamava a isso identidade.
 *
 * A troca não é só de vestuário. Num produto de GRC o facto útil nunca foi "a
 * IA fez isto" — é **"isto é sugestão, não decisão"**. O auditor pergunta quem
 * decidiu, e "o sistema" não é resposta. Por isso o selo:
 *
 *   - usa o sistema de chips comum (superfície neutra, a marca carrega o
 *     sentido), como qualquer outro estado do produto;
 *   - diz "Sugerido", não "IA";
 *   - **desaparece quando alguém aceita** — deixa de existir a informação, em
 *     vez de virar decoração permanente. Quem renderiza decide: se o registo
 *     já foi aceite, simplesmente não monta o selo.
 *
 * A marca da IA fica reservada à superfície do assistente (AkurIA), onde é
 * marca de produto e não enfeite.
 */
interface SeloSugeridoProps {
  /** Rótulo alternativo; por omissão, "Sugerido". */
  children?: React.ReactNode;
  className?: string;
}

export function SeloSugerido({ children, className }: SeloSugeridoProps) {
  const { t } = useLanguage();
  return (
    <Chip family="state" tone="rest" className={className}>
      {children ?? t('campos.comum.sugerido')}
    </Chip>
  );
}
