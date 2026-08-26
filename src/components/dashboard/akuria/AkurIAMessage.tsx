import { useState, memo } from "react";
import { IconAdd, IconView, IconCheck, IconCopy, IconArrowRight } from '@/components/icons';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { tGlobal } from "@/lib/i18n-global";
import {
  parseAkurIAActions,
  getNavigateRoute,
  dispatchAkurIAAction,
  type AkurIAAction,
} from "@/lib/akuria-actions";

interface Props {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  isStreaming?: boolean;
  userInitials?: string;
}

function ActionButton({ action, onAfter }: { action: AkurIAAction; onAfter: () => void }) {
  const navigate = useNavigate();
  const Icon = action.type === "create" ? IconAdd : action.type === "open" ? IconView : IconArrowRight;

  const handle = () => {
    if (action.type === "navigate" || action.type === "open") {
      const route = getNavigateRoute(action);
      if (route) {
        navigate(route);
        onAfter();
        return;
      }
    }
    // create / open com payload → emite evento global
    dispatchAkurIAAction(action);
    onAfter();
  };

  return (
    <Button
      size="sm"
      variant="soft"
      onClick={handle}
      className="h-7 text-xs gap-1.5"
    >
      <Icon className="h-3 w-3" />
      {action.label}
    </Button>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function MessageInner({ role, content, timestamp, isStreaming, userInitials }: Props) {
  const [copied, setCopied] = useState(false);

  const isUser = role === "user";
  const parsed = isUser
    ? { cleanContent: content, actions: [] as AkurIAAction[] }
    : parseAkurIAActions(content);
  const cleanContent = parsed.cleanContent;
  // Filtra ações inválidas: 'open' sem UUID válido gera 404 na navegação.
  const validActions = parsed.actions.filter((a) => {
    if (a.type === "open") return a.payload && UUID_RE.test(a.payload);
    return true;
  });
  // Só renderiza botões após o stream terminar — evita flicker de botões
  // aparecendo/sumindo enquanto os tokens da tag chegam parcialmente.
  const actions = isStreaming ? [] : validActions;

  const copy = () => {
    navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    toast.success(tGlobal('cardsKpi.sweep.sistema.copiado'));
    setTimeout(() => setCopied(false), 2000);
  };

  const time = timestamp
    ? new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={`group flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-micro font-semibold border border-primary/20">
            {userInitials || "EU"}
          </div>
        ) : (
          <div className="h-7 w-7 rounded-full overflow-hidden border border-border bg-card">
            <img src="/akuris-favicon.png" alt="AkurIA" className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      {/* Bubble + meta */}
      <div className={`flex flex-col max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-lg px-3.5 py-2 text-sm ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted/70 text-foreground rounded-tl-sm border border-border/50"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:mb-2 prose-headings:mt-3 prose-headings:font-semibold prose-strong:text-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-background/80 prose-pre:border prose-pre:border-border prose-table:text-xs prose-th:border prose-th:border-border prose-th:px-2 prose-th:py-1 prose-th:bg-muted prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {cleanContent || (isStreaming ? "" : " ")}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-1.5 h-3.5 bg-primary/70 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Ações inline */}
        {!isUser && actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {actions.map((a, i) => (
              <ActionButton key={i} action={a} onAfter={() => {}} />
            ))}
          </div>
        )}

        {/* Footer: hora + copiar */}
        <div className={`flex items-center gap-2 mt-1 px-1 ${isUser ? "flex-row-reverse" : ""}`}>
          {time && <span className="text-micro text-muted-foreground">{time}</span>}
          {!isUser && cleanContent && !isStreaming && (
            <button
              onClick={copy}
              className="md:opacity-0 md:group-hover:opacity-100 transition-opacity text-micro text-muted-foreground hover:text-foreground flex items-center gap-1"
              title="Copiar"
            >
              {copied ? <IconCheck className="h-3 w-3" /> : <IconCopy className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const AkurIAMessage = memo(MessageInner);
