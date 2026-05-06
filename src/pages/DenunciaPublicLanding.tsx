import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { AkurisMarkPattern } from '@/components/identity/AkurisMarkPattern';
import logoImage from '@/assets/akuris-logo.png';

/**
 * Landing pública para a rota `/denuncia` (sem slug).
 * Usuários que recebem esse link sem o identificador da empresa caem aqui
 * e podem informar manualmente o código para acessar o canal correto.
 */
const DenunciaPublicLanding: React.FC = () => {
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = empresa.trim().toLowerCase().replace(/\s+/g, '-');
    if (!slug) {
      setError('Informe o código da empresa.');
      return;
    }
    navigate(`/${encodeURIComponent(slug)}/denuncia`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(230,25%,7%)] relative overflow-hidden px-6 py-10">
      <AkurisMarkPattern opacity={0.05} />
      <CornerAccent position="top-right" />
      <CornerAccent position="bottom-left" />

      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="text-center">
          <img src={logoImage} alt="Akuris" className="h-9 mx-auto object-contain mb-8" />
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 mb-5">
            <ShieldCheck className="w-6 h-6 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Canal de Denúncias
          </h1>
          <p className="text-sm text-white/55 mt-2 leading-relaxed">
            Para acessar o canal de denúncias, informe o código da empresa fornecido
            pela sua organização ou pelo link recebido.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="empresa" className="text-xs text-white/65 font-medium tracking-wide">
              Código da empresa
            </Label>
            <Input
              id="empresa"
              value={empresa}
              onChange={(e) => {
                setEmpresa(e.target.value);
                setError('');
              }}
              placeholder="ex.: minha-empresa"
              className="h-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
              autoFocus
            />
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>

          <Button
            type="submit"
            className="w-full h-11 font-semibold text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
          >
            Acessar canal <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>

        <p className="text-center text-xs text-white/45">
          Não tem o código?{' '}
          <a
            href="/"
            className="text-primary hover:text-primary/80 transition-colors"
          >
            Voltar ao site
          </a>
        </p>
      </div>
    </div>
  );
};

export default DenunciaPublicLanding;
