import { useState, useRef, useEffect, useMemo } from 'react';
import { IconUpload, IconView, IconHide, IconBell, IconImage, IconLock, IconPerson } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Chip } from '@/components/ui/chip';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { senhaValida } from '@/lib/politica-senha';
const buildPerfilSchema = (t: (k: string) => string) => z.object({
  nome: z.string().min(1, t('userProfilePopover.nameRequired')),
  senha_atual: z.string().optional(),
  nova_senha: z.string().optional(),
  confirmar_senha: z.string().optional(),
}).refine((data) => {
  if (data.nova_senha || data.confirmar_senha) {
    return data.senha_atual && data.nova_senha === data.confirmar_senha;
  }
  return true;
}, {
  message: t('userProfilePopover.passwordsAndCurrent'),
  path: ["confirmar_senha"],
}).refine((data) => !data.nova_senha || senhaValida(data.nova_senha), {
  // Era o quarto sitio do produto a definir a sua propria regra de senha, e o
  // mais permissivo de todos: seis caracteres, sem classes. A politica esta em
  // `lib/politica-senha` e e a mesma em todos os caminhos.
  message: t('politicaSenha.resumo'),
  path: ["nova_senha"],
});

type PerfilForm = {
  nome: string;
  senha_atual?: string;
  nova_senha?: string;
  confirmar_senha?: string;
};

interface UserProfilePopoverProps {
  onClose?: () => void;
}

