import { useState, useEffect } from 'react';
import { IconClose, IconCheck, IconSort, IconChecklist } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveAuditoriaTipoTone, resolveAuditoriaStatusTone } from '@/lib/status-tone';
import { useLanguage } from '@/contexts/LanguageContext';

interface Auditoria {
  id: string;
  nome: string;
  tipo: string;
  status: string;
}

interface AuditoriasMultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  /** Liga o gatilho ao <Label htmlFor> do campo. */
  id?: string;
}

export function AuditoriasMultiSelect({ 
  value = [], 
  onValueChange, 
  placeholder,
  id
}: AuditoriasMultiSelectProps) {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const resolvedPlaceholder = placeholder ?? t('controlesAuditorias.amsPlaceholder');
  const [open, setOpen] = useState(false);
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.empresa_id) {
      fetchAuditorias();
    }
  }, [profile?.empresa_id]);

  const fetchAuditorias = async () => {
    try {
      const { data, error } = await supabase
        .from('auditorias')
        .select('id, nome, tipo, status')
        .eq('empresa_id', profile?.empresa_id)
        .in('status', ['planejamento', 'em_andamento', 'concluida'])
        .order('nome');

      if (error) throw error;
      
      setAuditorias(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar auditorias:', error);
      toast.error(t('controlesAuditorias.amsErrorLoad'));
    } finally {
      setLoading(false);
    }
  };

  const selectedAuditorias = auditorias.filter(aud => value.includes(aud.id));

  const toggleAuditoria = (auditoriaId: string) => {
    if (value.includes(auditoriaId)) {
      onValueChange(value.filter(id => id !== auditoriaId));
    } else {
      onValueChange([...value, auditoriaId]);
    }
  };

  const removeAuditoria = (auditoriaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(value.filter(id => id !== auditoriaId));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-h-[40px] h-auto"
          >
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              {selectedAuditorias.length === 0 ? (
                <span className="text-muted-foreground">{resolvedPlaceholder}</span>
              ) : (
                <>
                  <IconChecklist className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{t('controlesAuditorias.amsSelectedCount', { count: selectedAuditorias.length })}</span>
                </>
              )}
            </div>
            <IconSort className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-popover" align="start">
          <Command>
            <CommandInput placeholder={t('controlesAuditorias.amsSearchPlaceholder')} />
            <CommandList>
              {loading ? (
                <CommandEmpty>{t('controlesAuditorias.amsLoading')}</CommandEmpty>
              ) : auditorias.length === 0 ? (
                <CommandEmpty>{t('controlesAuditorias.amsEmpty')}</CommandEmpty>
              ) : (
                <CommandGroup>
                  {auditorias.map((auditoria) => (
                    <CommandItem
                      key={auditoria.id}
                      value={auditoria.nome}
                      onSelect={() => toggleAuditoria(auditoria.id)}
                    >
                      <IconCheck
                        className={cn(
                          "mr-2 h-4 w-4",
                          value.includes(auditoria.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <IconChecklist className="h-4 w-4 flex-shrink-0" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-medium truncate">{auditoria.nome}</span>
                      <div className="flex items-center gap-2 mt-1">
                            <StatusBadge {...resolveAuditoriaTipoTone(auditoria.tipo)}>
                              {formatStatus(auditoria.tipo)}
                            </StatusBadge>
                            <StatusBadge {...resolveAuditoriaStatusTone(auditoria.status)}>
                              {formatStatus(auditoria.status)}
                            </StatusBadge>
                          </div>
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
      
      {selectedAuditorias.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedAuditorias.map((auditoria) => (
            <Badge key={auditoria.id} variant="secondary" className="pl-2 pr-1">
              {auditoria.nome}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-2 hover:bg-transparent"
                onClick={(e) => removeAuditoria(auditoria.id, e)}
              >
                <IconClose className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
