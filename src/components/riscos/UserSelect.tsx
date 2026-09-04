
import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconSort, IconPerson, IconCheck } from '@/components/icons';
import { splitResponsavel } from '@/lib/uuid';

interface Usuario {
  user_id: string;
  nome: string;
  email: string;
  role: string;
}

interface UserSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Liga o gatilho ao <Label htmlFor> do campo — sem isto o leitor de ecrã
   *  anuncia só o valor, sem dizer de que campo se trata. */
  id?: string;
  /** Usuários que não podem ser escolhidos (por exemplo, o próprio solicitante
   * em fluxos que exigem segregação de funções). */
  excludedUserIds?: string[];
  /** Restringe o campo a papéis aptos a executar uma decisão específica. */
  requiredRoles?: string[];
}

export function UserSelect({ value, onValueChange, placeholder, id, excludedUserIds = [], requiredRoles }: UserSelectProps) {
  const { t } = useLanguage();
  const resolvedPlaceholder = placeholder ?? t('riscosDetalhe.userSelect.placeholder');
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const excludedKey = excludedUserIds.join('|');
  const rolesKey = requiredRoles?.join('|') ?? '';

  useEffect(() => {
    if (profile?.empresa_id) {
      fetchUsuarios();
    }
  }, [profile?.empresa_id, excludedKey, rolesKey]);

  const fetchUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nome, email, role')
        .eq('empresa_id', profile?.empresa_id)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      
      setUsuarios((data || []).filter((usuario) =>
        !excludedUserIds.includes(usuario.user_id) &&
        (!requiredRoles?.length || requiredRoles.includes(usuario.role))
      ));
    } catch (error: any) {
      logger.error('Erro ao buscar usuários:', { data: error });
      toast.error(t('riscosDetalhe.userSelect.errorFetch'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * O que está guardado, mesmo quando não é um utilizador da lista.
   *
   * A coluna é TEXT e guarda as duas coisas — `uuid.ts` di-lo há muito: «o
   * rótulo textual continua disponível para exibição». Este componente
   * deitava-o fora: comparava `user_id === value` e, sem correspondência,
   * desenhava o `placeholder`.
   *
   * Medido em Activos: a Impressora HP tem `proprietario = 'Facilities'` e o
   * diálogo de edição dizia «Selecionar proprietário...». Nove dos valores
   * guardados na base são assim — `TI`, `Comercial`, `João - CEO` — e todos
   * apareciam como campo por preencher. Quem acredita nisso escolhe um dono
   * novo para um activo que já tinha dono; a leitura falhada passa a facto.
   *
   * Um UUID que não está na lista é outro caso: pode ser alguém inactivo ou de
   * outra empresa. Vai-se buscar o nome, porque o número não diz nada a
   * ninguém — e se nem isso existir, diz-se que não foi encontrado, que é a
   * verdade, em vez de «por preencher», que não é.
   */
  const { userId, label } = splitResponsavel(value);
  const selectedUser = usuarios.find(user => user.user_id === userId);
  const [nomeForaDaLista, setNomeForaDaLista] = useState<string | null>(null);

  useEffect(() => {
    setNomeForaDaLista(null);
    if (!userId || selectedUser || loading) return;
    let vivo = true;
    supabase
      .from('profiles')
      .select('nome')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (vivo && data?.nome) setNomeForaDaLista(data.nome);
      });
    return () => {
      vivo = false;
    };
  }, [userId, selectedUser, loading]);

  const nomeVisivel =
    selectedUser?.nome ??
    label ??
    nomeForaDaLista ??
    (userId ? t('riscosDetalhe.userSelect.naoEncontrado') : null);

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
          {nomeVisivel ? (
            <div className="flex items-center gap-2 truncate">
              <IconPerson className="h-4 w-4 flex-shrink-0" />
              {/* Sem correspondência na lista o valor continua a ler-se, mas em
                  tom de apoio: está preenchido, e não está ligado a ninguém. */}
              <span className={cn('truncate', !selectedUser && 'text-muted-foreground')}>
                {nomeVisivel}
              </span>
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
