import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { initChatModel } from "@langchain/classic/chat_models/universal";
import { ChatVertexAI } from "@langchain/google-vertexai";

const SUPPORTED_PROVIDERS = ["ollama", "vertexai"] as const;

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
 * Supports both Ollama and Vertex AI providers based on USE_OLLAMA environment variable.
 * @param fullySpecifiedName - String in the format 'provider/model' or 'provider/account/provider/model'.
 *   For Vertex AI: 'vertexai/gemini-2.5-flash' or 'gemini-2.5-flash'
 *   For Ollama: 'ollama/llama3.2:1b' or 'ollama/model-name'
 * @returns A Promise that resolves to a BaseChatModel instance.
 */
export async function loadChatModel(
  fullySpecifiedName: string,
  temperature: number = 0.7
): Promise<BaseChatModel> {
  const useOllama = shouldUseOllama();
  const index = fullySpecifiedName.indexOf("/");

  // Handle Vertex AI models
  if (!useOllama) {
    // Check if it's a Vertex AI model
    if (index === -1) {
      // No provider prefix, assume Vertex AI model name
      return new ChatVertexAI({
        model: fullySpecifiedName,
        temperature: temperature,
        project: process.env.GOOGLE_CLOUD_PROJECT_ID,
        location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
      } as any) as unknown as BaseChatModel;
    } else {
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
        // Explicitly requested Ollama even though USE_OLLAMA=false
        // Fall through to Ollama logic
      } else {
        throw new Error(
          `Unsupported provider: ${provider}. Use 'vertexai' or 'ollama'.`
        );
      }
    }
  }

  // Handle Ollama models
  const ollamaBaseUrl = getOllamaBaseUrl();
  if (index === -1) {
    // If there's no "/", assume it's just the model name for Ollama
    if (
      !SUPPORTED_PROVIDERS.includes(
        fullySpecifiedName as (typeof SUPPORTED_PROVIDERS)[number]
      )
    ) {
      // Try as Ollama model name directly
      return await initChatModel(fullySpecifiedName, {
        temperature: temperature,
        baseUrl: ollamaBaseUrl,
      });
    }
    return await initChatModel(fullySpecifiedName, {
      temperature: temperature,
      baseUrl: ollamaBaseUrl,
    });
  } else {
    const provider = fullySpecifiedName.slice(0, index);
    const model = fullySpecifiedName.slice(index + 1);

    if (provider === "ollama") {
      return await initChatModel(model, {
        modelProvider: provider,
        temperature: temperature,
        baseUrl: ollamaBaseUrl,
      });
    } else {
      throw new Error(
        `Unsupported provider: ${provider}. Use 'ollama' or 'vertexai'.`
      );
    }
  }
}
