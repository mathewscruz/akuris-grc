import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Chip } from '@/components/ui/chip';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { UserProfilePopover } from './UserProfilePopover';
import { useLanguage } from '@/contexts/LanguageContext';

const UserProfile: React.FC = () => {
  const { t } = useLanguage();
  const { user, profile, loading } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('nome, foto_url')
          .eq('user_id', user.id)
          .single();
        
        if (data) setUserProfile(data);
      } catch (error) {
        console.error('Erro ao buscar perfil:', error);
      }
    };

    fetchUserProfile();
  }, [user]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        <div className="hidden sm:block space-y-1">
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          <div className="h-3 w-16 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Don't render if no user
  if (!user) {
    return null;
  }

  // Use user metadata if profile is not available
  const displayName = profile?.nome || user.user_metadata?.nome || user.email?.split('@')[0] || 'Usuário';
  const displayRole = profile?.role || 'user';

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return t('experience.superAdmin');
      case 'admin':
        return t('cardsKpi.sweep.sistema.roleAdmin');
      case 'user':
        return t('cardsKpi.sweep.sistema.roleUser');
      case 'readonly':
        return t('cardsKpi.sweep.sistema.roleReadonly');
      default:
        return role;
    }
  };

  return (
    <Dialog open={popoverOpen} onOpenChange={setPopoverOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-3 hover:bg-accent/50 p-2 rounded-lg transition-colors cursor-pointer">
          <Avatar className="h-10 w-10">
            <AvatarImage src={userProfile?.foto_url} alt={displayName} />
            <AvatarFallback>
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium text-foreground">{displayName}</span>
            <Chip family="type">
              {getRoleLabel(displayRole)}
            </Chip>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('residuos.geral.editarPerfil')}</DialogTitle>
        </DialogHeader>
        <UserProfilePopover onClose={() => setPopoverOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

export default UserProfile;
