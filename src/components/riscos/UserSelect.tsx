
import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconSort, IconPerson, IconCheck } from '@/components/icons';

interface Usuario {
  user_id: string;
  nome: string;
  email: string;
}

interface UserSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Liga o gatilho ao <Label htmlFor> do campo — sem isto o leitor de ecrã
   *  anuncia só o valor, sem dizer de que campo se trata. */
  id?: string;
}

export function UserSelect({ value, onValueChange, placeholder, id }: UserSelectProps) {
  const { t } = useLanguage();
  const resolvedPlaceholder = placeholder ?? t('riscosDetalhe.userSelect.placeholder');
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.empresa_id) {
      fetchUsuarios();
    }
  }, [profile?.empresa_id]);

  const fetchUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nome, email')
        .eq('empresa_id', profile?.empresa_id)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      
      setUsuarios(data || []);
    } catch (error: any) {
      logger.error('Erro ao buscar usuários:', { data: error });
      toast.error(t('riscosDetalhe.userSelect.errorFetch'));
    } finally {
      setLoading(false);
    }
  };

  const selectedUser = usuarios.find(user => user.user_id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedUser ? (
            <div className="flex items-center gap-2 truncate">
              <IconPerson className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{selectedUser.nome}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{resolvedPlaceholder}</span>
          )}
          <IconSort className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={t('riscosDetalhe.userSelect.searchPlaceholder')} />
          <CommandList>
            {loading ? (
              <CommandEmpty>{t('riscosDetalhe.userSelect.loading')}</CommandEmpty>
            ) : usuarios.length === 0 ? (
              <CommandEmpty>{t('riscosDetalhe.userSelect.empty')}</CommandEmpty>
            ) : (
              <CommandGroup>
                {usuarios.map((usuario) => (
                  <CommandItem
                    key={usuario.user_id}
                    value={`${usuario.nome} ${usuario.email}`}
                    onSelect={() => {
                      onValueChange(usuario.user_id);
                      setOpen(false);
                    }}
                  >
                    <IconCheck
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === usuario.user_id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <IconPerson className="h-4 w-4 flex-shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">{usuario.nome}</span>
                        <span className="text-xs text-muted-foreground truncate">{usuario.email}</span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
