export const retrievalAssistantConfig = {
  // queryModel: "ollama/qwen3:4b",
  // queryModel: "ollama/deepseek-r1:1.5b-qwen-distill-q4_K_M",
  queryModel: "ollama/llama3.2:1b",
  // queryModel: "ollama/llama3.2:3b",
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
