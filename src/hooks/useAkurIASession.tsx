import { useCallback, useEffect, useRef, useState } from "react";

export type AkurIAMsg = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export interface AkurIAConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AkurIAMsg[];
}

const STORAGE_PREFIX = "akuria:conversations:";
const MAX_CONVERSATIONS = 20;

const keyFor = (userId: string | null) => `${STORAGE_PREFIX}${userId || "anon"}`;

function loadAll(userId: string | null): AkurIAConversation[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveAll(userId: string | null, list: AkurIAConversation[]) {
  try {
    const trimmed = list.slice(0, MAX_CONVERSATIONS);
    localStorage.setItem(keyFor(userId), JSON.stringify(trimmed));
  } catch {
    // Ignora quotaExceeded silenciosamente
  }
}

function makeTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 40) return cleaned || "Nova conversa";
  return cleaned.slice(0, 40) + "…";
}

export function useAkurIASession(userId: string | null) {
  const [conversations, setConversations] = useState<AkurIAConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Refs sempre com a última versão — evita closures obsoletos durante
  // streaming assíncrono. Bug corrigido: a 1ª mensagem não recebia resposta
  // porque activeId ainda era null quando os chunks chegavam ao
  // updateLastAssistant, que descartava tudo silenciosamente.
  const conversationsRef = useRef<AkurIAConversation[]>([]);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Carrega na inicialização
  useEffect(() => {
    const loaded = loadAll(userId);
    setConversations(loaded);
    conversationsRef.current = loaded;
    if (loaded.length > 0) {
      setActiveId(loaded[0].id);
      activeIdRef.current = loaded[0].id;
    }
  }, [userId]);

  const persist = useCallback(
    (next: AkurIAConversation[]) => {
      conversationsRef.current = next;
      setConversations(next);
      saveAll(userId, next);
    },
    [userId]
  );

  const active = conversations.find((c) => c.id === activeId) || null;

  const newConversation = useCallback(() => {
    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const conv: AkurIAConversation = {
      id,
      title: "Nova conversa",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    const next = [conv, ...conversationsRef.current];
    persist(next);
    activeIdRef.current = id;
    setActiveId(id);
    return conv;
  }, [persist]);

  const selectConversation = useCallback((id: string) => {
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      const next = conversationsRef.current.filter((c) => c.id !== id);
      persist(next);
      if (activeIdRef.current === id) {
        const newActive = next[0]?.id || null;
        activeIdRef.current = newActive;
        setActiveId(newActive);
      }
    },
    [persist]
  );

  // Retorna o id da conversa afetada de forma SÍNCRONA — permite ao caller
  // referenciar a conversa sem depender do state React (que ainda não foi
  // aplicado durante o streaming da primeira mensagem).
  const appendMessage = useCallback(
    (msg: AkurIAMsg): string => {
      let convId = activeIdRef.current;
      let list = conversationsRef.current;

      if (!convId) {
        const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const conv: AkurIAConversation = {
          id,
          title: msg.role === "user" ? makeTitle(msg.content) : "Nova conversa",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [msg],
        };
        list = [conv, ...list];
        convId = id;
        activeIdRef.current = id;
        setActiveId(id);
        persist(list);
        return convId;
      }

      const next = list.map((c) => {
        if (c.id !== convId) return c;
        const isFirstUserMsg = c.messages.length === 0 && msg.role === "user";
        return {
          ...c,
          title: isFirstUserMsg ? makeTitle(msg.content) : c.title,
          messages: [...c.messages, msg],
          updatedAt: Date.now(),
        };
      });
      persist(next);
      return convId;
    },
    [persist]
  );

  // Atualiza a última mensagem de assistente de UMA conversa específica.
  // Se convId não for informado, cai no activeIdRef atual.
  const updateAssistantIn = useCallback(
    (convId: string | null, content: string) => {
      const targetId = convId ?? activeIdRef.current;
      if (!targetId) return;
      const next = conversationsRef.current.map((c) => {
        if (c.id !== targetId) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, content };
        } else {
          msgs.push({ role: "assistant", content, timestamp: Date.now() });
        }
        return { ...c, messages: msgs, updatedAt: Date.now() };
      });
      persist(next);
    },
    [persist]
  );

  // Wrapper legado (usa a conversa ativa via ref).
  const updateLastAssistant = useCallback(
    (content: string) => updateAssistantIn(null, content),
    [updateAssistantIn]
  );

  const clearAll = useCallback(() => {
    persist([]);
    activeIdRef.current = null;
    setActiveId(null);
  }, [persist]);

  return {
    conversations,
    active,
    activeId,
    newConversation,
    selectConversation,
    deleteConversation,
    appendMessage,
    updateLastAssistant,
    updateAssistantIn,
    clearAll,
  };
}
