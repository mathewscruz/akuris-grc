import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import akurisLogo from '@/assets/akuris-logo.png';

interface PublicShellProps {
  children: ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-[hsl(216,60%,8%)] text-white flex flex-col">
      <header className="border-b border-white/10 bg-[hsl(216,60%,8%)]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={akurisLogo} alt="Akuris" className="h-7 w-auto" />
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/blog" className="text-white/70 hover:text-white transition">Blog</Link>
            <Link to="/" className="text-white/70 hover:text-white transition hidden sm:inline">Plataforma</Link>
            <Link
              to="/auth"
              className="px-4 py-2 rounded-lg bg-[hsl(252,100%,66%)] hover:bg-[hsl(252,100%,60%)] text-white text-sm font-medium transition"
            >
              Acessar
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10 mt-20">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/50">
          <div className="flex items-center gap-2">
            <img src={akurisLogo} alt="Akuris" className="h-5 w-auto opacity-70" />
            <span>© {new Date().getFullYear()} Akuris — Plataforma GRC</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/politica-privacidade" className="hover:text-white transition">Privacidade</Link>
            <a href="mailto:contato@akuris.com.br" className="hover:text-white transition">contato@akuris.com.br</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
