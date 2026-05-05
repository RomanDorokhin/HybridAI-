/// <reference lib="webworker" />
import { pipeline, env } from "@huggingface/transformers";
import type { WorkerChatMessage, WorkerRequest, WorkerResponse } from "@/types/chat";

type Device = "webgpu" | "wasm";

type Beam = {
  output_token_ids?: unknown;
};

type GenerationOptions = {
  max_new_tokens: number;
  temperature: number;
  do_sample: boolean;
  callback_function?: (beams: Beam[]) => void;
};

type GeneratedItem = {
  generated_text?: string;
};

type GeneratorOutput = GeneratedItem[] | GeneratedItem | string;

type TextGenerator = {
  (prompt: string, options: GenerationOptions): Promise<GeneratorOutput>;
  tokenizer?: {
    decode: (tokens: unknown, options?: { skip_special_tokens?: boolean }) => string;
  };
};

type PipelineProgress = {
  progress?: number;
  status?: string;
  file?: string;
};

const MODEL_PATH = "models/qwen-onnx";
const MODEL_ID = "Qwen-2.5-0.5B-ONNX";

let generator: TextGenerator | null = null;
let isGenerating = false;

// The app is deployed below /HybridAI-/ on GitHub Pages. Keeping localModelPath
// aligned with the current page base avoids accidental requests to the domain root.
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = self.location.pathname.includes("/HybridAI-/") ? "/HybridAI-/" : "/";

function postMessageToMain(message: WorkerResponse) {
  self.postMessage(message);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function extractAssistantResponse(generatedText: string) {
  const marker = "<|im_start|>assistant\n";
  const markerIndex = generatedText.lastIndexOf(marker);
  const raw = markerIndex >= 0
    ? generatedText.slice(markerIndex + marker.length)
    : generatedText.split("assistant\n").pop() || generatedText;

  return raw.replace(/<\|im_end\|>\s*$/u, "").trimStart();
}

function normalizeOutputText(output: GeneratorOutput) {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output[0]?.generated_text || "";
  return output.generated_text || "";
}

function buildPrompt(messages: WorkerChatMessage[]) {
  return `${messages
    .map((message) => `<|im_start|>${message.role}\n${message.content}<|im_end|>`)
    .join("\n")}\n<|im_start|>assistant\n`;
}

async function loadPipeline(device: Device) {
  const loadedPipeline = await pipeline("text-generation", MODEL_PATH, {
    device,
    progress_callback: (progress: PipelineProgress) => {
      postMessageToMain({
        type: "initProgress",
        payload: {
          progress: Math.min(99, Math.max(0, Math.round(progress.progress || 0))),
          text: progress.file ? `Loading ${progress.file}` : progress.status || "Loading local model...",
        },
      });
    },
  });

  return loadedPipeline as unknown as TextGenerator;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type } = event.data;

  switch (type) {
    case "init": {
      try {
        if (generator) {
          postMessageToMain({ type: "ready", payload: { modelId: MODEL_ID } });
          return;
        }

        postMessageToMain({
          type: "initProgress",
          payload: { text: "Loading local ONNX model...", progress: 0 },
        });

        try {
          generator = await loadPipeline("webgpu");
        } catch (webGpuError) {
          console.warn("WebGPU initialization failed, falling back to WASM", webGpuError);
          generator = await loadPipeline("wasm");
        }

        postMessageToMain({ type: "ready", payload: { modelId: MODEL_ID } });
      } catch (error) {
        postMessageToMain({
          type: "error",
          payload: { message: getErrorMessage(error) || "Failed to initialize model" },
        });
      }
      break;
    }

    case "generate": {
      if (!generator || isGenerating) return;

      const { messages, sessionId } = event.data.payload;
      isGenerating = true;

      try {
        const output = await generator(buildPrompt(messages), {
          max_new_tokens: 512,
          temperature: 0.7,
          do_sample: true,
          callback_function: (beams) => {
            const tokenIds = beams[0]?.output_token_ids;
            if (!tokenIds || !generator?.tokenizer) return;

            const decoded = generator.tokenizer.decode(tokenIds, { skip_special_tokens: false });
            const content = extractAssistantResponse(decoded);
            postMessageToMain({
              type: "chunk",
              payload: { content, fullResponse: content, sessionId },
            });
          },
        });

        const finalContent = extractAssistantResponse(normalizeOutputText(output));
        postMessageToMain({
          type: "done",
          payload: { fullResponse: finalContent, sessionId },
        });
      } catch (error) {
        postMessageToMain({
          type: "error",
          payload: { message: getErrorMessage(error) || "Generation failed", sessionId },
        });
      } finally {
        isGenerating = false;
      }
      break;
    }

    case "stop": {
      isGenerating = false;
      break;
    }

    case "deleteCache": {
      break;
    }
  }
};
