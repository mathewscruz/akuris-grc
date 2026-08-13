import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Controle {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  status: string;
}

interface ControleSelectProps {
  value?: string;
  onValueChange: (value: string, controle?: Controle) => void;
  placeholder?: string;
}

export function ControleSelect({
  value,
  onValueChange,
  placeholder,
}: ControleSelectProps) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const [controles, setControles] = useState<Controle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (empresaId) {
      fetchControles();
    }
  }, [empresaId]);

  const fetchControles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("controles")
        .select("id, nome, descricao, tipo, status")
        .eq("empresa_id", empresaId!)
        .order("nome");

      if (error) throw error;
      setControles(data || []);
    } catch (error) {
      console.error("Erro ao buscar controles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (newValue: string) => {
    const actualValue = newValue === "_none" ? "" : newValue;
    const controle = controles.find((c) => c.id === actualValue);
    onValueChange(actualValue, controle);
  };

  return (
    <Select value={value || "_none"} onValueChange={handleChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder ?? t('controlesAuditorias.csPlaceholder')}>
          {value && controles.find((c) => c.id === value)?.nome}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">
          <span className="text-muted-foreground">{t('controlesAuditorias.csNenhum')}</span>
        </SelectItem>
        {loading ? (
          <SelectItem value="_loading" disabled>
            {t('controlesAuditorias.csLoading')}
          </SelectItem>
        ) : (
          controles.map((controle) => (
            <SelectItem key={controle.id} value={controle.id}>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-muted-foreground" />
                <span>{controle.nome}</span>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
