export const retrievalAssistantConfig = {
  queryModel: "vertexai/gemini-2.5-flash-lite",
  // Ollama alternatives (use when USE_OLLAMA=true):
  // queryModel: "ollama/llama3.1:8b",
  // queryModel: "ollama/gemma3:12b",
  // queryModel: "ollama/nomic-embed-text:latest",
  // queryModel: "ollama/nomic-embed-text-v2-moe:latest",
  // queryModel: "ollama/llama3.2:1b",
  // queryModel: "ollama/llama3.2:3b",
  // queryModel: "ollama/qwen3:4b",
  // queryModel: "ollama/deepseek-r1:1.5b-qwen-distill-q4_K_M",
  retrieverProvider: "supabase" as const,
  filterKwargs: {},
  k: 5,
};

export const retrievalAssistantId = "retrieval_graph";

/**
 * The configuration for the indexing/upload process.
 */
export const indexConfig = {
  useSampleDocs: false,
  retrieverProvider: "supabase" as const,
  filterKwargs: {},
  k: 5,
};
