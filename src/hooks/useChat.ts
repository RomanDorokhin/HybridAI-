import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  ChatRole,
  ChatSession,
  ModelProgress,
  WorkerChatMessage,
  WorkerRequest,
  WorkerResponse,
} from "@/types/chat";

const STORAGE_KEY = "llama-chat-sessions";
const ACTIVE_SESSION_KEY = "llama-chat-active-session";
const SYSTEM_PROMPT: ChatMessage = {
  id: "system",
  role: "system",
  content: `You are OpenGame, a specialized game design agent. Your goal is to help the user create a 2D game by following the OpenSmolGame protocol.

When the user describes their game idea, you MUST eventually provide a final GAME PROMPT in the following structured format:

WORLD: [Environment description, e.g., "Neon cyberpunk city with rain and fog"]
PLAYER: [Hero description and mechanics, e.g., "Cyber-ninja with katana and dash ability"]
ENEMIES: [Enemy types and behavior, e.g., "Robot drones that fire lasers from a distance"]

GUIDELINES:
1. First, ask 2-3 clarifying questions to understand the genre, player abilities, and world setting.
2. Once the idea is clear, output the structured WORLD/PLAYER/ENEMIES prompt.
3. Be concise and creative. Use technical but descriptive language.
4. If the user says "давай напишем игру" or similar, start the interviewing process immediately.`,
  timestamp: Date.now(),
};

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isChatRole(role: unknown): role is ChatRole {
  return role === "user" || role === "assistant" || role === "system";
}

function normalizeSession(input: unknown): ChatSession | null {
  if (!input || typeof input !== "object") return null;

  const session = input as Partial<ChatSession>;
  if (typeof session.id !== "string" || !Array.isArray(session.messages)) return null;

  const messages = session.messages
    .filter((message): message is ChatMessage => {
      return Boolean(
        message &&
          typeof message.id === "string" &&
          isChatRole(message.role) &&
          typeof message.content === "string" &&
          typeof message.timestamp === "number"
      );
    })
    .map((message) => ({ ...message, isStreaming: false }));

  return {
    id: session.id,
    title: typeof session.title === "string" && session.title.trim() ? session.title : "New Chat",
    messages,
    createdAt: typeof session.createdAt === "number" ? session.createdAt : Date.now(),
    updatedAt: typeof session.updatedAt === "number" ? session.updatedAt : Date.now(),
    modelName: typeof session.modelName === "string" ? session.modelName : "Qwen 2.5 0.5B Specialized",
  };
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.map(normalizeSession).filter((session): session is ChatSession => session !== null);
  } catch (error) {
    console.warn("Failed to load chat sessions from localStorage", error);
    return [];
  }
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
    modelName: "Qwen 2.5 0.5B Specialized",
  };
}

function createInitialState() {
  const loadedSessions = loadSessions();
  const sessions = loadedSessions.length > 0 ? loadedSessions : [createDefaultSession()];
  const savedActiveId = localStorage.getItem(ACTIVE_SESSION_KEY) || "";
  const activeSessionId = sessions.some((session) => session.id === savedActiveId)
    ? savedActiveId
    : sessions[0].id;

  saveSessions(sessions);
  localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);

  return { sessions, activeSessionId };
}

