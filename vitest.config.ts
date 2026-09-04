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
    // O runner Linux tem poucos núcleos; abrir um worker por ficheiro atrasava
    // a comunicação RPC e podia reprovar a suíte mesmo com 100% dos testes
    // aprovados. Um worker deixa o núcleo inteiro para os testes de componentes
    // com portais Radix e evita o watchdog de 60 s do canal entre processos.
    maxWorkers: process.env.CI ? 1 : undefined,
    // Mantém a saída dos testes aprovados silenciosa. Alguns componentes
    // legados emitem centenas de avisos do React e saturavam o canal RPC do
    // worker, apesar de toda a suíte concluir sem falhas.
    silent: 'passed-only',
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
