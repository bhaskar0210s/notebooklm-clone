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

type SupabaseEnv = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

// Check if we should use Ollama based on environment variable
const shouldUseOllama = (): boolean => {
  return process.env.USE_OLLAMA === "true";
};

// Get Ollama base URL from environment variable, default to localhost for local development
const getOllamaBaseUrl = (): string => {
  return process.env.OLLAMA_BASE_URL || "http://localhost:11434";
};

// Default Ollama embedding model when USE_OLLAMA=true
const DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text:latest";

function getSupabaseEnv(): SupabaseEnv {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not defined"
    );
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
  };
}

export function makeSupabaseClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv();
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

/**
 * Create embeddings instance based on USE_OLLAMA environment variable
 */
function createEmbeddings(): Embeddings {
  const useOllama = shouldUseOllama();

  if (useOllama) {
    return new OllamaEmbeddings({
      model: DEFAULT_OLLAMA_EMBEDDING_MODEL,
      baseUrl: getOllamaBaseUrl(),
    });
  } else {
    return new VertexAIEmbeddings({
      model: "gemini-embedding-001",
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: process.env.GOOGLE_CLOUD_LOCATION || "asia-south1",
      dimensions: 768,
    } as any) as unknown as Embeddings;
  }
}

export async function makeSupabaseRetriever(
  configuration: typeof BaseConfigurationAnnotation.State
): Promise<VectorStoreRetriever> {
  const embeddings = createEmbeddings();
  const supabaseClient = makeSupabaseClient();
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

  const embeddings = createEmbeddings();
  const supabaseClient = makeSupabaseClient();
  return new SupabaseVectorStore(embeddings, {
    client: supabaseClient,
    tableName: "documents",
    queryName: "match_documents",
  });
}
