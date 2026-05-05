export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  modelName: string;
}

export interface ModelProgress {
  progress: number;
  text: string;
  status: "idle" | "downloading" | "loading" | "ready" | "error";
}

export interface WorkerChatMessage {
  role: ChatRole;
  content: string;
}

export type WorkerRequest =
  | { type: "init" }
  | { type: "generate"; payload: { sessionId: string; messages: WorkerChatMessage[] } }
  | { type: "stop" }
  | { type: "deleteCache" };

export type WorkerResponse =
  | { type: "progress" | "initProgress"; payload: { text: string; progress: number; sessionId?: string } }
  | { type: "chunk"; payload: { content: string; fullResponse: string; sessionId?: string } }
  | { type: "done"; payload: { fullResponse?: string; sessionId?: string } }
  | { type: "error"; payload: { message: string; sessionId?: string } }
  | { type: "ready"; payload: { modelId: string } };

export type ThemeMode = "dark" | "light";
