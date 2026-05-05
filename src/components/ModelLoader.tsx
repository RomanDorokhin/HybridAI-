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
                ? "Downloading Llama 3.2"
                : "Loading Llama 3.2"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isDownloading ? "~1.6 GB download, cached for future use" : "Initializing WebGPU engine"}
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
          <div className="bg-destructive/10 rounded-lg p-3 mt-2">
            <p className="text-sm text-destructive">{text}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try refreshing the page. If the error persists, your browser may not support WebGPU.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
