import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, MessagesSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCanalDenuncia } from '@/hooks/useCanalDenuncia';
import { CanalLayout } from '@/components/denuncia/CanalLayout';
import { CanalState } from '@/components/denuncia/CanalState';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DenunciaMenu() {
  const { empresa: empresaSlug } = useParams();
  const { t } = useLanguage();
  const canal = useCanalDenuncia(empresaSlug);
  const { empresa, config, estiloDaMarca, nomeDoCanal } = canal;
  const [categorias, setCategorias] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    setCategorias([]);
    if (empresa?.id) supabase
      .rpc('get_denuncias_categorias_publicas' as never, { p_empresa_id: empresa.id } as never)
      .then(({ data }) => { if (active) setCategorias(((data ?? []) as { nome: string }[]).map((c) => c.nome)); });
    return () => { active = false; };
  }, [empresa?.id]);
  if (canal.estado !== 'pronto' || !empresa || !config) return <CanalState canal={canal} />;
  return <CanalLayout empresa={empresa} config={config} nomeDoCanal={nomeDoCanal} estiloDaMarca={estiloDaMarca}>
    <div className="canal-home">
      <div>
        <p className="canal-eyebrow">{t('canalExperience.eyebrow')}</p>
        <h1>{t('canalExperience.headline')}</h1>
        <p className="canal-home-copy">{config.texto_apresentacao || t('canalExperience.introduction')}</p>
        <Button asChild className="canal-cta"><Link to={`/${empresa.slug}/denuncia/registrar`}>{t('canalExperience.start')}<ArrowRight size={18} aria-hidden="true" /></Link></Button>
        <p className="canal-note">{t('canalExperience.noAccount')}</p>
      </div>
      <aside className="canal-process">
        <h2>{t('canalExperience.nextTitle')}</h2>
        <ol>{[1, 2, 3].map((step) => <li key={step}><span className="canal-step-number" aria-hidden="true">{step}</span><div><strong>{t(`canalExperience.process${step}`)}</strong><p>{t(`canalExperience.process${step}Hint`)}</p></div></li>)}</ol>
      </aside>
    </div>
    <div className="canal-return"><MessagesSquare aria-hidden="true" /><div><strong>{t('canalExperience.alreadyReported')}</strong><p>{t('canalExperience.followHint')}</p></div><Link className="canal-text-link" to={`/${empresa.slug}/denuncia/consulta`}>{t('canalExperience.follow')}<ArrowUpRight aria-hidden="true" /></Link></div>
    {categorias.length > 0 && <section className="canal-topics"><div><h2>{t('publicPortal.denunciaMenu.oQueRelatar')}</h2><p className="canal-note">{t('canalExperience.categoryHelp')}</p></div><ul>{categorias.map((category) => <li key={category}>{category}</li>)}</ul></section>}
  </CanalLayout>;
}
