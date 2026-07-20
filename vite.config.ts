import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa bibliotecas pesadas em chunks próprios para não inflar o
        // bundle inicial. São usadas apenas em telas específicas (geração de
        // PDF, importação/exportação de documentos e gráficos), então ficam
        // fora do carregamento inicial e são baixadas sob demanda.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("jspdf") ||
              id.includes("html2canvas") ||
              id.includes("pdfjs-dist")
            ) {
              return "pdf-vendor";
            }
            if (id.includes("docx") || id.includes("mammoth")) {
              return "docx-vendor";
            }
            if (id.includes("recharts") || id.includes("/d3-")) {
              return "charts-vendor";
            }
          }
        },
      },
    },
  },
}));
