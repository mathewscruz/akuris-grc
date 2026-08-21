import React from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
  routeKey: string;
}

/**
 * Aplica `animate-page-enter` a cada mudança de rota.
 * O `key` força remount do wrapper, fazendo a animação re-disparar
 * em todas as transições (não apenas no primeiro mount).
 */
const PageTransition: React.FC<PageTransitionProps> = ({ children, routeKey }) => {
  return (
    /* `flex flex-1 flex-col` continua a cadeia de altura que vem do `main`:
       é o que permite a uma página esticar o seu último bloco até ao fim do
       ecrã. Com um só filho, uma coluna flex dispõe-se como um bloco — as
       páginas que não pedem altura não notam diferença. */
    <div
      key={routeKey}
      className="animate-page-enter will-change-[opacity,transform] flex flex-1 flex-col"
    >
      {children}
    </div>
  );
};

export default PageTransition;
