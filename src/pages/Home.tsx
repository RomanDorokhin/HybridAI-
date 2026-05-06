import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatMessageItem } from "@/components/ChatMessageItem";
import { ChatInput } from "@/components/ChatInput";
import { ChatSidebar } from "@/components/ChatSidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, Sparkles, ShieldCheck, Cpu } from "lucide-react";

export default function Home() {
  const {
    sessions,
    activeSessionId,
    currentSession,
    isGenerating,
    settings,
    updateSettings,
    sendMessage,
    stopGeneration,
    createNewChat,
    switchSession,
    deleteSession,
    clearAllSessions,
    retryLastMessage,
  } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bottomRef.current || !scrollRef.current) return;
    
    const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (isAtBottom || (currentSession.messages.length > 0 && currentSession.messages[currentSession.messages.length - 1].role === 'user')) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentSession.messages, isGenerating]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSwitchSession={switchSession}
        onCreateNewChat={createNewChat}
        onDeleteSession={deleteSession}
        onClearAll={clearAllSessions}
        settings={settings}
        onUpdateSettings={updateSettings}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={18} />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-foreground">HybridAI 2.0</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
              <Cpu size={10} />
              API First
            </span>
          </div>
          {!settings.apiKey && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <span className="text-[10px] text-yellow-600 font-medium italic">API Key Required in Settings</span>
            </div>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full" ref={scrollRef}>
            <div className="max-w-3xl mx-auto">
              {currentSession.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-4">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 shadow-inner">
                    <Sparkles className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="text-3xl font-black text-foreground mb-3 tracking-tight">
                    Senior Game Architect
                  </h2>
                  <p className="text-muted-foreground text-center max-w-md mb-10 leading-relaxed">
                    High-performance AI for game coding, protocol design, and architecture.
                    <br />
                    <span className="text-xs opacity-70 mt-2 block italic">Bring your own key, keep your own data.</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                    {[
                      "Придумай концепт RPG в стиле киберпанк",
                      "Опиши структуру протокола для мультиплеера",
                      "Напиши систему инвентаря на TypeScript",
                      "Как лучше синхронизировать стейт игрока?",
                    ].map((example) => (
                      <button
                        key={example}
                        onClick={() => sendMessage(example)}
                        className="p-4 text-sm text-left bg-card hover:bg-accent border border-border rounded-xl transition-all hover:scale-[1.02] shadow-sm text-foreground/80"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pb-8 pt-4">
                  {currentSession.messages.map((message) => (
                    <ChatMessageItem
                      key={message.id}
                      message={message}
                      onRetry={
                        message.role === "assistant" && !message.isStreaming
                          ? retryLastMessage
                          : undefined
                      }
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          onStop={stopGeneration}
          isGenerating={isGenerating}
          disabled={!settings.apiKey}
        />
      </main>
    </div>
  );
}

