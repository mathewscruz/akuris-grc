/**
 * Frame-buster: o Akuris recusa-se a viver dentro de um iframe.
 *
 * ## Porque, se já há `X-Frame-Options` e `frame-ancestors`
 *
 * Aqueles dois são a defesa certa — mas dependem de o HOST servir os
 * cabeçalhos. Se o Akuris for servido por um host que ignora `public/_headers`
 * e `vercel.json`, um atacante embute a aplicação num iframe transparente por
 * cima de uma isca («clique para ganhar»), e o clique do utilizador vai para um
 * botão real do Akuris que ele não vê — clickjacking.
 *
 * Este módulo é a rede de segurança do lado do cliente: corre no arranque, e se
 * detectar que está enquadrado, quebra para fora. Não substitui os cabeçalhos;
 * cobre o intervalo em que eles possam faltar.
 *
 * É deliberadamente minúsculo e sem dependências, para correr antes de a
 * aplicação montar.
 */

export function repelirEnquadramento(): void {
  if (typeof window === 'undefined') return;

  try {
    // `window.top` diferente de `window.self` = estamos dentro de um frame.
    // O acesso a `top.location` de outra origem lança — o próprio erro é a
    // prova de que estamos enquadrados por um site hostil.
    if (window.top && window.self !== window.top) {
      /*
        Tentar levar o frame de topo para a nossa origem. Se a política de
        origem cruzada impedir a escrita, ao menos escondemos o conteúdo para
        o clique não cair num botão invisível.
      */
      try {
        window.top.location.href = window.self.location.href;
      } catch {
        document.documentElement.style.display = 'none';
      }
    }
  } catch {
    // Mesmo o simples ler `window.top` pode lançar num frame de origem cruzada.
    // Lançar é sinal de enquadramento hostil: esconde por precaução.
    document.documentElement.style.display = 'none';
  }
}
