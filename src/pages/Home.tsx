import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatMessageItem } from "@/components/ChatMessageItem";
import { ChatInput } from "@/components/ChatInput";
import { ModelLoader } from "@/components/ModelLoader";
import { ChatSidebar } from "@/components/ChatSidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, Sparkles, Zap } from "lucide-react";

export default function Home() {
  const {
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
  } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentSession.messages, isGenerating]);

  const isModelReady = modelProgress.status === "ready";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSwitchSession={switchSession}
        onCreateNewChat={createNewChat}
        onDeleteSession={deleteSession}
        onClearAll={clearAllSessions}
        modelProgress={modelProgress}
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
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-foreground">Qwen 2.5 Chat</h1>
            {isModelReady && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 text-xs font-medium">
                <Zap size={10} />
                Ready
              </span>
            )}
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={createNewChat}
              className="text-xs"
            >
              New Chat
            </Button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full" ref={scrollRef}>
            <div className="max-w-3xl mx-auto">
              {!isModelReady && currentSession.messages.length === 0 ? (
                <ModelLoader progress={modelProgress} />
              ) : currentSession.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    OpenSmolGame Agent
                  </h2>
                  <p className="text-muted-foreground text-center max-w-md mb-8">
                    Specialized AI assistant for game coding and protocol design.
                    Your conversations stay private — no data ever leaves your device.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                    {[
                      "Explain quantum computing",
                      "Write a Python script",
                      "Help me with my essay",
                      "Debug my code",
                    ].map((example) => (
                      <button
                        key={example}
                        onClick={() => sendMessage(example)}
                        className="p-3 text-sm text-left bg-card hover:bg-card/80 border border-border rounded-lg transition-colors text-foreground/80"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pb-4">
                  {!isModelReady && (
                    <ModelLoader progress={modelProgress} />
                  )}
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
          disabled={!isModelReady}
        />
      </main>
    </div>
  );
}
