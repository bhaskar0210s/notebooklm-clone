import { VectorStoreRetriever } from "@langchain/core/vectorstores";
import { Embeddings } from "@langchain/core/embeddings";
import { OllamaEmbeddings } from "@langchain/ollama";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import { RunnableConfig } from "@langchain/core/runnables";
import {
  BaseConfigurationAnnotation,
  ensureBaseConfiguration,
} from "./configuration.ts";

// Check if we should use Ollama based on environment variable
const shouldUseOllama = (): boolean => {
  return process.env.USE_OLLAMA === "true";
};

// Get Ollama base URL from environment variable, default to localhost for local development
const getOllamaBaseUrl = (): string => {
  return process.env.OLLAMA_BASE_URL || "http://localhost:11434";
};

/**
 * Create embeddings instance based on USE_OLLAMA environment variable
 */
function createEmbeddings(): Embeddings {
  const useOllama = shouldUseOllama();

  if (useOllama) {
    return new OllamaEmbeddings({
      model: "nomic-embed-text:latest",
      baseUrl: getOllamaBaseUrl(),
    });
  } else {
    return new VertexAIEmbeddings({
      model: "gemini-embedding-001",
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: process.env.GOOGLE_CLOUD_LOCATION || "asia-south1",
      outputDimensionality: 768,
    } as any) as unknown as Embeddings;
  }
}

export async function makeSupabaseRetriever(
  configuration: typeof BaseConfigurationAnnotation.State
): Promise<VectorStoreRetriever> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not defined"
    );
  }

  const embeddings = createEmbeddings();
  const supabaseClient = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  );
  const vectorStore = new SupabaseVectorStore(embeddings, {
    client: supabaseClient,
    tableName: "documents",
    queryName: "match_documents",
  });
  return vectorStore.asRetriever({
    k: configuration.k,
    filter: configuration.filterKwargs,
  });
}

export async function makeRetriever(
  config: RunnableConfig
): Promise<VectorStoreRetriever> {
  const configuration = ensureBaseConfiguration(config);
  return makeSupabaseRetriever(configuration);
}

/**
 * Create a SupabaseVectorStore instance for adding documents
 */
export async function makeSupabaseVectorStore(
  config: RunnableConfig
): Promise<SupabaseVectorStore> {
  // Validate configuration (even though we don't use it, we want to ensure it's valid)
  ensureBaseConfiguration(config);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not defined"
    );
  }

  const embeddings = createEmbeddings();
  const supabaseClient = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  );
  return new SupabaseVectorStore(embeddings, {
    client: supabaseClient,
    tableName: "documents",
    queryName: "match_documents",
  });
}
