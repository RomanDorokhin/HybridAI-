import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatMessageItem } from "@/components/ChatMessageItem";
import { ChatInput } from "@/components/ChatInput";
import { ChatSidebar } from "@/components/ChatSidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, Sparkles, ShieldCheck, Cpu, RotateCcw, Download } from "lucide-react";

export default function Home() {
    deleteSession,
    clearAllSessions,
    factoryReset,
    retryLastMessage,
    usage,
    generationStep,
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

  const exportChat = () => {
    if (!currentSession.messages.length) return;
    
    const content = currentSession.messages.map(m => {
      const time = new Date(m.timestamp).toLocaleTimeString();
      const role = m.role === 'user' ? 'ВЫ' : 'SMOL-AGENT';
      return `[${time}] ${role}:\n${m.content}\n${'-'.repeat(40)}`;
    }).join('\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${currentSession.title || 'export'}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSwitchSession={switchSession}
        onCreateNewChat={createNewChat}
        onDeleteSession={deleteSession}
        onClearAll={clearAllSessions}
        onUpdateSettings={updateSettings}
        onFactoryReset={factoryReset}
        usage={usage}
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
            <h1 className="font-semibold text-foreground truncate">{currentSession.title || 'Smol-agent'}</h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
              <Cpu size={10} />
              API First
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentSession.messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={exportChat}
                className="h-8 gap-2 text-xs text-muted-foreground hover:text-foreground"
                title="Скачать диалог"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Скачать</span>
              </Button>
            )}

            {!settings.apiKey && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <span className="text-[10px] text-yellow-600 font-medium italic">API Key Required in Settings</span>
              </div>
            )}
          </div>
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
                    Smol-agent
                  </h2>
                  <p className="text-muted-foreground text-center max-w-md mb-6 leading-relaxed">
                    High-performance AI for game coding, protocol design, and architecture.
                  </p>

                  <div className="w-full max-w-lg bg-primary/5 border border-primary/10 rounded-2xl p-6 mb-10">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Sparkles size={14} />
                      Как создать крутую игру?
                    </h3>
                    <div className="space-y-3">
                      {[
                        "1. Опиши идею игры (жанр, сеттинг)",
                        "2. Ответь на 7 уточняющих вопросов бота",
                        "3. Обсуди механику «фишки» игры",
                        "4. Утверди архитектуру данных",
                        "5. Спроектируй протокол событий",
                        "6. Попроси «протестировать» механику",
                        "7. Нажми «Создать игру» для Unity"
                      ].map((step, i) => (
                        <div key={i} className="flex gap-3 text-sm text-foreground/70">
                          <span className="font-mono text-primary/40 font-bold">{i+1}.</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
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
          
          {generationStep !== 'none' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-background/90 backdrop-blur-md border border-primary/20 rounded-full shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter text-primary italic">
                {generationStep === 'analyzing' && 'Analyzing Requirements...'}
                {generationStep === 'designing' && 'Designing Architecture...'}
                {generationStep === 'generating' && 'Building Protocol...'}
                {generationStep === 'finalizing' && 'Finalizing Response...'}
              </span>
            </div>
          )}
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

