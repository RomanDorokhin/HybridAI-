import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  MessageSquare,
  Trash2,
  X,
  Cpu,
  AlertTriangle,
} from "lucide-react";
import type { ChatSession } from "@/types/chat";
import type { ModelProgress } from "@/types/chat";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSwitchSession: (id: string) => void;
  onCreateNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
  modelProgress: ModelProgress;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSwitchSession,
  onCreateNewChat,
  onDeleteSession,
  onClearAll,
  modelProgress,
  isOpen,
  onClose,
}: ChatSidebarProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleClear = () => {
    if (confirmClear) {
      onClearAll();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-sidebar-primary" />
            <h2 className="font-semibold text-sidebar-foreground">OpenSmolGame Agent</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 md:hidden"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>

        <div className="p-3">
          <Button
            onClick={() => {
              onCreateNewChat();
              onClose();
            }}
            className="w-full justify-start gap-2"
            variant="secondary"
          >
            <Plus size={16} />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1">
            {sessions.length === 0 ? (
              <p className="text-sm text-sidebar-foreground/50 text-center py-8">
                No chats yet. Start a new conversation!
              </p>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    onSwitchSession(session.id);
                    onClose();
                  }}
                  onMouseEnter={() => setHoveredId(session.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${
                    activeSessionId === session.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                  }`}
                >
                  <MessageSquare size={16} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <p className="text-xs text-sidebar-foreground/50">
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {(hoveredId === session.id || activeSessionId === session.id) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                    >
                      <Trash2 size={14} className="text-sidebar-foreground/50 hover:text-destructive" />
                    </Button>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          {modelProgress.status !== "ready" && (
            <div className="px-2 py-2 bg-sidebar-accent/50 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-sidebar-foreground/70">
                <Cpu size={12} />
                <span className="truncate">{modelProgress.text || "Initializing..."}</span>
              </div>
              {modelProgress.status === "downloading" && (
                <div className="mt-1.5 h-1 bg-sidebar-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sidebar-primary rounded-full transition-all"
                    style={{ width: `${modelProgress.progress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 px-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className={`h-7 text-xs ${
                confirmClear
                  ? "text-destructive hover:text-destructive"
                  : "text-sidebar-foreground/50"
              }`}
            >
              {confirmClear ? (
                <>
                  <AlertTriangle size={12} className="mr-1" />
                  Confirm Clear
                </>
              ) : (
                <>
                  <Trash2 size={12} className="mr-1" />
                  Clear All
                </>
              )}
            </Button>
          </div>

          <div className="px-2 text-[10px] text-sidebar-foreground/40">
            Model: Qwen 2.5 0.5B (INT8) &middot; Running locally in browser
          </div>
        </div>
      </aside>
    </>
  );
}
