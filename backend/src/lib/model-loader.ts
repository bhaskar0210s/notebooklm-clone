import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { initChatModel } from "@langchain/classic/chat_models/universal";
import { ChatVertexAI } from "@langchain/google-vertexai";

// Check if we should use Ollama based on environment variable
const shouldUseOllama = (): boolean => {
  return process.env.USE_OLLAMA === "true";
};

// Get Ollama base URL from environment variable, default to localhost for local development
const getOllamaBaseUrl = (): string => {
  return process.env.OLLAMA_BASE_URL || "http://localhost:11434";
};

/**
 * Load a chat model from a fully specified name.
 * When USE_OLLAMA is true, only Ollama models are allowed (client provider is ignored).
 * Otherwise, Vertex AI is used.
 * @param fullySpecifiedName - 'vertexai/gemini-2.5-flash', 'ollama/llama3.2:3b', or bare model name
 * @returns A Promise that resolves to a BaseChatModel instance.
 */
export async function loadChatModel(
  fullySpecifiedName: string,
  temperature: number = 0.7
): Promise<BaseChatModel> {
  const useOllama = shouldUseOllama();
  const index = fullySpecifiedName.indexOf("/");

  // Handle Vertex AI models (only when USE_OLLAMA=false)
  if (!useOllama) {
    if (index === -1) {
      return new ChatVertexAI({
        model: fullySpecifiedName,
        temperature: temperature,
        project: process.env.GOOGLE_CLOUD_PROJECT_ID,
        location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
      } as any) as unknown as BaseChatModel;
    }
    const provider = fullySpecifiedName.slice(0, index);
    const model = fullySpecifiedName.slice(index + 1);

    if (provider === "vertexai") {
      return new ChatVertexAI({
        model: model,
        temperature: temperature,
        project: process.env.GOOGLE_CLOUD_PROJECT_ID,
        location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
      } as any) as unknown as BaseChatModel;
    } else if (provider === "ollama") {
      // Explicit ollama prefix when USE_OLLAMA=false - fall through to Ollama logic
    } else {
      throw new Error(
        `Unsupported provider: ${provider}. Use 'vertexai' or 'ollama'.`
      );
    }
  }

  // Handle Ollama models (USE_OLLAMA=true - only Ollama allowed, client provider ignored)
  const ollamaBaseUrl = getOllamaBaseUrl();
  if (index === -1) {
    return await initChatModel(fullySpecifiedName, {
      temperature: temperature,
      baseUrl: ollamaBaseUrl,
    });
  }
  const provider = fullySpecifiedName.slice(0, index);
  const model = fullySpecifiedName.slice(index + 1);

  if (provider === "ollama") {
    return await initChatModel(model, {
      modelProvider: "ollama",
      temperature: temperature,
      baseUrl: ollamaBaseUrl,
    });
  } else {
    throw new Error(
      `Unsupported provider: ${provider}. When USE_OLLAMA=true, only 'ollama' is allowed.`
    );
  }
}
