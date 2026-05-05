export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
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
  status: 'idle' | 'downloading' | 'loading' | 'ready' | 'error';
}

export interface WorkerMessage {
  type: 'init' | 'generate' | 'stop' | 'deleteCache';
  payload?: any;
}

export interface WorkerResponse {
  type: 'progress' | 'chunk' | 'done' | 'error' | 'ready' | 'initProgress';
  payload?: any;
}

export type ThemeMode = 'dark' | 'light';
