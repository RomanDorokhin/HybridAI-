import { Progress } from "@/components/ui/progress";
import { Sparkles, AlertCircle, Download } from "lucide-react";
import type { ModelProgress } from "@/types/chat";

interface ModelLoaderProps {
  progress: ModelProgress;
}

export function ModelLoader({ progress }: ModelLoaderProps) {
  const { status, text, progress: percent } = progress;

  if (status === "ready") return null;

  const isError = status === "error";
  const isDownloading = status === "downloading";
  const isLoading = status === "loading";

  return (
    <div className="flex flex-col items-center justify-center p-8 max-w-md mx-auto">
      <div className="w-full bg-card border border-border rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          {isError ? (
            <AlertCircle className="w-6 h-6 text-destructive" />
          ) : (
            <Sparkles className="w-6 h-6 text-primary animate-pulse-slow" />
          )}
          <div>
            <h3 className="font-semibold text-foreground">
              {isError
                ? "Error Loading Model"
                : isDownloading
                ? "Downloading Qwen 2.5"
                : "Loading Qwen 2.5"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isDownloading ? "~500 MB download, cached for future use" : "Initializing WebGPU engine"}
            </p>

          </div>
        </div>

        {(isDownloading || isLoading) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {isDownloading && <Download size={14} className="text-primary animate-bounce" />}
              <Progress value={percent} className="flex-1 h-2" />
              <span className="text-xs font-medium text-muted-foreground w-10 text-right">
                {percent}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{text}</p>
          </div>
        )}

        {isError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 max-w-md w-full animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-3 text-destructive mb-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="font-semibold">Error Loading Model</h3>
            </div>
            <p className="text-sm text-destructive/80 mb-1">
              Model loading failed
            </p>
            <div className="bg-destructive/5 rounded border border-destructive/10 p-2 mt-2">
              <p className="text-xs font-mono text-destructive break-all">
                {error || text || "Unknown error occurred"}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed italic">
              Try refreshing the page. If the error persists, your browser may not support WebGPU.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
