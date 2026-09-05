/**
 * Defesa complementar contra clickjacking no domínio público.
 *
 * A proteção principal continua a ser feita pelos cabeçalhos HTTP
 * (`frame-ancestors 'none'` e `X-Frame-Options: DENY`). Alguns hosts de SPA,
 * porém, não aplicam ficheiros de cabeçalhos estáticos. Nesse cenário, esta
 * barreira impede que a interface autenticada seja exibida dentro de um frame.
 *
 * O bloqueio é deliberadamente limitado ao domínio de produção para não partir
 * a pré-visualização do editor, que usa um iframe legítimo noutro hostname.
 */
export function eDominioPublicoAkuris(hostname: string): boolean {
  const normalizado = hostname.toLowerCase();
  return normalizado === 'akuris.pt' || normalizado.endsWith('.akuris.pt');
}

export function protegerContraEnquadramento(): void {
  const producao = eDominioPublicoAkuris(window.location.hostname);

  if (!producao || window.self === window.top) return;

  // Oculta antes do primeiro render. Mesmo que o navegador impeça a navegação
  // do frame para o topo, nenhum controlo clicável ou dado fica exposto.
  document.documentElement.style.display = 'none';

  try {
    window.top?.location.replace(window.self.location.href);
  } catch {
    // Frames cross-origin/sandboxed podem bloquear a navegação. A página já
    // está invisível, que é o comportamento seguro nesse caso.
  }
}