function buildWorkerMessages(session: ChatSession): WorkerChatMessage[] {
  return [SYSTEM_PROMPT, ...session.messages.filter((message) => !message.isStreaming)].map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function postWorkerMessage(worker: Worker | null, message: WorkerRequest) {
  worker?.postMessage(message);
}

export function useChat() {
  const [initialState] = useState(createInitialState);

  const workerRef = useRef<Worker | null>(null);
  const activeSessionIdRef = useRef(initialState.activeSessionId);
  const [sessions, setSessions] = useState<ChatSession[]>(initialState.sessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(initialState.activeSessionId);
  const [modelProgress, setModelProgress] = useState<ModelProgress>({
    progress: 0,
    text: "Loading model...",
    status: "loading",
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const currentSession = sessions.find((session) => session.id === activeSessionId) || sessions[0] || createDefaultSession();

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/llm.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, payload } = event.data;

      switch (type) {
        case "initProgress":
        case "progress": {
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
          const targetSessionId = payload.sessionId || activeSessionIdRef.current;
          setSessions((previousSessions) => {
            const session = previousSessions.find((item) => item.id === targetSessionId);
            if (!session) return previousSessions;

            const lastMessage = session.messages[session.messages.length - 1];
            if (!lastMessage || lastMessage.role !== "assistant" || !lastMessage.isStreaming) return previousSessions;

            const updatedSession = {
              ...session,
              messages: session.messages.slice(0, -1).concat({
                ...lastMessage,
                content: payload.fullResponse,
              }),
              updatedAt: Date.now(),
            };
            const nextSessions = previousSessions.map((item) => (item.id === targetSessionId ? updatedSession : item));
            saveSessions(nextSessions);
            return nextSessions;
          });
          break;
        }
        case "done": {
          const targetSessionId = payload.sessionId || activeSessionIdRef.current;
          setIsGenerating(false);
          setSessions((previousSessions) => {
            const session = previousSessions.find((item) => item.id === targetSessionId);
            if (!session) return previousSessions;

            const lastMessage = session.messages[session.messages.length - 1];
            if (!lastMessage || lastMessage.role !== "assistant") return previousSessions;

            const finalContent = payload.fullResponse || lastMessage.content;
            const updatedSession = {
              ...session,
              messages: session.messages.slice(0, -1).concat({
                ...lastMessage,
                content: finalContent,
                isStreaming: false,
              }),
              updatedAt: Date.now(),
            };
            const nextSessions = previousSessions.map((item) => (item.id === targetSessionId ? updatedSession : item));
            saveSessions(nextSessions);
            return nextSessions;
          });
          break;
        }
        case "error": {
          const targetSessionId = payload.sessionId;
          setIsGenerating(false);
          if (!targetSessionId) {
            setModelProgress((previous) => ({
              ...previous,
              text: payload.message,
              status: "error",
            }));
            console.error("Worker error:", payload);
            break;
          }

          setSessions((previousSessions) => {
            const session = previousSessions.find((item) => item.id === targetSessionId);
            if (!session) return previousSessions;

            const lastMessage = session.messages[session.messages.length - 1];
            if (!lastMessage || lastMessage.role !== "assistant") return previousSessions;

            const updatedSession = {
              ...session,
              messages: session.messages.slice(0, -1).concat({
                ...lastMessage,
                content: `Generation failed: ${payload.message}`,
                isStreaming: false,
              }),
              updatedAt: Date.now(),
            };
            const nextSessions = previousSessions.map((item) => (item.id === targetSessionId ? updatedSession : item));
            saveSessions(nextSessions);
            return nextSessions;
          });
          console.error("Worker error:", payload);
          break;
        }
      }
    };

    worker.onerror = (error) => {
      console.error("Worker error:", error);
      setIsGenerating(false);
      setModelProgress({
        progress: 0,
        text: `Worker error: ${error.message || "Unknown error"}`,
        status: "error",
      });
    };

    workerRef.current = worker;
    postWorkerMessage(worker, { type: "init" });

    return () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, []);

  const sendMessage = useCallback(
    (content: string) => {
      if (!workerRef.current || isGenerating || modelProgress.status !== "ready") return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content,
        timestamp: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      setSessions((previousSessions) => {
        let session = previousSessions.find((item) => item.id === activeSessionId);
        let nextSessions = previousSessions;
        let targetSessionId = activeSessionId;

        if (!session) {
          session = createDefaultSession();
          targetSessionId = session.id;
          nextSessions = [session, ...previousSessions];
          setActiveSessionId(session.id);
          activeSessionIdRef.current = session.id;
          localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
        }

        const updatedSession = {
          ...session,
          messages: [...session.messages, userMessage, assistantMessage],
          updatedAt: Date.now(),
          title:
            session.title === "New Chat" && session.messages.length === 0
              ? content.slice(0, 40) + (content.length > 40 ? "..." : "")
              : session.title,
        };

        nextSessions = nextSessions.map((item) => (item.id === targetSessionId ? updatedSession : item));
        saveSessions(nextSessions);

        postWorkerMessage(workerRef.current, {
          type: "generate",
          payload: { sessionId: targetSessionId, messages: buildWorkerMessages(updatedSession) },
        });

        return nextSessions;
      });

      setIsGenerating(true);
    },
    [activeSessionId, isGenerating, modelProgress.status]
  );

  const stopGeneration = useCallback(() => {
    postWorkerMessage(workerRef.current, { type: "stop" });
    setIsGenerating(false);
  }, []);

  const createNewChat = useCallback(() => {
    const session = createDefaultSession();
    setSessions((previousSessions) => {
      const nextSessions = [session, ...previousSessions];
      saveSessions(nextSessions);
      return nextSessions;
    });
    setActiveSessionId(session.id);
    activeSessionIdRef.current = session.id;
    localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
    activeSessionIdRef.current = id;
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((previousSessions) => {
        const filteredSessions = previousSessions.filter((session) => session.id !== id);
        const nextSessions = filteredSessions.length > 0 ? filteredSessions : [createDefaultSession()];
        const nextActiveId = activeSessionId === id ? nextSessions[0].id : activeSessionId;

        saveSessions(nextSessions);
        setActiveSessionId(nextActiveId);
        activeSessionIdRef.current = nextActiveId;
        localStorage.setItem(ACTIVE_SESSION_KEY, nextActiveId);
        return nextSessions;
      });
    },
    [activeSessionId]
  );

  const clearAllSessions = useCallback(() => {
    const session = createDefaultSession();
    setSessions([session]);
    saveSessions([session]);
    setActiveSessionId(session.id);
    activeSessionIdRef.current = session.id;
    localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
  }, []);

  const retryLastMessage = useCallback(() => {
    const session = sessions.find((item) => item.id === activeSessionId);
    if (!session || !workerRef.current || isGenerating || modelProgress.status !== "ready") return;

    setSessions((previousSessions) => {
      const targetSession = previousSessions.find((item) => item.id === activeSessionId);
      if (!targetSession) return previousSessions;

      const lastAssistantIndex = [...targetSession.messages]
        .reverse()
        .findIndex((message) => message.role === "assistant");
      if (lastAssistantIndex < 0) return previousSessions;

      const removeIndex = targetSession.messages.length - 1 - lastAssistantIndex;
      const previousMessage = targetSession.messages[removeIndex - 1];
      if (!previousMessage || previousMessage.role !== "user") return previousSessions;

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      const updatedSession = {
        ...targetSession,
        messages: targetSession.messages.slice(0, removeIndex).concat(assistantMessage),
        updatedAt: Date.now(),
      };

      const nextSessions = previousSessions.map((item) => (item.id === activeSessionId ? updatedSession : item));
      saveSessions(nextSessions);

      postWorkerMessage(workerRef.current, {
        type: "generate",
        payload: { sessionId: activeSessionId, messages: buildWorkerMessages(updatedSession) },
      });

      return nextSessions;
    });

    setIsGenerating(true);
  }, [activeSessionId, sessions, isGenerating, modelProgress.status]);

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
