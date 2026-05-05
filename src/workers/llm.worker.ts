/// <reference lib="webworker" />
import { pipeline, env } from "@huggingface/transformers";

// Настройки для работы в браузере
env.allowLocalModels = true;
env.allowRemoteModels = true;

let generator: any = null;
let isGenerating = false;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case "init": {
      try {
        if (generator) {
          self.postMessage({ type: "ready", payload: { modelId: "Qwen-2.5-0.5B-OpenSmolGame" } });
          return;
        }

        self.postMessage({
          type: "initProgress",
          payload: { text: "Loading specialized Qwen model...", progress: 0 },
        });

        // Загружаем нашу модель из хранилища GitHub LFS
        generator = await pipeline("text-generation", "https://media.githubusercontent.com/media/RomanDorokhin/HybridAI-/main/models/model.gguf", {
            device: 'webgpu', // Пробуем WebGPU для скорости
        });



        self.postMessage({
          type: "ready",
          payload: { modelId: "Qwen-2.5-0.5B-OpenSmolGame" },
        });
      } catch (error: any) {
        // Если WebGPU не взлетел, пробуем CPU
        try {
            generator = await pipeline("text-generation", "https://media.githubusercontent.com/media/RomanDorokhin/HybridAI-/main/models/model.gguf", {
                device: 'cpu',
            });


            self.postMessage({ type: "ready", payload: { modelId: "Qwen-2.5-0.5B-OpenSmolGame" } });
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
          callback_function: (beams: any) => {
            const decoded = generator.tokenizer.decode(beams[0].output_token_ids, { skip_special_tokens: true });
            // Находим только новый текст
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
