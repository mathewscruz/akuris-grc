import { useContext } from 'react';
import { AuthContext } from '@/components/AuthProvider';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';

function Opener() {
  const { setOpenMobile } = useSidebar();
  return <button id="open-mobile" onClick={() => setOpenMobile(true)}>open</button>;
}

/** Página temporária de desenvolvimento para testar o menu sem login. */
export default function SidebarPreview() {
  const real = useContext(AuthContext)!;
  const value = { ...real, company: null, signOut: async () => {} } as any;
  return (
    <AuthContext.Provider value={value}>
      <SidebarProvider style={{ '--sidebar-width': '6.5rem' } as React.CSSProperties}>
        <div className="flex h-screen w-full overflow-hidden">
          <AppSidebar previewAllAccess />
          <main className="flex-1 p-4"><Opener /></main>
        </div>
      </SidebarProvider>
    </AuthContext.Provider>
  );
}
