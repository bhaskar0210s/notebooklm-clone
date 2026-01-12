import {
  StateGraph,
  START,
  END,
  Annotation,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { Document } from "@langchain/core/documents";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { loadChatModel } from "../lib/model-loader.ts";
import { makeRetriever } from "../shared/retrieval.ts";
import { formatDocs } from "./utils.ts";
import { reduceDocs } from "../shared/state.ts";
import { BaseConfigurationAnnotation } from "../shared/configuration.ts";
import { ROUTER_SYSTEM_PROMPT, RESPONSE_SYSTEM_PROMPT } from "./prompts.ts";

// Constants
const DEFAULT_QUERY_MODEL = "ollama/llama3.2:1b"; // "ollama/qwen3:4b"; // "ollama/llama3.2:3b";
const GRAPH_RUN_NAME = "RetrievalGraph";

// Configuration type for better type safety
interface RetrievalConfig {
  queryModel?: string;
  filterKwargs?: Record<string, any>;
  k?: number;
}

// State Annotations
const RetrievalState = Annotation.Root({
  query: Annotation<string>(),
  route: Annotation<string>(),
  ...MessagesAnnotation.spec,
  /**
   * Populated by the retriever. This is a list of documents that the agent can reference.
   */
  documents: Annotation<
    Document[],
    Document[] | { [key: string]: any }[] | string[] | string | "delete"
  >({
    default: () => [],
    reducer: reduceDocs,
  }),
});

const RetrievalConfiguration = Annotation.Root({
  ...BaseConfigurationAnnotation.spec,
  queryModel: Annotation<string>(),
});

// Node Functions
async function checkQueryType(
  state: typeof RetrievalState.State,
  config: RunnableConfig
): Promise<{
  route: "retrieve" | "direct";
}> {
  // Schema for routing
  const schema = z.object({
    route: z.enum(["retrieve", "direct"]),
  });

  const configurable = (config?.configurable || {}) as Partial<RetrievalConfig>;
  const queryModel = configurable.queryModel || DEFAULT_QUERY_MODEL;
  const model = await loadChatModel(queryModel, 0.1);

  const routingPrompt = ROUTER_SYSTEM_PROMPT;

  const formattedPrompt = await routingPrompt.invoke({
    query: state.query,
  });

  try {
    const response = await model
      .withStructuredOutput(schema)
      .invoke(formattedPrompt.toString());

    const route = response.route;
    return { route };
  } catch (error) {
    // Fallback to retrieval if structured output fails
    return { route: "retrieve" };
  }
}

async function routeQuery(
  state: typeof RetrievalState.State
): Promise<"retrieveDocuments" | "directAnswer"> {
  // Normalize and defensively route to avoid hard failures on unexpected model output
  const normalizedRoute = state.route?.toString().trim().toLowerCase();

  if (!normalizedRoute) {
    // If routing was skipped or missing, fall back to retrieval so the request still completes
    return "retrieveDocuments";
  }

  if (normalizedRoute.startsWith("retrieve")) {
    return "retrieveDocuments";
  }

  if (normalizedRoute.startsWith("direct")) {
    return "directAnswer";
  }

  // Unknown value from model or caller: default to retrieval instead of throwing
  return "retrieveDocuments";
}

async function answerQueryDirectly(
  state: typeof RetrievalState.State,
  config: RunnableConfig
): Promise<typeof RetrievalState.Update> {
  const configurable = (config?.configurable || {}) as Partial<RetrievalConfig>;
  const queryModel = configurable.queryModel || DEFAULT_QUERY_MODEL;
  const model = await loadChatModel(queryModel, 0.7);
  const userHumanMessage = new HumanMessage(state.query);

  const response = await model.invoke([userHumanMessage]);
  return { messages: [userHumanMessage, response] };
}

async function retrieveDocuments(
  state: typeof RetrievalState.State,
  config: RunnableConfig
): Promise<typeof RetrievalState.Update> {
  const retriever = await makeRetriever(config);
  const response = await retriever.invoke(state.query);

  return { documents: response };
}

async function generateResponse(
  state: typeof RetrievalState.State,
  config: RunnableConfig
): Promise<typeof RetrievalState.Update> {
  const configurable = (config?.configurable || {}) as Partial<RetrievalConfig>;
  const queryModel = configurable.queryModel || DEFAULT_QUERY_MODEL;
  const model = await loadChatModel(queryModel, 0.2);

  // Format documents and create prompt messages
  const context = formatDocs(state.documents);
  const promptValue = await RESPONSE_SYSTEM_PROMPT.invoke({
    question: state.query,
    context: context,
  });

  // Convert ChatPromptValue to messages array
  const promptMessages = promptValue.toChatMessages();

  // Combine existing messages with the prompt (which includes system + human message)
  const messageHistory = [...state.messages, ...promptMessages];

  // Invoke model and let MessagesAnnotation handle the response
  const response = await model.invoke(messageHistory);

  return { messages: [response] };
}

// Graph Builder
const retrievalGraphBuilder = new StateGraph(
  RetrievalState,
  RetrievalConfiguration
)
  .addNode("checkQueryType", checkQueryType)
  .addNode("retrieveDocuments", retrieveDocuments)
  .addNode("generateResponse", generateResponse)
  .addNode("directAnswer", answerQueryDirectly)
  .addEdge(START, "checkQueryType")
  .addConditionalEdges("checkQueryType", routeQuery, [
    "retrieveDocuments",
    "directAnswer",
  ])
  .addEdge("retrieveDocuments", "generateResponse")
  .addEdge("generateResponse", END)
  .addEdge("directAnswer", END);

export const graph = retrievalGraphBuilder.compile().withConfig({
  runName: GRAPH_RUN_NAME,
});
