import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { politicaCspParaMeta } from "./src/lib/seguranca/politica-csp";

/**
 * Injeta o `<meta>` de CSP APENAS no build de produção.
 *
 * Em desenvolvimento o Vite precisa de `eval` e de inline para o HMR — um CSP
 * estrito partiria o servidor de dev. Por isso a política não vive no
 * `index.html` (que o dev também serve); é colada aqui, e só quando `apply` é
 * `build`. O dev fica intacto, a produção fica trancada.
 *
 * Os ficheiros de header do host (`public/_headers`, `vercel.json`) servem a
 * mesma política como cabeçalho HTTP — que é mais forte, e é onde o
 * `frame-ancestors` vale. O `<meta>` é a rede de segurança para o caso de o
 * host não aplicar os ficheiros.
 */
function cspNoBuild(): Plugin {
  return {
    name: "akuris-csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${politicaCspParaMeta()}" />`;
      return html.replace("</head>", `  ${meta}\n  </head>`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    // 8080 continua a ser a porta do Lovable; PORT permite subir uma segunda
    // instância local sem colidir com a que já estiver a correr.
    port: Number(process.env.PORT) || 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    cspNoBuild(),
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
