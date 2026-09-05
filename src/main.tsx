// PRIMEIRA de todas: troca o `fetch` antes de o cliente do Supabase nascer.
// O `supabase-js` guarda o `fetch` que encontrar na criação; trocado depois,
// não intercepta nada.
import './lib/atualizar-apos-escrita'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import { installGlobalPointerEventsGuard } from './lib/radix-pointer-events'
import { protegerContraEnquadramento } from './lib/seguranca/clickjacking'
import './index.css'
import { initializeMotionPreferences } from './lib/motion-preferences'

initializeMotionPreferences();

// Executa antes do primeiro render. No domínio público complementa os
// cabeçalhos anti-clickjacking; em desenvolvimento/preview não interfere.
protegerContraEnquadramento();

// Impede que overlays empilhados deixem o body bloqueado (primeiro clique engolido).
installGlobalPointerEventsGuard();


createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
