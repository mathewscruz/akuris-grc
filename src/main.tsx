import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import { installGlobalPointerEventsGuard } from './lib/radix-pointer-events'
import { repelirEnquadramento } from './lib/seguranca/anti-clickjacking'
import './index.css'

// Clickjacking: recusa correr dentro de um iframe hostil, antes de montar nada.
repelirEnquadramento();

// Impede que overlays empilhados deixem o body bloqueado (primeiro clique engolido).
installGlobalPointerEventsGuard();


createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