export function UserProfilePopover({ onClose }: UserProfilePopoverProps) {
  const { t } = useLanguage();
  const perfilSchema = useMemo(() => buildPerfilSchema(t), [t]);
  const { user, profile, refetchProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState((profile as any)?.foto_url);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPasswords, setShowPasswords] = useState({
    atual: false,
    nova: false,
    confirmar: false,
  });
  /*
    As preferencias vivem no PERFIL, nao no navegador.

    Estavam em `localStorage`, e nenhum outro ficheiro do produto lia essa
    chave. Desligar «Email» nao impedia um unico envio -- o servidor nunca ve o
    localStorage de ninguem -- e desligar «In-App» nao filtrava nada no sino.
    Era, alem disso, por navegador: mudar de maquina apagava a escolha.

    E o pior tipo de fachada: um controlo com forma de consentimento. A pessoa
    desliga, acredita que desligou, e continua a receber.

    Agora sao colunas de `profiles`, que o servidor le -- a RPC
    `criar_notificacao` recusa criar aviso a quem desligou o sino.

    A «frequencia» (Tempo real / Diario / Semanal) desapareceu: nao ha digest no
    produto, e oferecer tres cadencias que fazem todas a mesma coisa era repetir
    o problema com outra roupa. Volta quando houver digest.
  */
  const [notificationPrefs, setNotificationPrefs] = useState({
    email_notifications: true,
    in_app_notifications: true,
  });
  const [aGravarPrefs, setAGravarPrefs] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let vivo = true;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('notificar_por_email, notificar_na_aplicacao')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        logger.error('Preferencias de notificacao nao carregadas', { data: error });
        return;
      }
      if (vivo && data) {
        setNotificationPrefs({
          email_notifications: data.notificar_por_email ?? true,
          in_app_notifications: data.notificar_na_aplicacao ?? true,
        });
      }
    })();
    return () => { vivo = false; };
  }, [user?.id]);

  const saveNotificationPrefs = async (prefs: typeof notificationPrefs) => {
    if (!user?.id) return;
    const anterior = notificationPrefs;
    setNotificationPrefs(prefs);
    setAGravarPrefs(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        notificar_por_email: prefs.email_notifications,
        notificar_na_aplicacao: prefs.in_app_notifications,
      })
      .eq('user_id', user.id);
    setAGravarPrefs(false);
    if (error) {
      // Se nao gravou, o interruptor nao pode ficar a dizer que sim.
      setNotificationPrefs(anterior);
      logger.error('Preferencias de notificacao nao gravadas', { data: error });
      toast.error(t('userProfilePopover.prefsErro'));
    }
  };

  const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const form = useForm<PerfilForm>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      nome: profile?.nome || '',
      senha_atual: '',
      nova_senha: '',
      confirmar_senha: '',
    },
  });

  const validateImageFile = (file: File): string | null => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return t('userProfilePopover.invalidImageFormat');
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return t('userProfilePopover.fileTooLarge');
    }
    
    return null;
  };

  const handlePhotoUpload = async (file: File) => {
    if (!user) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ foto_url: urlData.publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setFotoUrl(urlData.publicUrl);
      await refetchProfile();
      toast.success(t('userProfilePopover.photoUpdated'));
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      toast.error(t('userProfilePopover.photoError'));
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleProfileSubmit = async (data: PerfilForm) => {
    try {
      // Atualizar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ nome: data.nome })
        .eq('user_id', user?.id);

      if (profileError) throw profileError;

      // Atualizar senha se fornecida
      if (data.nova_senha && data.senha_atual) {
        // Validar senha atual via re-autenticação
        const { error: reAuthError } = await supabase.auth.signInWithPassword({
          email: user?.email || '',
          password: data.senha_atual,
        });

        if (reAuthError) {
          toast.error(t('userProfilePopover.incorrectCurrentPassword'));
          return;
        }

        const { error: passwordError } = await supabase.auth.updateUser({
          password: data.nova_senha
        });

        if (passwordError) throw passwordError;
      }

      await refetchProfile();
      toast.success(t('userProfilePopover.profileUpdated'));
      
      // Limpar campos de senha
      form.reset({
        nome: data.nome,
        senha_atual: '',
        nova_senha: '',
        confirmar_senha: '',
      });

      // Fechar popover após sucesso
      if (onClose) {
        setTimeout(onClose, 500);
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error(t('userProfilePopover.profileError'));
    }
  };

  const togglePasswordVisibility = (field: 'atual' | 'nova' | 'confirmar') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: t('cardsKpi.sweep.sistema.roleAdmin'),
    user: t('cardsKpi.sweep.sistema.roleUser'),
    readonly: t('cardsKpi.sweep.sistema.roleReadonly'),
  };
  const role = (profile as any)?.role || 'user';
  const displayName = form.watch('nome') || (profile as any)?.nome || user?.email || '';

  const passwordField = (
    name: 'senha_atual' | 'nova_senha' | 'confirmar_senha',
    key: 'atual' | 'nova' | 'confirmar',
    labelKey: string,
    placeholderKey: string,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-medium text-muted-foreground">
            {t(labelKey)}
          </FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type={showPasswords[key] ? 'text' : 'password'}
                placeholder={t(placeholderKey)}
                className="pr-10"
                {...field}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => togglePasswordVisibility(key)}
                aria-label={t(labelKey)}
              >
                {showPasswords[key] ? (
                  <IconHide className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                ) : (
                  <IconView className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                )}
              </Button>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <div className="space-y-5">
      {/* Cabeçalho editorial da conta */}
      <div className="relative overflow-hidden rounded-lg border bg-muted/30 p-5 dark:shadow-none">
        <CornerAccent position="top-right" size={12} className="opacity-60" />
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={handlePhotoClick}
              disabled={uploading}
              className="group relative block rounded-full ring-2 ring-border transition-shadow hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={t('userProfilePopover.changePhoto')}
            >
              <Avatar className="h-20 w-20">
                <AvatarImage src={fotoUrl || (profile as any)?.foto_url} alt={displayName} />
                <AvatarFallback className="bg-primary text-xl text-primary-foreground">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
                <IconImage className="h-5 w-5 text-foreground" strokeWidth={1.5} />
              </span>
              {uploading && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                  <AkurisPulse size={24} />
                </span>
              )}
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t('userProfilePopover.eyebrow')}
            </p>
            <h3 className="truncate text-lg font-semibold leading-tight text-foreground">{displayName}</h3>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 sm:justify-start">
              <Chip family="type">{roleLabels[role] ?? role}</Chip>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handlePhotoClick}
                disabled={uploading}
              >
                <IconUpload className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
                {t('userProfilePopover.changePhoto')}
              </Button>
            </div>
            <p className="text-micro text-muted-foreground">{t('userProfilePopover.photoFormats')}</p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePhotoUpload(file);
        }}
        disabled={uploading}
      />

      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">
            <IconPerson className="mr-1.5 h-4 w-4" strokeWidth={1.5} />
            {t('userProfilePopover.tabProfile')}
          </TabsTrigger>
          <TabsTrigger value="seguranca">
            <IconLock className="mr-1.5 h-4 w-4" strokeWidth={1.5} />
            {t('userProfilePopover.tabSecurity')}
          </TabsTrigger>
          <TabsTrigger value="notificacoes">
            <IconBell className="mr-1.5 h-4 w-4" strokeWidth={1.5} />
            {t('userProfilePopover.tabNotifications')}
          </TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleProfileSubmit)}>
            <TabsContent value="perfil" className="space-y-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t('userProfilePopover.name')}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={t('userProfilePopover.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-1.5">
                <Label htmlFor="perfil-email" className="text-xs font-medium text-muted-foreground">
                  {t('userProfilePopover.emailLabel')}
                </Label>
                {/* Só de leitura também precisa de nome: sem ele o leitor
                    de ecrã anuncia o endereço sem dizer o que ele é. */}
                <Input id="perfil-email" value={user?.email ?? ''} disabled readOnly />
                <p className="text-xs text-muted-foreground">{t('userProfilePopover.emailHint')}</p>
              </div>
            </TabsContent>

            <TabsContent value="seguranca" className="space-y-4">
              <p className="text-xs text-muted-foreground">{t('userProfilePopover.passwordHint')}</p>
              {passwordField('senha_atual', 'atual', 'userProfilePopover.currentPassword', 'userProfilePopover.currentPasswordPlaceholder')}
              <div className="grid gap-4 sm:grid-cols-2">
                {passwordField('nova_senha', 'nova', 'userProfilePopover.newPassword', 'userProfilePopover.newPasswordPlaceholder')}
                {passwordField('confirmar_senha', 'confirmar', 'userProfilePopover.confirmNewPassword', 'userProfilePopover.confirmNewPasswordPlaceholder')}
              </div>
            </TabsContent>

            <div className="mt-5 flex justify-end border-t pt-4">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? t('userProfilePopover.saving')
                  : t('userProfilePopover.saveChanges')}
              </Button>
            </div>
          </form>
        </Form>

        <TabsContent value="notificacoes" className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="pp-email-notif" className="text-sm">{t('userProfilePopover.emailNotif')}</Label>
              <p className="text-xs text-muted-foreground">{t('userProfilePopover.emailNotifDesc')}</p>
            </div>
            <Switch
              id="pp-email-notif"
              disabled={aGravarPrefs}
              checked={notificationPrefs.email_notifications}
              onCheckedChange={(checked) =>
                saveNotificationPrefs({ ...notificationPrefs, email_notifications: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="pp-inapp-notif" className="text-sm">{t('userProfilePopover.inAppNotif')}</Label>
              <p className="text-xs text-muted-foreground">{t('userProfilePopover.inAppNotifDesc')}</p>
            </div>
            <Switch
              id="pp-inapp-notif"
              disabled={aGravarPrefs}
              checked={notificationPrefs.in_app_notifications}
              onCheckedChange={(checked) =>
                saveNotificationPrefs({ ...notificationPrefs, in_app_notifications: checked })
              }
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
