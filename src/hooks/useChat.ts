import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  ChatSession,
  ModelProgress,
  WorkerResponse,
} from "@/types/chat";

const STORAGE_KEY = "llama-chat-sessions";
const ACTIVE_SESSION_KEY = "llama-chat-active-session";
const SYSTEM_PROMPT: ChatMessage = {
  id: "system",
  role: "system",
  content:
    "You are a helpful, harmless, and honest AI assistant. You provide clear, accurate, and concise responses. You can help with coding, writing, analysis, math, and general questions.",
  timestamp: Date.now(),
};

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function createDefaultSession(): ChatSession {
  const now = Date.now();
  return {
    id: generateId(),
    title: "New Chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
    modelName: "Llama 3.2 3B",
  };
}

export function useChat() {
  const workerRef = useRef<Worker | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_SESSION_KEY) || "";
  });
  const [modelProgress, setModelProgress] = useState<ModelProgress>({
    progress: 0,
    text: "",
    status: "idle",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const currentSession = sessions.find((s) => s.id === activeSessionId) || createDefaultSession();

  const initWorker = useCallback(() => {
    if (workerRef.current) return;

    const worker = new Worker(new URL("../workers/llm.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { type, payload } = e.data;

      switch (type) {
        case "initProgress": {
          setModelProgress({
            progress: payload.progress,
            text: payload.text,
            status: payload.progress >= 100 ? "ready" : "downloading",
          });
          break;
        }
        case "ready": {
          setModelProgress({
            progress: 100,
            text: "Model ready",
            status: "ready",
          });
          break;
        }
        case "chunk": {
          setSessions((prev) => {
            const session = prev.find((s) => s.id === activeSessionId);
            if (!session) return prev;

            const lastMsg = session.messages[session.messages.length - 1];
            if (lastMsg && lastMsg.role === "assistant" && lastMsg.isStreaming) {
              const updatedMessages = session.messages.slice(0, -1).concat({
                ...lastMsg,
                content: payload.fullResponse,
              });
              const updatedSession = {
                ...session,
                messages: updatedMessages,
                updatedAt: Date.now(),
              };
              const newSessions = prev.map((s) => (s.id === activeSessionId ? updatedSession : s));
              saveSessions(newSessions);
              return newSessions;
            }
            return prev;
          });
          break;
        }
        case "done": {
          setIsGenerating(false);
          setSessions((prev) => {
            const session = prev.find((s) => s.id === activeSessionId);
            if (!session) return prev;

            const lastMsg = session.messages[session.messages.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              const updatedMessages = session.messages.slice(0, -1).concat({
                ...lastMsg,
                isStreaming: false,
              });
              const updatedSession = {
                ...session,
                messages: updatedMessages,
                updatedAt: Date.now(),
              };
              const newSessions = prev.map((s) => (s.id === activeSessionId ? updatedSession : s));
              saveSessions(newSessions);
              return newSessions;
            }
            return prev;
          });
          break;
        }
        case "error": {
          setIsGenerating(false);
          setModelProgress((prev) => ({
            ...prev,
            text: payload.message,
            status: "error",
          }));
          console.error("Worker error:", payload);
          break;
        }
      }
    };

    worker.onerror = (err) => {
      console.error("Worker error:", err);
      setIsGenerating(false);
      setModelProgress({
        progress: 0,
        text: "Worker error: " + (err.message || "Unknown error"),
        status: "error",
      });
    };

    workerRef.current = worker;
    worker.postMessage({ type: "init" });
    setModelProgress({ progress: 0, text: "Loading model...", status: "loading" });
  }, [activeSessionId]);

  useEffect(() => {
    initWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [initWorker]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!workerRef.current || isGenerating) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content,
        timestamp: Date.now(),
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      setSessions((prev) => {
        let session = prev.find((s) => s.id === activeSessionId);
        let newSessions = prev;
        let targetId = activeSessionId;

        if (!session) {
          session = createDefaultSession();
          session.id = activeSessionId || session.id;
          targetId = session.id;
          if (!activeSessionId) {
            setActiveSessionId(session.id);
            localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
          }
          newSessions = [session, ...prev];
        }

        const updatedSession = {
          ...session,
          messages: [...session.messages, userMsg, assistantMsg],
          updatedAt: Date.now(),
          title: session.title === "New Chat" && session.messages.length === 0
            ? content.slice(0, 40) + (content.length > 40 ? "..." : "")
            : session.title,
        };

        newSessions = newSessions.map((s) => (s.id === targetId ? updatedSession : s));
        saveSessions(newSessions);

        const messagesForWorker = [SYSTEM_PROMPT, ...updatedSession.messages.filter((m) => !m.isStreaming)]
          .map((m) => ({
            role: m.role as any,
            content: m.content,
          }));

        workerRef.current?.postMessage({
          type: "generate",
          payload: { messages: messagesForWorker },
        });

        return newSessions;
      });

      setIsGenerating(true);
    },
    [activeSessionId, isGenerating]
  );

  const stopGeneration = useCallback(() => {
    workerRef.current?.postMessage({ type: "stop" });
    setIsGenerating(false);
  }, []);

  const createNewChat = useCallback(() => {
    const session = createDefaultSession();
    setSessions((prev) => {
      const exists = prev.find((s) => s.id === session.id);
      if (exists) return prev;
      const newSessions = [session, ...prev];
      saveSessions(newSessions);
      return newSessions;
    });
    setActiveSessionId(session.id);
    localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const newSessions = prev.filter((s) => s.id !== id);
        saveSessions(newSessions);
        if (activeSessionId === id) {
          const next = newSessions[0]?.id || "";
          setActiveSessionId(next);
          localStorage.setItem(ACTIVE_SESSION_KEY, next);
        }
        return newSessions;
      });
    },
    [activeSessionId]
  );

  const clearAllSessions = useCallback(() => {
    setSessions([]);
    saveSessions([]);
    const session = createDefaultSession();
    setActiveSessionId(session.id);
    localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
    setSessions([session]);
    saveSessions([session]);
  }, []);

  const retryLastMessage = useCallback(() => {
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session || !workerRef.current || isGenerating) return;

    const userMessages = session.messages.filter((m) => m.role === "user");
    const lastUserMessage = userMessages[userMessages.length - 1];
    if (!lastUserMessage) return;

    setSessions((prev) => {
      const s = prev.find((p) => p.id === activeSessionId);
      if (!s) return prev;

      const withoutLastAssistant = s.messages.filter(
        (m, idx, arr) =>
          !(m.role === "assistant" && idx === arr.length - 1 && arr[idx - 1]?.role === "user")
      );

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      const updated = {
        ...s,
        messages: [...withoutLastAssistant, assistantMsg],
        updatedAt: Date.now(),
      };

      const newSessions = prev.map((p) => (p.id === activeSessionId ? updated : p));
      saveSessions(newSessions);

      const messagesForWorker = [SYSTEM_PROMPT, ...updated.messages]
        .filter((m) => m.role !== "system" || m.id === "system")
        .map((m) => ({ role: m.role, content: m.content }));

      workerRef.current?.postMessage({
        type: "generate",
        payload: { messages: messagesForWorker },
      });

      return newSessions;
    });

    setIsGenerating(true);
  }, [activeSessionId, sessions, isGenerating]);

  return {
    sessions,
    activeSessionId,
    currentSession,
    modelProgress,
    isGenerating,
    sendMessage,
    stopGeneration,
    createNewChat,
    switchSession,
    deleteSession,
    clearAllSessions,
    retryLastMessage,
  };
}
