import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CanalLayout } from '@/components/denuncia/CanalLayout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DenunciaPublicLanding() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [empresa, setEmpresa] = useState('');
  const [error, setError] = useState('');
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const slug = empresa.trim().toLowerCase().replace(/\s+/g, '-');
    if (!slug) {
      setError(t('publicPortal.denunciaLanding.companyCodeRequired')); return;
    }
    navigate(`/${encodeURIComponent(slug)}/denuncia`);
  };
  return <CanalLayout empresa={null} config={null} nomeDoCanal="Akuris">
    <section className="canal-state">
      <p className="canal-eyebrow">{t('canalExperience.eyebrow')}</p>
      <h1>{t('publicPortal.denunciaLanding.title')}</h1>
      <p>{t('publicPortal.denunciaLanding.description')}</p>
      <form onSubmit={handleSubmit} className="max-w-md space-y-5">
        <div className="space-y-2"><Label htmlFor="empresa">{t('publicPortal.denunciaLanding.companyCode')}</Label>
          <Input id="empresa" value={empresa} autoComplete="off" spellCheck={false}
            onChange={(event) => { setEmpresa(event.target.value); setError(''); }}
            placeholder={t('publicPortal.denunciaLanding.companyCodePlaceholder')} required aria-describedby={error ? 'company-error' : undefined} aria-invalid={!!error} />
          {error && <p id="company-error" role="alert" className="canal-error">{error}</p>}
        </div>
        <Button type="submit" className="canal-cta">{t('publicPortal.denunciaLanding.accessChannel')}<ArrowRight size={18} aria-hidden="true" /></Button>
      </form>
      <p className="canal-note">{t('publicPortal.denunciaLanding.noCode')} <Link className="canal-text-link" to="/">{t('publicPortal.denunciaLanding.backToSite')}</Link></p>
    </section>
  </CanalLayout>;
}
