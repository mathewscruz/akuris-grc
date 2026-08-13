/**
 * Escuta o evento global "akuria:action" emitido pelo chatbot e:
 * - Para ações `create:<modulo>`, navega à página correta com `?akuria_action=create`.
 * - Para `open:<modulo>:<id>`, navega à página com `?akuria_open=<id>`.
 *
 * Cada página interessada pode ler esses params e abrir seu Dialog correspondente.
 * Esse desacoplamento evita ter que modificar todos os módulos.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type AkurIAAction,
  getNavigateRoute,
} from "@/lib/akuria-actions";

const CREATE_ROUTES: Record<string, string> = {
  risco: "/riscos",
  riscos: "/riscos",
  incidente: "/incidentes",
  incidentes: "/incidentes",
  controle: "/governanca?tab=controles",
  controles: "/governanca?tab=controles",
  plano_acao: "/planos-acao",
  planos_acao: "/planos-acao",
  documento: "/documentos",
  documentos: "/documentos",
  contrato: "/contratos",
  contratos: "/contratos",
  ativo: "/ativos",
  ativos: "/ativos",
  denuncia: "/denuncia",
  denuncias: "/denuncia",
  fornecedor: "/due-diligence",
  fornecedores: "/due-diligence",
};

const MODULE_FRIENDLY_KEY: Record<string, string> = {
  risco: "riscos",
  incidente: "incidentes",
  controle: "controles",
  plano_acao: "planos_acao",
  documento: "documentos",
  contrato: "contratos",
  ativo: "ativos",
  denuncia: "denuncias",
  fornecedor: "fornecedores",
};

function appendParam(route: string, key: string, value: string): string {
  const sep = route.includes("?") ? "&" : "?";
  return `${route}${sep}${key}=${encodeURIComponent(value)}`;
}

export function AkurIAActionListener() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const handler = (e: Event) => {
      const action = (e as CustomEvent<AkurIAAction>).detail;
      if (!action) return;

      if (action.type === "create") {
        const key = action.target.toLowerCase();
        const route = CREATE_ROUTES[key];
        if (!route) {
          toast.info(t("dashWidgets.akuria.moduleNotSupported"));
          return;
        }
        const friendlyKey = MODULE_FRIENDLY_KEY[key];
        const friendly = friendlyKey ? t(`dashWidgets.akuria.modules.${friendlyKey}`) : key;
        toast.success(t("dashWidgets.akuria.openingModule", { module: friendly }));
        navigate(appendParam(route, "akuria_action", "create"));
        return;
      }

      if (action.type === "open" && action.payload) {
        const route = getNavigateRoute(action);
        if (!route) {
          toast.info(t("dashWidgets.akuria.itemNotFound"));
          return;
        }
        navigate(appendParam(route, "akuria_open", action.payload));
        return;
      }

      if (action.type === "navigate") {
        const route = getNavigateRoute(action);
        if (route) navigate(route);
      }
    };

    window.addEventListener("akuria:action", handler as EventListener);
    return () => window.removeEventListener("akuria:action", handler as EventListener);
  }, [navigate]);

  return null;
}
