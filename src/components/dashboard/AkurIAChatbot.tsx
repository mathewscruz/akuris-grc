import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { X, Send, Maximize2, Minimize2, History, StopCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { useAkurIASession, type AkurIAMsg } from "@/hooks/useAkurIASession";
import { AkurIAMessage } from "./akuria/AkurIAMessage";
import { AkurIAQuickPrompts } from "./akuria/AkurIAQuickPrompts";
import { AkurIASidebar } from "./akuria/AkurIASidebar";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/akuria-chat`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type PanelMode = "compact" | "expanded" | "fullscreen";

const userInitialsFrom = (name: string | null | undefined) => {
  if (!name) return "EU";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase() || "EU";
};

export function AkurIAChatbot() {
  const { user, session, profile } = useAuth();
  const { locale } = useLanguage();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [mode, setMode] = useState<PanelMode>("compact");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const session_ = useAkurIASession(user?.id || null);
  const { active, conversations, activeId, newConversation, selectConversation, deleteConversation, appendMessage, updateAssistantIn } = session_;

  const messages = active?.messages || [];

  // Foca o input ao abrir
  useEffect(() => {
    if (open && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open, mode]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  // Fecha sidebar quando muda para compact
  useEffect(() => {
    if (mode === "compact") setShowSidebar(false);
  }, [mode]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const send = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || isLoading) return;

      const userMsg: AkurIAMsg = { role: "user", content: text, timestamp: Date.now() };
      // Captura convId SÍNCRONO — evita closure stale de activeId quando a
      // 1ª mensagem cria conversa nova durante o streaming.
      const targetConvId = appendMessage(userMsg);
      setInput("");
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // Constrói histórico para enviar (inclui a nova msg)
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

      let assistantSoFar = "";

      try {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || PUBLISHABLE_KEY}`,
            apikey: PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: history,
            currentRoute: location.pathname,
            locale: locale,
          }),
        });

        if (resp.status === 402) {
          toast.error("Créditos de IA esgotados.");
          setIsLoading(false);
          return;
        }
        if (resp.status === 429) {
          toast.error("Muitas requisições. Aguarde um momento.");
          setIsLoading(false);
          return;
        }
        if (!resp.ok || !resp.body) {
          toast.error("Erro ao conectar com AkurIA.");
          setIsLoading(false);
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";

        const upsert = (chunk: string) => {
          assistantSoFar += chunk;
          updateAssistantIn(targetConvId, assistantSoFar);
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) upsert(content);
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) upsert(content);
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e: any) {
        if (e?.name === "AbortError") {
          // cancelamento intencional
        } else {
          console.error("AkurIA error:", e);
          toast.error("Erro ao comunicar com AkurIA.");
        }
      } finally {
        abortRef.current = null;
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, session, location.pathname, locale, appendMessage, updateAssistantIn]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const userInitials = userInitialsFrom(profile?.nome);

  // Dimensões por modo
  const panelClass = cn(
    "fixed z-50 rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.35)] flex overflow-hidden animate-fade-in",
    mode === "compact" && "inset-x-3 bottom-20 md:bottom-6 md:right-6 md:left-auto md:w-[400px] h-[calc(100vh-9rem)] max-h-[600px]",
    mode === "expanded" && "inset-x-3 bottom-20 md:bottom-6 md:right-6 md:left-auto md:w-[640px] h-[calc(100vh-7rem)] max-h-[760px]",
    mode === "fullscreen" && "inset-4 md:inset-10 max-h-none max-w-none"
  );

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 h-14 w-14 rounded-full bg-card shadow-lg border border-border/60 hover:shadow-[0_0_30px_hsl(var(--primary)/0.4)] transition-all duration-300 hover:scale-110 flex items-center justify-center animate-fade-in group"
          title="AkurIA — Assistente Inteligente"
        >
          <span className="absolute inset-0 rounded-full bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <img
            src="/akuris-favicon.png"
            alt="AkurIA"
            className="h-8 w-8 rounded-full animate-[spin-burst_5s_ease-in-out_infinite] relative z-10"
          />
        </button>
      )}

      {/* Painel */}
      {open && (
        <div className={panelClass}>
          {/* Sidebar de conversas */}
          {showSidebar && mode !== "compact" && (
            <div className="w-56 shrink-0">
              <AkurIASidebar
                conversations={conversations}
                activeId={activeId}
                onSelect={selectConversation}
                onNew={newConversation}
                onDelete={deleteConversation}
              />
            </div>
          )}

          {/* Coluna principal */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-gradient-to-r from-primary/5 via-primary/[0.03] to-transparent">
              <div className="relative">
                <img src="/akuris-favicon.png" alt="AkurIA" className="h-8 w-8 rounded-full" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-card" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground leading-tight">AkurIA</h3>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {isLoading ? "digitando…" : "Assistente GRC Inteligente"}
                </p>
              </div>

              <div className="flex items-center gap-0.5">
                {mode !== "compact" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowSidebar((v) => !v)}
                    title="Histórico"
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={newConversation}
                  title="Nova conversa"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() =>
                    setMode((m) => (m === "compact" ? "expanded" : m === "expanded" ? "fullscreen" : "compact"))
                  }
                  title={mode === "fullscreen" ? "Reduzir" : "Expandir"}
                >
                  {mode === "fullscreen" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="px-4 py-3 space-y-3">
                {messages.length === 0 && (
                  <div className="py-6 text-center space-y-2">
                    <div className="h-12 w-12 rounded-full mx-auto bg-primary/10 flex items-center justify-center">
                      <img src="/akuris-favicon.png" alt="" className="h-8 w-8 rounded-full" />
                    </div>
                    <p className="font-medium text-sm text-foreground">Olá, {profile?.nome?.split(" ")[0] || "tudo bem"}? 👋</p>
                    <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                      Sou a AkurIA. Posso analisar seus dados de GRC, sugerir ações e abrir telas pra você.
                    </p>
                    <AkurIAQuickPrompts route={location.pathname} onPick={(p) => send(p)} />
                  </div>
                )}

                {messages.map((m, i) => (
                  <AkurIAMessage
                    key={i}
                    role={m.role}
                    content={m.content}
                    timestamp={m.timestamp}
                    userInitials={userInitials}
                    isStreaming={isLoading && i === messages.length - 1 && m.role === "assistant"}
                  />
                ))}

                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex gap-2.5">
                    <div className="h-7 w-7 rounded-full overflow-hidden border border-border bg-card shrink-0">
                      <img src="/akuris-favicon.png" alt="AkurIA" className="h-full w-full object-cover" />
                    </div>
                    <div className="bg-muted/70 border border-border/50 rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t border-border/50 p-2.5 bg-background/50">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex gap-1.5 items-end"
              >
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte sobre GRC… (Shift+Enter quebra linha)"
                  rows={1}
                  className="flex-1 resize-none min-h-[36px] max-h-[120px] text-sm py-2 px-3 rounded-lg"
                  disabled={isLoading}
                />
                {isLoading ? (
                  <Button type="button" size="icon" variant="destructive" className="h-9 w-9 shrink-0" onClick={stop} title="Cancelar">
                    <StopCircle className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </form>
              {input.length > 500 && (
                <p className="text-[10px] text-muted-foreground text-right mt-1">{input.length} caracteres</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
