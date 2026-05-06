import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowLeft, Building2, Mail, Lock, User, CheckCircle2, XCircle } from 'lucide-react';
import logoImage from '@/assets/akuris-logo.png';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { z } from 'zod';
import { Progress } from '@/components/ui/progress';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const Registro = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmarSenha: '', empresa: '', cnpj: '' });
  const [termos, setTermos] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const registroSchema = z.object({
    nome: z.string().min(2, t('register.validationNameMin')),
    email: z.string().min(1, t('register.validationEmailRequired')).email(t('register.validationEmailInvalid')),
    senha: z.string().min(6, t('register.validationPasswordMin')),
    confirmarSenha: z.string().min(1, t('register.validationConfirmPassword')),
    empresa: z.string().min(2, t('register.validationCompanyRequired')),
    cnpj: z.string().optional(),
    termos: z.literal(true, { errorMap: () => ({ message: t('register.validationTermsRequired') }) }),
  }).refine((data) => data.senha === data.confirmarSenha, {
    message: t('register.validationPasswordsMatch'),
    path: ['confirmarSenha'],
  });

  const passwordStrength = useMemo(() => {
    const s = form.senha;
    if (!s) return { score: 0, label: '', color: '' };
    let score = 0;
    if (s.length >= 6) score++;
    if (s.length >= 8) score++;
    if (/[A-Z]/.test(s)) score++;
    if (/[0-9]/.test(s)) score++;
    if (/[^A-Za-z0-9]/.test(s)) score++;
    if (score <= 1) return { score: 20, label: t('register.strengthWeak'), color: 'bg-red-500' };
    if (score <= 2) return { score: 40, label: t('register.strengthFair'), color: 'bg-orange-500' };
    if (score <= 3) return { score: 60, label: t('register.strengthMedium'), color: 'bg-yellow-500' };
    if (score <= 4) return { score: 80, label: t('register.strengthStrong'), color: 'bg-green-500' };
    return { score: 100, label: t('register.strengthVeryStrong'), color: 'bg-emerald-500' };
  }, [form.senha, t]);

  const passwordChecks = useMemo(() => [
    { label: t('register.checkMinChars'), met: form.senha.length >= 6 },
    { label: t('register.checkUppercase'), met: /[A-Z]/.test(form.senha) },
    { label: t('register.checkNumber'), met: /[0-9]/.test(form.senha) },
    { label: t('register.checkSpecial'), met: /[^A-Za-z0-9]/.test(form.senha) },
  ], [form.senha, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'cnpj') {
      setForm(prev => ({ ...prev, cnpj: formatCNPJ(value) }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = registroSchema.safeParse({ ...form, termos });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const cnpjDigits = form.cnpj.replace(/\D/g, '') || null;
      const { data, error } = await supabase.functions.invoke('provision-new-account', {
        body: {
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          empresa_nome: form.empresa,
          cnpj: cnpjDigits,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(t('register.accountCreated'));
      await supabase.auth.signInWithPassword({ email: form.email, password: form.senha });
      navigate('/dashboard');
    } catch (error: any) {
      const msg = error?.message || t('register.errorGeneric');
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        toast.error(t('register.errorEmailAlreadyRegistered'));
      } else {
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(216,60%,8%)] via-[hsl(216,45%,12%)] to-[hsl(216,60%,8%)] px-4 py-8 relative overflow-hidden">
      <div className="landing-grid-bg absolute inset-0 opacity-30" />
      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-primary/10 rounded-full blur-[100px]" />

      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="dark" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center">
          <img src={logoImage} alt="Akuris" className="h-14 mx-auto object-contain mb-4" />
          <h1 className="text-2xl font-bold text-white">{t('register.createAccount')}</h1>
          <p className="text-white/50 text-sm mt-1">
            {t('register.trialBadge')}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-md p-8 shadow-2xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-white/70 text-sm">{t('register.fullName')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="nome" name="nome" value={form.nome} onChange={handleChange}
                  placeholder={t('register.fullNamePlaceholder')}
                  className={`h-11 pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary ${errors.nome ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/70 text-sm">{t('register.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="email" name="email" type="email" value={form.email} onChange={handleChange}
                  placeholder={t('auth.emailPlaceholder')}
                  className={`h-11 pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary ${errors.email ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha" className="text-white/70 text-sm">{t('register.password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="senha" name="senha" type={showPassword ? 'text' : 'password'} value={form.senha} onChange={handleChange}
                  placeholder={t('register.passwordPlaceholder')}
                  className={`h-11 pl-10 pr-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary ${errors.senha ? 'border-destructive' : ''}`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.senha && <p className="text-xs text-destructive">{errors.senha}</p>}
              {form.senha && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Progress value={passwordStrength.score} className="h-1.5 flex-1" />
                    <span className={`text-xs font-medium ${passwordStrength.score >= 60 ? 'text-green-400' : passwordStrength.score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {passwordChecks.map((check) => (
                      <div key={check.label} className="flex items-center gap-1">
                        {check.met ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-white/20" />}
                        <span className={`text-[10px] ${check.met ? 'text-green-400' : 'text-white/30'}`}>{check.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmarSenha" className="text-white/70 text-sm">{t('register.confirmPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="confirmarSenha" name="confirmarSenha" type={showConfirmPassword ? 'text' : 'password'} value={form.confirmarSenha} onChange={handleChange}
                  placeholder={t('register.confirmPasswordPlaceholder')}
                  className={`h-11 pl-10 pr-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary ${errors.confirmarSenha ? 'border-destructive' : ''}`}
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmarSenha && <p className="text-xs text-destructive">{errors.confirmarSenha}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="empresa" className="text-white/70 text-sm">{t('register.companyName')}</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="empresa" name="empresa" value={form.empresa} onChange={handleChange}
                  placeholder={t('register.companyNamePlaceholder')}
                  className={`h-11 pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary ${errors.empresa ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.empresa && <p className="text-xs text-destructive">{errors.empresa}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cnpj" className="text-white/70 text-sm">{t('register.cnpj')} <span className="text-white/30">{t('register.cnpjOptional')}</span></Label>
              <Input
                id="cnpj" name="cnpj" value={form.cnpj} onChange={handleChange}
                placeholder="00.000.000/0000-00"
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="termos"
                  checked={termos}
                  onCheckedChange={(checked) => {
                    setTermos(checked as boolean);
                    if (errors.termos) setErrors(prev => ({ ...prev, termos: '' }));
                  }}
                  className="mt-0.5"
                />
                <Label htmlFor="termos" className="text-white/50 text-xs leading-relaxed cursor-pointer">
                  {t('register.termsAccept')}{' '}
                  <Link to="/politica-privacidade" target="_blank" className="text-primary hover:underline">{t('register.termsOfUse')}</Link>
                  {' '}{t('register.and')}{' '}
                  <Link to="/politica-privacidade" target="_blank" className="text-primary hover:underline">{t('register.privacyPolicy')}</Link>
                </Label>
              </div>
              {errors.termos && <p className="text-xs text-destructive">{errors.termos}</p>}
            </div>

            <Button type="submit" variant="gradient" className="w-full h-11 font-semibold text-sm mt-2" disabled={isLoading}>
              {isLoading ? <><AkurisPulse size={16} className="mr-2" />{t('register.creatingAccount')}</> : t('register.createFreeAccount')}
            </Button>
          </form>
        </div>

        <div className="text-center space-y-2">
          <p className="text-white/40 text-sm">
            {t('register.alreadyHaveAccount')}{' '}
            <Link to="/auth" className="text-primary hover:text-primary/80 hover:underline">{t('register.signIn')}</Link>
          </p>
          <Link to="/" className="inline-flex items-center gap-1 text-white/30 hover:text-white/50 text-xs">
            <ArrowLeft className="w-3 h-3" /> {t('register.backToSite')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Registro;
