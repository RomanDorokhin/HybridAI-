/// <reference lib="webworker" />
import { pipeline, env } from "@huggingface/transformers";

// Настройки для работы в браузере
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "/HybridAI-/";

let generator: any = null;
let isGenerating = false;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case "init": {
      try {
        if (generator) {
          self.postMessage({ type: "ready", payload: { modelId: "Qwen-2.5-0.5B-ONNX" } });
          return;
        }

        self.postMessage({
          type: "initProgress",
          payload: { text: "Loading local ONNX model...", progress: 0 },
        });

        const modelPath = "models/qwen-onnx"; 

        // Пробуем WebGPU
        generator = await pipeline("text-generation", modelPath, {
            device: 'webgpu',
        });

        self.postMessage({
          type: "ready",
          payload: { modelId: "Qwen-2.5-0.5B-ONNX" },
        });
      } catch (error: any) {
        console.error("WebGPU failed, falling back to WASM", error);
        try {
            const modelPath = "models/qwen-onnx";
            // Исправлено: используем 'wasm' вместо 'cpu'
            generator = await pipeline("text-generation", modelPath, {
                device: 'wasm',
            });
            self.postMessage({ type: "ready", payload: { modelId: "Qwen-2.5-0.5B-ONNX" } });
        } catch (innerError: any) {
            self.postMessage({
                type: "error",
                payload: { message: innerError.message || "Failed to initialize model" },
            });
        }
      }
      break;
    }

    case "generate": {
      if (!generator || isGenerating) return;

      isGenerating = true;
      try {
        const { messages } = payload;
        
        let prompt = "";
        for (const msg of messages) {
            prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
        }
        prompt += `<|im_start|>assistant\n`;

        const output = await generator(prompt, {
          max_new_tokens: 512,
          temperature: 0.7,
          do_sample: true,
          callback_function: (beams: any) => {
            const decoded = generator.tokenizer.decode(beams[0].output_token_ids, { skip_special_tokens: true });
            const content = decoded.split("assistant\n").pop() || "";
            self.postMessage({
              type: "chunk",
              payload: { content: content, fullResponse: content },
            });
          }
        });

        const finalContent = output[0].generated_text.split("assistant\n").pop() || "";
        self.postMessage({
          type: "done",
          payload: { fullResponse: finalContent },
        });
      } catch (error: any) {
        self.postMessage({
          type: "error",
          payload: { message: error.message || "Generation failed" },
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
  }
};
