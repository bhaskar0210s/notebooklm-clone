import {
  StateGraph,
  START,
  END,
  Annotation,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { loadChatModel } from "../lib/model-loader.js";

// Constants
const DEFAULT_QUERY_MODEL = "ollama/llama3.2:3b";
const GRAPH_RUN_NAME = "RetrievalGraph";

// Configuration type for better type safety
interface RetrievalConfig {
  queryModel?: string;
}

// State Annotations
const RetrievalState = Annotation.Root({
  query: Annotation<string>(),
  ...MessagesAnnotation.spec,
});

const RetrievalConfiguration = Annotation.Root({
  queryModel: Annotation<string>(),
});

// Node Functions
async function generateDirectAnswer(
  state: typeof RetrievalState.State,
  config: RunnableConfig
): Promise<typeof RetrievalState.Update> {
  const queryModel =
    (config?.configurable as RetrievalConfig)?.queryModel ||
    DEFAULT_QUERY_MODEL;
  const model = await loadChatModel(queryModel);
  const userMessage = new HumanMessage(state.query);
  const response = await model.invoke([...state.messages, userMessage]);
  return { messages: [userMessage, response] };
}

// Graph Builder
const retrievalGraphBuilder = new StateGraph(
  RetrievalState,
  RetrievalConfiguration
)
  .addNode("directAnswer", generateDirectAnswer)
  .addEdge(START, "directAnswer")
  .addEdge("directAnswer", END);

export const graph = retrievalGraphBuilder.compile().withConfig({
  runName: GRAPH_RUN_NAME,
});
