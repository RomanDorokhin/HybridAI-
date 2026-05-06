import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, User, Bot, RotateCcw, Play, X } from "lucide-react";
import type { ChatMessage } from "@/types/chat";

interface ChatMessageItemProps {
  message: ChatMessage;
  onRetry?: () => void;
}

export function ChatMessageItem({ message, onRetry }: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming;

  const htmlCode = message.content.match(/```html\s*([\s\S]*?)```/)?.[1] || 
                   (message.content.includes('<html>') ? message.content : null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className={`group flex gap-4 py-6 px-4 ${isUser ? "bg-transparent" : "bg-card/50"}`}>
      <div className="flex-shrink-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isUser
              ? "bg-secondary text-foreground"
              : "bg-primary/20 text-primary"
          }`}
        >
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-medium text-foreground">
            {isUser ? "You" : "Smol-agent"}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="prose prose-invert max-w-none">
          {isUser ? (
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            <div className="markdown-content text-foreground/90">
              {message.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              ) : isStreaming ? (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                  <span className="text-sm ml-1">Thinking...</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
        {!isUser && message.content && !isStreaming && (
          <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
            </Button>
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={onRetry}
              >
                <RotateCcw size={12} />
                <span className="ml-1">Retry</span>
              </Button>
            )}
            {htmlCode && (
              <Button
                variant="default"
                size="sm"
                className="h-7 px-2 text-xs bg-primary/20 text-primary hover:bg-primary/30 border-none ml-2"
                onClick={() => setShowPreview(true)}
              >
                <Play size={12} fill="currentColor" />
                <span className="ml-1 font-bold italic">PLAY PROTOTYPE</span>
              </Button>
            )}
          </div>
        )}

        {showPreview && htmlCode && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="relative w-full max-w-5xl aspect-video bg-white rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              <div className="absolute top-4 right-4 z-50">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="rounded-full w-8 h-8 p-0"
                  onClick={() => setShowPreview(false)}
                >
                  <X size={16} />
                </Button>
              </div>
              <iframe
                title="Game Preview"
                srcDoc={htmlCode.includes('<!DOCTYPE') ? htmlCode : `<!DOCTYPE html><html><body style="margin:0;overflow:hidden;background:#000;">${htmlCode}</body></html>`}
                className="w-full h-full border-none bg-black"
                sandbox="allow-scripts allow-modals"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
