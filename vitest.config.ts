import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Mantém a saída dos testes aprovados silenciosa. Alguns componentes
    // legados emitem centenas de avisos do React e saturavam o canal RPC do
    // worker, apesar de toda a suíte concluir sem falhas.
    silent: 'passed-only',
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
