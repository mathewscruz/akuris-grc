
import { useState } from "react";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useUsuariosEmpresa } from "@/hooks/useAuditoriaData";
import { useLanguage } from "@/contexts/LanguageContext";

interface AuditorSelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const AuditorSelect = ({ value, onChange, placeholder }: AuditorSelectProps) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { data: usuarios, isLoading } = useUsuariosEmpresa();

  const selectedUser = usuarios?.find(user => user.user_id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedUser ? (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{selectedUser.nome}</span>
              <span className="text-muted-foreground">({selectedUser.email})</span>
            </div>
          ) : (
            placeholder ?? t('controlesAuditorias.audSelPlaceholder')
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder={t('controlesAuditorias.audSelSearchPlaceholder')} />
          <CommandEmpty>
            {isLoading ? t('controlesAuditorias.audSelLoading') : t('controlesAuditorias.audSelEmpty')}
          </CommandEmpty>
          <CommandGroup>
            {usuarios?.map((user) => (
              <CommandItem
                key={user.user_id}
                value={user.nome}
                onSelect={() => {
                  onChange(user.user_id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === user.user_id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <div className="flex flex-col">
                    <span>{user.nome}</span>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default AuditorSelect;
