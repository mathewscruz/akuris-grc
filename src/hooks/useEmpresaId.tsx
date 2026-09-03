import { useAuth } from '@/components/AuthProvider';

export function useEmpresaId() {
  const { profile, loading } = useAuth();

  // O AuthProvider já é a fonte de verdade para usuário, perfil e empresa.
  // Consultar `profiles` novamente em cada consumidor criava dezenas de
  // requests idênticos e, no preview local do superadmin, ignorava a empresa
  // escolhida no seletor. Além do custo, componentes diferentes podiam mostrar
  // empresas diferentes na mesma tela.
  return { empresaId: profile?.empresa_id ?? null, loading };
}
