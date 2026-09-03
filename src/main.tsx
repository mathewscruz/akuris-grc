// PRIMEIRA de todas: troca o `fetch` antes de o cliente do Supabase nascer.
// O `supabase-js` guarda o `fetch` que encontrar na criação; trocado depois,
// não intercepta nada.
import './lib/atualizar-apos-escrita'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import { installGlobalPointerEventsGuard } from './lib/radix-pointer-events'
import './index.css'

// Clickjacking é bloqueado no servidor (X-Frame-Options / CSP frame-ancestors).
// Um frame-buster em JS aqui apagaria a página dentro de iframes legítimos
// (ex.: janela de pré-visualização do editor), por isso não existe guard de
// enquadramento no cliente.

// Impede que overlays empilhados deixem o body bloqueado (primeiro clique engolido).
installGlobalPointerEventsGuard();


createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
