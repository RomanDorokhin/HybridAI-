/// <reference lib="webworker" />
import { pipeline, env } from "@huggingface/transformers";

// Настройки для работы в браузере
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.localModelPath = "/"; // Ищем модели от корня сайта

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
          payload: { text: "Loading optimized ONNX model...", progress: 0 },
        });

        // Загружаем нашу ONNX модель из папки public/models/qwen-onnx
        generator = await pipeline("text-generation", "models/qwen-onnx", {
            device: 'webgpu', // Пробуем WebGPU
            dtype: 'fp32',    // Для квантованной модели указываем базу
        });

        self.postMessage({
          type: "ready",
          payload: { modelId: "Qwen-2.5-0.5B-ONNX" },
        });
      } catch (error: any) {
        console.error("WebGPU failed, falling back to CPU", error);
        try {
            generator = await pipeline("text-generation", "models/qwen-onnx", {
                device: 'cpu',
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
        
        // Формируем промпт в формате Qwen
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
