import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { formatStatus } from '@/lib/text-utils';
import { getEnumLabel } from '@/lib/enum-labels';
import { useLanguage } from '@/contexts/LanguageContext';

interface Risco {
  id: string;
  nome: string;
  nivel_risco_inicial: string;
  status: string;
}

interface RiscoSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function RiscoSelect({ value, onValueChange, placeholder }: RiscoSelectProps) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [riscos, setRiscos] = useState<Risco[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.empresa_id) {
      fetchRiscos();
    }
  }, [profile?.empresa_id]);

  const fetchRiscos = async () => {
    try {
      const { data, error } = await supabase
        .from('riscos')
        .select('id, nome, nivel_risco_inicial, status')
        .eq('empresa_id', profile?.empresa_id)
        .in('status', ['identificado', 'em_tratamento', 'monitorado'])
        .order('nome');

      if (error) throw error;
      
      setRiscos(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar riscos:', error);
      toast.error(t('controlesAuditorias.rsErrorLoad'));
    } finally {
      setLoading(false);
    }
  };

  const selectedRisco = riscos.find(risco => risco.id === value);

  const getNivelBadgeVariant = (nivel: string): "destructive" | "default" | "secondary" => {
    const nivelLower = nivel?.toLowerCase();
    if (nivelLower === 'critico' || nivelLower === 'alto') return "destructive";
    if (nivelLower === 'medio') return "secondary";
    return "default";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedRisco ? (
            <div className="flex items-center gap-2 truncate">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-orange-500" />
              <span className="truncate">{selectedRisco.nome}</span>
              <Badge variant={getNivelBadgeVariant(selectedRisco.nivel_risco_inicial)} className="ml-2 text-xs">
                {getEnumLabel(t, 'severidade', selectedRisco.nivel_risco_inicial)}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder ?? t('controlesAuditorias.rsPlaceholder')}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-popover" align="start">
        <Command>
          <CommandInput placeholder={t('controlesAuditorias.rsSearchPlaceholder')} />
          <CommandList>
            {loading ? (
              <CommandEmpty>{t('controlesAuditorias.rsLoading')}</CommandEmpty>
            ) : riscos.length === 0 ? (
              <CommandEmpty>{t('controlesAuditorias.rsEmpty')}</CommandEmpty>
            ) : (
              <CommandGroup>
                <CommandItem
                  value="nenhum"
                  onSelect={() => {
                    onValueChange("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground">{t('controlesAuditorias.rsNenhumRisco')}</span>
                </CommandItem>
                {riscos.map((risco) => (
                  <CommandItem
                    key={risco.id}
                    value={risco.nome}
                    onSelect={() => {
                      onValueChange(risco.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === risco.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-orange-500" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium truncate">{risco.nome}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={getNivelBadgeVariant(risco.nivel_risco_inicial)} className="text-xs">
                            {getEnumLabel(t, 'severidade', risco.nivel_risco_inicial)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{formatStatus(risco.status)}</Badge>
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
  );
}
