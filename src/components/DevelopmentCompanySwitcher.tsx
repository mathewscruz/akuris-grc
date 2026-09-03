import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

interface DevelopmentCompany {
  id: string;
  nome: string;
  ativo: boolean;
}

export function DevelopmentCompanySwitcher() {
  const {
    profile,
    selectDevelopmentCompany,
    developmentCompanySwitchEnabled,
  } = useAuth();
  const queryClient = useQueryClient();
  const [companies, setCompanies] = React.useState<DevelopmentCompany[]>([]);
  const [switching, setSwitching] = React.useState(false);

  React.useEffect(() => {
    if (!developmentCompanySwitchEnabled) {
      setCompanies([]);
      return;
    }

    let active = true;
    supabase
      .from('empresas')
      .select('id, nome, ativo')
      .order('nome')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          toast.error('Não foi possível carregar as empresas locais.');
          return;
        }
        setCompanies(data ?? []);
      });

    return () => {
      active = false;
    };
  }, [developmentCompanySwitchEnabled]);

  if (!developmentCompanySwitchEnabled) return null;

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const companyId = event.target.value;
    if (!companyId || companyId === profile?.empresa_id) return;

    setSwitching(true);
    try {
      await selectDevelopmentCompany(companyId);
      await queryClient.invalidateQueries();
      const companyName = companies.find((company) => company.id === companyId)?.nome;
      toast.success(companyName ? `Empresa alterada para ${companyName}.` : 'Empresa alterada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível trocar de empresa.');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <label
      className="hidden md:flex items-center gap-2"
      title="Seletor disponível somente no ambiente local"
    >
      <span className="text-xs text-muted-foreground">Empresa</span>
      <select
        aria-label="Empresa de desenvolvimento"
        className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary disabled:cursor-wait disabled:opacity-60"
        value={profile?.empresa_id ?? ''}
        disabled={switching}
        onChange={handleChange}
      >
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.nome}{company.ativo ? '' : ' (inativa)'}
          </option>
        ))}
      </select>
    </label>
  );
}
