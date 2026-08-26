import "@testing-library/jest-dom";

/*
  O setup corre para TODOS os testes, incluindo os que pedem
  `@vitest-environment node` — e nesses não há `window`.

  Sem esta guarda, um teste em ambiente `node` nem chegava a arrancar:
  falhava aqui com `ReferenceError: window is not defined`. É o caso da
  exportação do DocGen, que precisa de um `Blob` a sério para conseguir ABRIR
  o DOCX e ver se as tabelas lá estão — o `Blob` do jsdom só tem `size`,
  `type` e `slice`.
*/
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
