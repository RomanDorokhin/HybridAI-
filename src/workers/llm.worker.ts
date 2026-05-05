/// <reference lib="webworker" />
import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";
import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";

const MODEL_ID = "Llama-3.2-3B-Instruct-q4f16_1-MLC";
// Alternative smaller model: "Llama-3.2-1B-Instruct-q4f16_1-MLC"

let engine: MLCEngine | null = null;
let isGenerating = false;
let shouldStop = false;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case "init": {
      try {
        if (engine) {
          self.postMessage({ type: "ready", payload: { modelId: MODEL_ID } });
          return;
        }

        self.postMessage({
          type: "initProgress",
          payload: { text: "Initializing engine...", progress: 0 },
        });

        engine = await CreateMLCEngine(MODEL_ID, {
          initProgressCallback: (progress: any) => {
            self.postMessage({
              type: "initProgress",
              payload: {
                text: progress.text,
                progress: Math.round(progress.progress * 100),
              },
            });
          },
        });

        self.postMessage({
          type: "ready",
          payload: { modelId: MODEL_ID },
        });
      } catch (error: any) {
        self.postMessage({
          type: "error",
          payload: { message: error.message || "Failed to initialize model", code: error.code },
        });
      }
      break;
    }

    case "generate": {
      if (!engine || isGenerating) {
        self.postMessage({
          type: "error",
          payload: { message: !engine ? "Engine not initialized" : "Already generating" },
        });
        return;
      }

      isGenerating = true;
      shouldStop = false;

      try {
        const { messages }: { messages: ChatCompletionMessageParam[] } = payload;

        const completion = await engine.chat.completions.create({
          stream: true,
          messages,
          temperature: 0.7,
          max_tokens: 2048,
        });

        let fullResponse = "";

        for await (const chunk of completion) {
          if (shouldStop) break;

          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullResponse += content;
            self.postMessage({
              type: "chunk",
              payload: { content, fullResponse },
            });
          }
        }

        self.postMessage({
          type: "done",
          payload: { fullResponse },
        });
      } catch (error: any) {
        if (shouldStop) {
          self.postMessage({ type: "done", payload: { fullResponse: "", aborted: true } });
        } else {
          self.postMessage({
            type: "error",
            payload: { message: error.message || "Generation failed" },
          });
        }
      } finally {
        isGenerating = false;
        shouldStop = false;
      }
      break;
    }

    case "stop": {
      shouldStop = true;
      isGenerating = false;
      break;
    }

    case "deleteCache": {
      try {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          if (name.includes("webllm") || name.includes("llama")) {
            await caches.delete(name);
          }
        }
        engine = null;
        self.postMessage({ type: "ready", payload: { modelId: MODEL_ID, cacheCleared: true } });
      } catch (error: any) {
        self.postMessage({
          type: "error",
          payload: { message: error.message || "Failed to clear cache" },
        });
      }
      break;
    }
  }
};
